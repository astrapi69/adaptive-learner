"""Read the browser database from the Dexie schema (#3828).

Every ``version(n).stores({...})`` of ``frontend/src/storage/dexie/db.ts`` is
read; later declarations replace earlier ones and ``null`` drops a store, as
Dexie does. The result must name exactly the stores the database class
declares as ``EntityTable``, each with its declared primary key; the fields
come from the row interfaces of ``db-rows.ts``. Anything the reader cannot
read with certainty raises ``SchemaReadError`` (fail closed).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from data_model_types import BROWSER, Column, Database, Entity, SchemaReadError


@dataclass(frozen=True)
class RowField:
    """One member of a TypeScript row interface."""

    name: str
    type: str
    optional: bool


def _skip_string(source: str, start: int) -> int:
    """Index just past the string literal that opens at ``start``."""
    quote = source[start]
    index = start + 1
    while index < len(source) and source[index] != quote:
        index += 2 if source[index] == "\\" else 1
    if index >= len(source):
        raise SchemaReadError(f"unterminated string literal at offset {start}")
    return index + 1


def strip_comments(source: str) -> str:
    """``source`` with every ``//`` and ``/* */`` comment removed.

    String literals are kept intact, so a ``//`` inside a string survives;
    a block comment keeps its line breaks.
    """
    out: list[str] = []
    index = 0
    while index < len(source):
        char = source[index]
        if char in "\"'`":
            end = _skip_string(source, index)
            out.append(source[index:end])
            index = end
        elif source.startswith("//", index):
            newline = source.find("\n", index)
            index = len(source) if newline < 0 else newline
        elif source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end < 0:
                raise SchemaReadError(f"unterminated block comment at offset {index}")
            out.append("\n" * source.count("\n", index, end))
            index = end + 2
        else:
            out.append(char)
            index += 1
    return "".join(out)


def _closing(source: str, start: int) -> int:
    """Index of the bracket that closes the one at ``start`` (strings skipped)."""
    pairs = {"{": "}", "(": ")", "[": "]", "<": ">"}
    stack = [pairs[source[start]]]
    index = start + 1
    while index < len(source):
        char = source[index]
        if char in "\"'`":
            index = _skip_string(source, index)
            continue
        if char in pairs and (char != "<" or stack[-1] == ">" or source[start] == "<"):
            stack.append(pairs[char])
        elif char == stack[-1]:
            stack.pop()
            if not stack:
                return index
        index += 1
    raise SchemaReadError(f"unbalanced {source[start]!r} at offset {start}")


def _split_top_level(text: str, separator: str) -> list[str]:
    """``text`` split at ``separator`` outside brackets and string literals."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char in "\"'`":
            end = _skip_string(text, index)
            current.append(text[index:end])
            index = end
            continue
        if char in "{([<":
            depth += 1
        elif char in "})]>" and not (char == ">" and index and text[index - 1] == "="):
            depth -= 1
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


_STRING = re.compile(r"""^(["'])(.*)\1$""", re.S)
_VERSION = re.compile(r"\.version\(([^)]*)\)")


def _stores_literal(body: str, number: int) -> dict[str, str | None]:
    """The ``{store: "indexes"}`` object of one ``stores()`` call."""
    stores: dict[str, str | None] = {}
    for entry in _split_top_level(body, ","):
        key, sep, value = entry.partition(":")
        key = key.strip().strip("\"'")
        value = value.strip()
        if not sep or not re.fullmatch(r"\w+", key):
            raise SchemaReadError(f"version({number}): cannot read the stores entry {entry!r}")
        if value == "null":
            stores[key] = None
            continue
        literal = _STRING.match(value)
        if not literal or literal.group(1) in literal.group(2):
            raise SchemaReadError(
                f"version({number}): store {key} is not a single string literal ({value!r})"
            )
        stores[key] = literal.group(2)
    return stores


def dexie_versions(source: str) -> list[tuple[int, dict[str, str | None]]]:
    """Every ``version(n).stores({...})`` declaration of a Dexie schema.

    Args:
        source: The TypeScript text of the database class.

    Returns:
        ``(n, stores)`` per declaration, sorted by ``n``; a ``version(n)``
        without ``stores()`` contributes an empty mapping.

    Raises:
        SchemaReadError: on no version at all, a version number that is not
            an integer literal, a number declared twice, or a stores entry that
            is not a single string literal or ``null``.
    """
    code = strip_comments(source)
    versions: dict[int, dict[str, str | None]] = {}
    for match in _VERSION.finditer(code):
        argument = match.group(1).strip()
        if not argument.isdigit():
            raise SchemaReadError(f"version({argument}) is not an integer literal")
        number = int(argument)
        if number in versions:
            raise SchemaReadError(f"version({number}) is declared twice")
        rest = code[match.end() :]
        stores_call = re.match(r"\s*\.stores\(\s*", rest)
        if not stores_call:
            versions[number] = {}
            continue
        start = match.end() + stores_call.end()
        if code[start] != "{":
            raise SchemaReadError(f"version({number}).stores() is not given an object literal")
        versions[number] = _stores_literal(code[start + 1 : _closing(code, start)], number)
    if not versions:
        raise SchemaReadError("no version() declaration found")
    return sorted(versions.items())


def final_stores(versions: Iterable[tuple[int, dict[str, str | None]]]) -> dict[str, str]:
    """The live schema after every version: the last declaration of each store wins."""
    stores: dict[str, str] = {}
    for _, declared in sorted(versions):
        for store, spec in declared.items():
            if spec is None:
                stores.pop(store, None)
            else:
                stores[store] = spec
    return stores


