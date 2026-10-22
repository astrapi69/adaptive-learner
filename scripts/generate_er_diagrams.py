"""Generate the ER diagrams of the data model, per area (#3828).

Writes ``docs/help/<lang>/developer/data-model.md`` for every help locale
from three sources, never by hand:

* the server database: the SQLAlchemy metadata of ``backend/app/models``
  (``Base.metadata`` and the mappers), so tables, columns, foreign keys and
  ``relationship()`` are introspected, not parsed as text;
* the browser database: the final schema of the last ``version()`` in
  ``frontend/src/storage/dexie/db.ts`` (every version is read, later
  declarations replace earlier ones, ``null`` drops a store) with the row
  shapes of ``db-rows.ts``;
* ``scripts/data_model_areas.yaml``, the one human decision: which area each
  table and store belongs to, which table a store stands for, and what every
  ``*_id`` field without a foreign key points to.

A hand-drawn diagram is wrong after the next migration PR and still looks
like a measurement. So ``--check`` regenerates in memory and exits 1 when a
page differs, when a table or store has no area (or two), when a ``*_id``
field resolves to nothing, or when the mapping names something that is gone;
the write mode refuses to write while any of that holds. It exits 2 when a
source is missing or cannot be read: "could not check" never reads as clean.

The readers are ``data_model_dexie`` and ``data_model_server``, the mapping
and its findings ``data_model_mapping``, the translated frame text
``data_model_text``; this module renders the pages and is their only writer.

Usage (from ``backend/``, the models need the backend environment)::

    poetry run python ../scripts/generate_er_diagrams.py          # write
    poetry run python ../scripts/generate_er_diagrams.py --check  # drift gate
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from data_model_dexie import browser_database
from data_model_mapping import MAPPING_REL, assemble, load_mapping
from data_model_server import load_server, relationship_findings, server_database
from data_model_text import TEXT
from data_model_types import (
    BROWSER,
    SERVER,
    Area,
    Column,
    Database,
    DataModel,
    Edge,
    MappingError,
    SchemaReadError,
)
from generate_api_reference import MARKED_LOCALES, TRANSLATION_MARKER

EXIT_OK = 0
EXIT_FINDINGS = 1
EXIT_FAIL_CLOSED = 2

DEXIE_DB_REL = "frontend/src/storage/dexie/db.ts"
DEXIE_ROWS_REL = "frontend/src/storage/dexie/db-rows.ts"


@dataclass(frozen=True)
class Diagram:
    """One rendered ``erDiagram`` block: an area of one database."""

    area: str
    database: str
    code: str


def build_model(root: Path) -> tuple[DataModel, list[str]]:
    """Read every source under ``root`` and resolve the model.

    Raises:
        MappingError: the mapping cannot be used.
        SchemaReadError: a schema source is missing or cannot be read.
    """
    mapping = load_mapping(root / MAPPING_REL, tuple(TEXT))
    try:
        db_source = (root / DEXIE_DB_REL).read_text(encoding="utf-8")
        rows_source = (root / DEXIE_ROWS_REL).read_text(encoding="utf-8")
    except OSError as exc:
        raise SchemaReadError(f"cannot read the Dexie schema: {exc}") from exc
    browser = browser_database(db_source, rows_source)
    metadata, mappers = load_server(root)
    server = server_database(metadata, mappers)
    model, findings = assemble(server, browser, mapping)
    return model, relationship_findings(mappers) + findings


# --- rendering -----------------------------------------------------------------


def _attribute(column: Column) -> str:
    keys = [
        label
        for label, on in (("PK", column.primary), ("FK", column.foreign), ("UK", column.unique))
        if on
    ]
    line = f"        {column.type} {column.name}"
    if keys:
        line += " " + ", ".join(keys)
    if column.note:
        line += f' "{column.note}"'
    return line


def _relation(edge: Edge) -> str:
    parent_end = "|o" if edge.optional else "||"
    child_end = "o|" if edge.one_to_one else "o{"
    line = "--" if edge.declared else ".."
    return f'    {edge.parent} {parent_end}{line}{child_end} {edge.child} : "{edge.field}"'


def _diagram(lang: str, area: Area, database: Database) -> Diagram:
    text = TEXT[lang]
    members = list(area.tables) if database.kind == SERVER else list(area.stores)
    owned = [name for name in members if name in database.entities]
    edges = [edge for edge in database.edges if edge.child in owned or edge.parent in owned]
    title = text["acc_title"].format(area=area.title[lang], database=text[f"{database.kind}_name"])
    relations = ", ".join(f"{e.child}.{e.field} → {e.parent}" for e in edges)
    descr = text[f"acc_{database.kind}"].format(area=area.title[lang], names=", ".join(owned))
    descr += " " + (
        text["acc_relations"].format(edges=relations) if edges else text["acc_no_relations"]
    )
    lines = ["erDiagram", f"    accTitle: {title}", f"    accDescr: {descr}"]
    for name in owned:
        lines.append(f"    {name} {{")
        lines.extend(_attribute(column) for column in database.entities[name].columns)
        lines.append("    }")
    lines.extend(_relation(edge) for edge in edges)
    return Diagram(area.key, database.kind, "\n".join(lines))


def diagrams(lang: str, model: DataModel) -> list[Diagram]:
    """Every ``erDiagram`` of the page in ``lang``: per area, server then browser."""
    return [
        _diagram(lang, area, database)
        for area in model.mapping.areas
        for database in (model.server, model.browser)
    ]


def _cell(text: str) -> str:
    return " ".join(text.split()).replace("|", "\\|")


def _area_section(lang: str, area: Area, blocks: dict[tuple[str, str], Diagram]) -> list[str]:
    text = TEXT[lang]
    lines = [f"## {area.title[lang]}", "", area.summary[lang], ""]
    for kind in (SERVER, BROWSER):
        lines += [
            f"### {text[f'{kind}_heading']}",
            "",
            "```mermaid",
            blocks[(kind, area.key)].code,
            "```",
            "",
        ]
    lines += [text["pairs_header"], "|---|---|"]
    paired = {table: store for store, table in area.stores.items() if table}
    for table in area.tables:
        lines.append(f"| `{table}` | {f'`{paired[table]}`' if table in paired else '-'} |")
    lines += [f"| - | `{store}` |" for store, table in area.stores.items() if table is None]
    return [*lines, ""]


def _rule_rows(lang: str, model: DataModel) -> list[str]:
    text = TEXT[lang]
    rows = []
    for kind in (SERVER, BROWSER):
        for key, rule in sorted(model.rules(kind).items()):
            if not rule.reason:
                continue
            label = (
                text["kind_reference"].format(target=rule.target)
                if rule.kind == "reference"
                else text[f"kind_{rule.kind}"]
            )
            rows.append(f"| {text[f'{kind}_label']} | `{key}` | {label} | {_cell(rule.reason)} |")
    return rows


def render_page(lang: str, model: DataModel) -> str:
    """The complete data-model page for one help locale.

    Returns:
        Markdown ending in a newline; locales in ``MARKED_LOCALES`` open with
        the translation marker their other help pages carry.
    """
    text = TEXT[lang]
    blocks = {(d.database, d.area): d for d in diagrams(lang, model)}
    lines = _page_head(lang, model)
    for area in model.mapping.areas:
        lines += _area_section(lang, area, blocks)
    lines += [f"## {text['rules_heading']}", "", text["rules_intro"], ""]
    lines += [text["rules_header"], "|---|---|---|---|", *_rule_rows(lang, model)]
    page = "\n".join(lines).rstrip() + "\n"
    return f"{TRANSLATION_MARKER}\n\n{page}" if lang in MARKED_LOCALES else page


def _page_head(lang: str, model: DataModel) -> list[str]:
    """Title, generated note, counts, legend and the areas overview."""
    text = TEXT[lang]
    counts = text["counts"].format(
        tables=len(model.server.entities),
        foreign_keys=sum(1 for edge in model.server.edges if edge.declared),
        stores=len(model.browser.entities),
        version=model.browser.version,
    )
    lines = [f"# {text['title']}", "", text["generated"], "", text["intro"], "", counts, ""]
    lines += [f"## {text['legend_heading']}", "", *[f"- {item}" for item in text["legend"]], ""]
    lines += [f"## {text['areas_heading']}", "", text["areas_header"], "|---|---|---|"]
    lines += [
        f"| {a.title[lang]} | {len(a.tables)} | {len(a.stores)} |" for a in model.mapping.areas
    ]
    return [*lines, ""]


def page_rel(lang: str) -> str:
    """The repo-relative path of the generated page for ``lang``."""
    return f"docs/help/{lang}/developer/data-model.md"


def build_pages(model: DataModel) -> dict[str, str]:
    """``{repo-relative path: page}`` for every help locale."""
    return {page_rel(lang): render_page(lang, model) for lang in TEXT}


def stale_pages(root: Path, pages: dict[str, str]) -> list[str]:
    """The pages under ``root`` that are missing or differ from ``pages``."""
    stale = []
    for rel, page in pages.items():
        path = root / rel
        if not path.is_file() or path.read_text(encoding="utf-8") != page:
            stale.append(rel)
    return stale


# --- command line -------------------------------------------------------------


def _git_root() -> Path | None:
    """The repo root from the working directory, never from ``__file__`` (worktrees)."""
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=False
    )
    return Path(out.stdout.strip()) if out.returncode == 0 else None


def _measured(model: DataModel) -> str:
    """One line naming what the run read, so an empty basis never reads as clean."""
    declared = sum(1 for edge in model.server.edges if edge.declared)
    return (
        f"data-model: server: {len(model.server.entities)} tables, {declared} foreign keys, "
        f"{len(model.mapping.server_fields)} columns resolved by the mapping; "
        f"browser: {len(model.browser.entities)} stores from {model.browser.versions} Dexie versions "
        f"(schema version {model.browser.version}), {len(model.mapping.browser_fields)} fields resolved "
        f"by the mapping; {len(model.mapping.areas)} areas"
    )


def main(argv: Sequence[str] | None = None) -> int:
    """Write the pages, or with ``--check`` report drift and gaps."""
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument(
        "--check", action="store_true", help="exit 1 on a stale page or a gap in the mapping"
    )
    parser.add_argument(
        "--root", type=Path, help="repository root (default: git top level of the cwd)"
    )
    opts = parser.parse_args(argv)
    root = opts.root or _git_root()
    if root is None:
        print("data-model: FAIL-CLOSED: not inside a git checkout and no --root given")
        return EXIT_FAIL_CLOSED
    try:
        model, findings = build_model(root)
    except (MappingError, SchemaReadError) as exc:
        print(f"data-model: FAIL-CLOSED: {exc}")
        return EXIT_FAIL_CLOSED
    print(_measured(model))
    if findings:
        for finding in findings:
            print(f"data-model: GAP - {finding}")
        print(
            f"data-model: {len(findings)} finding(s); resolve them in the source or in {MAPPING_REL}"
        )
        return EXIT_FINDINGS
    pages = build_pages(model)
    stale = stale_pages(root, pages)
    return _report_drift(pages, stale) if opts.check else _write(root, pages, stale)


def _report_drift(pages: dict[str, str], stale: list[str]) -> int:
    """``--check``: name every stale page; exit 1 when there is one."""
    for rel in stale:
        print(f"data-model: DRIFT - {rel} differs from the sources (run `make sync-data-model`)")
    if stale:
        return EXIT_FINDINGS
    print(f"data-model: check OK - {len(pages)} pages match the sources")
    return EXIT_OK


def _write(root: Path, pages: dict[str, str], stale: list[str]) -> int:
    """Write the stale pages; the generator is their only writer."""
    for rel in stale:
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(pages[rel], encoding="utf-8")
        print(f"data-model: wrote {rel}")
    print(f"data-model: {len(pages)} pages, {len(stale)} rewritten")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
