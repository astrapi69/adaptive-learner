"""Load the area mapping and resolve the model against it (#3828).

``scripts/data_model_areas.yaml`` is the one human decision behind the
data-model page: the area of every table and store, the table a store stands
for, and what every ``*_id`` field without a foreign key points to. This
module shape-checks the file (``MappingError``) and reports every gap or
contradiction between it and the sources as a finding.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import replace
from pathlib import Path
from typing import Any

import yaml
from data_model_types import (
    BROWSER,
    SERVER,
    Area,
    Database,
    DataModel,
    Edge,
    Mapping,
    MappingError,
    Rule,
)

MAPPING_REL = "scripts/data_model_areas.yaml"
ID_FIELD = re.compile(r"^\w+_id$")


def _texts(raw: Any, where: str, locales: Sequence[str]) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise MappingError(f"{where}: expected one text per locale")
    missing = [
        lang for lang in locales if not isinstance(raw.get(lang), str) or not raw[lang].strip()
    ]
    if missing:
        raise MappingError(f"{where}: no text for {', '.join(missing)}")
    return {lang: raw[lang].strip() for lang in locales}


def _rule(raw: Any, where: str, reference_key: str) -> Rule:
    if not isinstance(raw, dict):
        raise MappingError(f"{where}: expected a mapping")
    kinds = [kind for kind in (reference_key, "external", "unrelated") if kind in raw]
    extra = set(raw) - {reference_key, "external", "unrelated", "reason"}
    if len(kinds) != 1 or extra:
        raise MappingError(f"{where}: give exactly one of {reference_key}/external/unrelated")
    kind = kinds[0]
    value = raw[kind]
    if not isinstance(value, str) or not value.strip():
        raise MappingError(f"{where}: {kind} needs a non-empty value")
    if kind == reference_key:
        reason = raw.get("reason", "")
        if not isinstance(reason, str):
            raise MappingError(f"{where}: reason must be text")
        return Rule("reference", value.strip(), reason.strip())
    if "reason" in raw:
        raise MappingError(f"{where}: the reason of {kind} is its value")
    return Rule(kind, None, value.strip())


def _fields(raw: Any, section: str, reference_key: str) -> dict[str, Rule]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise MappingError(f"{section}: expected a mapping of entity.field to a rule")
    rules = {}
    for name, value in raw.items():
        if not isinstance(name, str) or not re.fullmatch(r"\w+\.\w+", name):
            raise MappingError(f"{section}: {name!r} is not entity.field")
        rules[name] = _rule(value, f"{section}.{name}", reference_key)
    return rules


def _area(raw: Any, locales: Sequence[str]) -> Area:
    if not isinstance(raw, dict) or not isinstance(raw.get("key"), str):
        raise MappingError("every area needs a key")
    key = raw["key"]
    tables = raw.get("tables")
    stores = raw.get("stores")
    if not isinstance(tables, list) or not all(isinstance(name, str) for name in tables):
        raise MappingError(f"area {key}: tables must be a list of names")
    if not isinstance(stores, dict) or not all(isinstance(t, str | None) for t in stores.values()):
        raise MappingError(f"area {key}: stores must map each store to its table or null")
    return Area(
        key=key,
        title=_texts(raw.get("title"), f"area {key}: title", locales),
        summary=_texts(raw.get("summary"), f"area {key}: summary", locales),
        tables=tuple(tables),
        stores=dict(stores),
    )


def load_mapping(path: Path, locales: Sequence[str]) -> Mapping:
    """Read and shape-check the area mapping.

    Args:
        path: The YAML file.
        locales: Every locale the area titles and summaries must cover.

    Raises:
        MappingError: when the file is missing, not YAML, has no area, an
            area lacks a locale, or a field rule is not exactly one of
            reference/external/unrelated with a non-empty value.
    """
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise MappingError(f"cannot read {path}: {exc}") from exc
    if not isinstance(raw, dict) or not isinstance(raw.get("areas"), list) or not raw["areas"]:
        raise MappingError(f"{path}: no area defined")
    areas = tuple(_area(area, locales) for area in raw["areas"])
    keys = [area.key for area in areas]
    if len(set(keys)) != len(keys):
        raise MappingError(f"{path}: area keys repeat: {keys}")
    return Mapping(
        areas=areas,
        server_fields=_fields(raw.get("server_fields"), "server_fields", "table"),
        browser_fields=_fields(raw.get("browser_fields"), "browser_fields", "store"),
    )


# --- resolving and auditing ---------------------------------------------------


def resolve(database: Database, rules: dict[str, Rule]) -> tuple[Database, list[str]]:
    """Add the mapping's references to a database and report what is unresolved.

    Returns:
        The database with one dashed edge per reference rule, and the
        findings: a ``*_id`` field neither a foreign key nor in the mapping,
        a rule for a field that does not exist or already has a foreign key,
        and a reference to an entity that does not exist.
    """
    edges, findings = _rule_edges(database, rules)
    return replace(database, edges=database.edges + edges), _unresolved_ids(
        database, rules
    ) + findings


def _unresolved_ids(database: Database, rules: dict[str, Rule]) -> list[str]:
    """Every ``*_id`` field that is neither a foreign key nor in the mapping."""
    return [
        f"{database.kind}: {name}.{column.name} is an *_id field without a foreign key and "
        f"without an entry in {MAPPING_REL} ({database.kind}_fields)"
        for name, entity in database.entities.items()
        for column in entity.columns
        if ID_FIELD.match(column.name)
        and not column.foreign
        and f"{name}.{column.name}" not in rules
    ]


def _rule_edges(database: Database, rules: dict[str, Rule]) -> tuple[tuple[Edge, ...], list[str]]:
    """One dashed edge per reference rule, and the rules that cannot apply."""
    edges = []
    findings = []
    for key, rule in rules.items():
        entity_name, field_name = key.split(".")
        owner = database.entities.get(entity_name)
        target = owner.column(field_name) if owner else None
        if target is None:
            findings.append(
                f"{database.kind}: {key} in {MAPPING_REL} names a field that does not exist"
            )
        elif target.foreign:
            findings.append(
                f"{database.kind}: {key} has a foreign key to {target.foreign}; drop its mapping entry"
            )
        elif rule.kind == "reference" and rule.target not in database.entities:
            findings.append(f"{database.kind}: {key} refers to {rule.target}, which does not exist")
        elif rule.kind == "reference":
            edges.append(
                Edge(
                    entity_name, field_name, str(rule.target), False, target.unique, target.nullable
                )
            )
    return tuple(edges), findings


def _membership_findings(
    kind: str, names: Iterable[str], areas: Iterable[tuple[str, Iterable[str]]]
) -> list[str]:
    noun = "table" if kind == SERVER else "store"
    owners: dict[str, list[str]] = {}
    findings = []
    known = set(names)
    for area_key, members in areas:
        for member in members:
            if member not in known:
                findings.append(
                    f"{kind}: area {area_key} names {noun} {member}, which does not exist"
                )
            owners.setdefault(member, []).append(area_key)
    for name in sorted(known):
        count = len(owners.get(name, []))
        if count == 0:
            findings.append(f"{kind}: {noun} {name} belongs to no area in {MAPPING_REL}")
        elif count > 1:
            findings.append(
                f"{kind}: {noun} {name} belongs to {count} areas ({', '.join(owners[name])})"
            )
    return findings


def area_findings(server: Database, browser: Database, mapping: Mapping) -> list[str]:
    """Every table and store in exactly one area; a store's table in the same area."""
    findings = _membership_findings(
        SERVER, server.entities, ((a.key, a.tables) for a in mapping.areas)
    )
    findings += _membership_findings(
        BROWSER, browser.entities, ((a.key, a.stores) for a in mapping.areas)
    )
    table_area = {table: area.key for area in mapping.areas for table in area.tables}
    stood_for: dict[str, list[str]] = {}
    for area in mapping.areas:
        for store, table in area.stores.items():
            if table is None:
                continue
            stood_for.setdefault(table, []).append(store)
            if table not in server.entities:
                findings.append(
                    f"browser: store {store} stands for table {table}, which does not exist"
                )
            elif table_area.get(table) != area.key:
                findings.append(
                    f"browser: store {store} stands for table {table}, which is in area "
                    f"{table_area.get(table)}, not {area.key}"
                )
    for table, stores in sorted(stood_for.items()):
        if len(stores) > 1:
            findings.append(f"browser: stores {', '.join(stores)} all stand for table {table}")
    return findings


def counterpart_findings(server: Database, browser: Database, mapping: Mapping) -> list[str]:
    """A browser reference must agree with the foreign key of the same server column."""
    table_of = {
        store: table for area in mapping.areas for store, table in area.stores.items() if table
    }
    store_of = {table: store for store, table in table_of.items()}
    findings = []
    for edge in browser.edges:
        table = table_of.get(edge.child)
        column = server.entities[table].column(edge.field) if table in server.entities else None
        if column is None or column.foreign is None:
            continue
        expected = store_of.get(column.foreign)
        if expected != edge.parent:
            findings.append(
                f"browser: {edge.child}.{edge.field} refers to {edge.parent}, but the server column "
                f"{table}.{edge.field} refers to {column.foreign} (store {expected})"
            )
    return findings


def assemble(server: Database, browser: Database, mapping: Mapping) -> tuple[DataModel, list[str]]:
    """Resolve both databases against the mapping and collect every finding."""
    server, server_findings = resolve(server, mapping.server_fields)
    browser, browser_findings = resolve(browser, mapping.browser_fields)
    findings = server_findings + browser_findings
    findings += area_findings(server, browser, mapping)
    findings += counterpart_findings(server, browser, mapping)
    return DataModel(server, browser, mapping), findings