_ENTITY_TABLE = re.compile(
    r"^\s*(\w+)!\s*:\s*EntityTable<\s*(\w+)\s*,\s*[\"'](\w+)[\"']\s*>\s*;", re.M
)


def entity_tables(source: str) -> dict[str, tuple[str, str]]:
    """``store -> (row interface, primary key)`` from the ``EntityTable`` declarations."""
    return {store: (row, key) for store, row, key in _ENTITY_TABLE.findall(strip_comments(source))}


def _type_word(ts_type: str) -> str:
    """A Mermaid-safe type word for one non-null TypeScript type."""
    ts_type = re.sub(r"""import\(["'][^"']*["']\)\.""", "", ts_type).strip()
    indexed = re.fullmatch(r"""(\w+)\[["'](\w+)["']\]""", ts_type)
    if indexed:
        return f"{indexed.group(1)}[{indexed.group(2)}]"
    if ts_type.endswith("[]"):
        inner = _type_word(ts_type[:-2].strip().strip("()"))
        return f"{inner}[]" if re.fullmatch(r"\w+", inner) else "object[]"
    if re.fullmatch(r"\w+", ts_type):
        return ts_type
    if ts_type.startswith("Record<"):
        return "Record"
    return "object"


def row_type(ts_type: str) -> tuple[str, bool]:
    """``(type word, nullable)`` for a TypeScript member type."""
    parts = _split_top_level(ts_type, "|")
    nullable = any(part in ("null", "undefined") for part in parts)
    parts = [part for part in parts if part not in ("null", "undefined")]
    if parts and all(_STRING.match(part) for part in parts):
        return "string", nullable
    if len(parts) != 1:
        return "union", nullable
    return _type_word(parts[0]), nullable


def row_interfaces(source: str) -> dict[str, list[RowField]]:
    """The members of every ``interface`` in a TypeScript source.

    Raises:
        SchemaReadError: when a member is not ``name: type`` or ``name?: type``.
    """
    code = strip_comments(source)
    interfaces: dict[str, list[RowField]] = {}
    for match in re.finditer(r"\binterface\s+(\w+)\s*\{", code):
        start = match.end() - 1
        fields = []
        for member in _split_top_level(code[start + 1 : _closing(code, start)], ";"):
            parsed = re.fullmatch(r"(\w+)(\?)?\s*:\s*(.+)", " ".join(member.split()), re.S)
            if not parsed:
                raise SchemaReadError(
                    f"interface {match.group(1)}: cannot read the member {member!r}"
                )
            type_word, nullable = row_type(parsed.group(3))
            fields.append(RowField(parsed.group(1), type_word, nullable or bool(parsed.group(2))))
        interfaces[match.group(1)] = fields
    return interfaces


def _index_fields(entry: str) -> list[str]:
    """The fields one Dexie index entry covers (``&a``, ``*a``, ``++a``, ``[a+b]``)."""
    bare = entry.lstrip("&*+").strip()
    return [part.strip() for part in bare.strip("[]").split("+")]


def _store_entity(store: str, spec: str, row: str, fields: list[RowField]) -> Entity:
    entries = [entry.strip() for entry in spec.split(",") if entry.strip()]
    primary = set(_index_fields(entries[0]))
    unique = {
        entry.lstrip("&") for entry in entries[1:] if entry.startswith("&") and "[" not in entry
    }
    known = {row_field.name for row_field in fields}
    unknown = sorted({name for entry in entries for name in _index_fields(entry)} - known)
    if unknown:
        raise SchemaReadError(
            f"store {store} indexes {', '.join(unknown)}, which its row shape {row} lacks"
        )
    columns = tuple(
        Column(
            name=row_field.name,
            type=row_field.type,
            nullable=row_field.optional,
            primary=row_field.name in primary,
            unique=row_field.name in unique,
            note=", ".join(
                entry for entry in entries[1:] if row_field.name in _index_fields(entry)
            ),
        )
        for row_field in fields
    )
    return Entity(store, columns)


def browser_database(db_source: str, rows_source: str) -> Database:
    """The browser database: the final Dexie schema with typed row shapes.

    Raises:
        SchemaReadError: when the final schema and the ``EntityTable``
            declarations name different stores, a primary key differs from
            the declared one, a row interface is missing, or a store indexes
            a field its row shape lacks.
    """
    versions = dexie_versions(db_source)
    stores = final_stores(versions)
    declared = entity_tables(db_source)
    if set(stores) != set(declared):
        missing = sorted(set(declared) - set(stores))
        extra = sorted(set(stores) - set(declared))
        raise SchemaReadError(
            f"the schema's stores and the EntityTable declarations differ: "
            f"declared without a store {missing}, store without a declaration {extra}"
        )
    interfaces = row_interfaces(rows_source)
    entities: dict[str, Entity] = {}
    for store in sorted(stores):
        row, key = declared[store]
        if row not in interfaces:
            raise SchemaReadError(f"store {store}: row interface {row} not found")
        entity = _store_entity(store, stores[store], row, interfaces[row])
        primary = [column.name for column in entity.columns if column.primary]
        if primary != [key]:
            raise SchemaReadError(
                f"store {store}: primary key {primary} differs from EntityTable key {key!r}"
            )
        entities[store] = entity
    return Database(BROWSER, entities, versions=len(versions), version=versions[-1][0])
