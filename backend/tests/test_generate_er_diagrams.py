"""Tests for the generated ER diagrams of the data model (#3828).

``scripts/generate_er_diagrams.py`` reads the SQLAlchemy metadata, the final
Dexie schema of ``frontend/src/storage/dexie/db.ts`` and the area mapping
``scripts/data_model_areas.yaml`` and writes
``docs/help/<lang>/developer/data-model.md``. A hand-drawn diagram is wrong
after the next migration PR; these tests pin that the generated one is not:
the Dexie schema resolves to the stores the database class declares, every
``*_id`` field is resolved or reported, every table and store has exactly one
area, every relationship appears in a diagram, and a stale page, a gap or a
missing source turns ``--check`` red instead of green.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

import pytest
from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Table
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import data_model_dexie as dexie  # noqa: E402
import data_model_mapping as mapping_rules  # noqa: E402
import data_model_server as server_reader  # noqa: E402
import generate_er_diagrams as erd  # noqa: E402
from data_model_types import DataModel, MappingError, SchemaReadError  # noqa: E402
from verify_docs_locale_coverage import help_locales  # noqa: E402

DB_TS = REPO / "frontend" / "src" / "storage" / "dexie" / "db.ts"
ROWS_TS = REPO / "frontend" / "src" / "storage" / "dexie" / "db-rows.ts"
MAPPING = REPO / "scripts" / "data_model_areas.yaml"

RELATION_LINE = re.compile(r'^\s*(\w+) (\|\||\|o)(--|\.\.)(o\{|o\|) (\w+) : "(\w+)"$', re.M)


# --- Dexie schema ------------------------------------------------------------


def _dexie(body: str) -> str:
    return "class Db extends Dexie {\n    constructor() {\n" + body + "\n    }\n}\n"


def test_final_stores_take_the_last_declaration_of_each_store() -> None:
    source = _dexie(
        'this.version(1).stores({a: "id, x", b: "id"});\n'
        'this.version(2).stores({a: "id, y"});\n'
        "this.version(3).stores({}).upgrade(async () => {});\n"
    )
    versions = dexie.dexie_versions(source)
    assert [number for number, _ in versions] == [1, 2, 3]
    assert dexie.final_stores(versions) == {"a": "id, y", "b": "id"}


def test_final_stores_drop_a_store_declared_null() -> None:
    source = _dexie(
        'this.version(1).stores({a: "id", b: "id"});\nthis.version(2).stores({b: null});\n'
    )
    assert dexie.final_stores(dexie.dexie_versions(source)) == {"a": "id"}


def test_dexie_versions_ignore_commented_out_declarations() -> None:
    source = _dexie(
        '// this.version(9).stores({ghost: "id"});\n'
        '/* this.version(8).stores({ghost: "id"}); */\n'
        'this.version(1).stores({\n    // the users\n    users: "id, email", // trailing\n});\n'
    )
    assert dexie.dexie_versions(source) == [(1, {"users": "id, email"})]


@pytest.mark.parametrize(
    "body",
    [
        pytest.param("this.version(1).stores({a: indexes});", id="store-value-is-a-variable"),
        pytest.param(
            'this.version(1).stores({a: "id" + ", x"});', id="store-value-is-concatenated"
        ),
        pytest.param('this.version(n).stores({a: "id"});', id="version-is-not-a-literal"),
        pytest.param("this.version(1).stores(SCHEMA);", id="stores-argument-is-not-an-object"),
        pytest.param(
            'this.version(1).stores({a: "id"});\nthis.version(1).stores({b: "id"});',
            id="version-declared-twice",
        ),
        pytest.param("const nothing = 1;", id="no-version-at-all"),
    ],
)
def test_dexie_versions_fail_closed_on_a_schema_they_cannot_read(body: str) -> None:
    with pytest.raises(SchemaReadError):
        dexie.dexie_versions(_dexie(body))


def test_row_interfaces_read_optional_nullable_and_multiline_members() -> None:
    source = (
        "export interface ThingRow {\n"
        "    id: string;\n"
        "    /** a comment with a ; in it */\n"
        "    owner_id: string | null;\n"
        '    kind?: "a" | "b";\n'
        "    results: Record<\n        string,\n        {correct: number; total: number}\n    >;\n"
        '    detail?: import("../types").Detail | null;\n'
        "}\n"
    )
    fields = {field.name: field for field in dexie.row_interfaces(source)["ThingRow"]}
    assert list(fields) == ["id", "owner_id", "kind", "results", "detail"]
    assert (fields["id"].type, fields["id"].optional) == ("string", False)
    assert (fields["owner_id"].type, fields["owner_id"].optional) == ("string", True)
    assert (fields["kind"].type, fields["kind"].optional) == ("string", True)
    assert fields["results"].type == "Record"
    assert (fields["detail"].type, fields["detail"].optional) == ("Detail", True)


def test_browser_database_marks_keys_and_index_entries() -> None:
    db_source = (
        "class Db extends Dexie {\n"
        '    things!: EntityTable<ThingRow, "id">;\n'
        "    constructor() {\n"
        '        this.version(1).stores({things: "id, &owner_id, [owner_id+kind]"});\n'
        "    }\n}\n"
    )
    rows_source = "export interface ThingRow {\n    id: string;\n    owner_id: string;\n    kind: string;\n}\n"
    database = dexie.browser_database(db_source, rows_source)
    columns = {column.name: column for column in database.entities["things"].columns}
    assert columns["id"].primary and not columns["id"].unique
    assert columns["owner_id"].unique
    assert columns["owner_id"].note == "&owner_id, [owner_id+kind]"
    assert columns["kind"].note == "[owner_id+kind]"
    assert database.versions == 1


def test_browser_database_fails_closed_when_a_declared_table_has_no_store() -> None:
    db_source = (
        "class Db extends Dexie {\n"
        '    things!: EntityTable<ThingRow, "id">;\n'
        '    others!: EntityTable<ThingRow, "id">;\n'
        "    constructor() {\n"
        '        this.version(1).stores({things: "id"});\n'
        "    }\n}\n"
    )
    rows_source = "export interface ThingRow {\n    id: string;\n}\n"
    with pytest.raises(SchemaReadError, match="others"):
        dexie.browser_database(db_source, rows_source)


def test_real_dexie_schema_resolves_to_the_stores_the_database_class_declares() -> None:
    """The robustness measurement of #3828: every ``version()`` of db.ts is
    read, and the final schema names exactly the declared tables, each with
    the primary key its ``EntityTable`` declares."""
    db_source = DB_TS.read_text(encoding="utf-8")
    versions = dexie.dexie_versions(db_source)
    declared = dexie.entity_tables(db_source)

    assert len(versions) == db_source.count("this.version(")
    assert set(dexie.final_stores(versions)) == set(declared)
    database = dexie.browser_database(db_source, ROWS_TS.read_text(encoding="utf-8"))
    for store, (_, key) in declared.items():
        primary = [column.name for column in database.entities[store].columns if column.primary]
        assert primary == [key], store


# --- SQLAlchemy metadata -----------------------------------------------------


def _server_metadata() -> MetaData:
    metadata = MetaData()
    Table("users", metadata, Column("id", String, primary_key=True))
    Table(
        "notes",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, ForeignKey("users.id"), nullable=False),
        Column("lesson_id", String, nullable=False),
    )
    Table(
        "profiles",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, ForeignKey("users.id"), nullable=True, unique=True),
        Column("rank", Integer),
    )
    return metadata


def test_server_edges_come_from_the_declared_foreign_keys() -> None:
    database = server_reader.server_database(_server_metadata())
    edges = {(edge.child, edge.field): edge for edge in database.edges}
    assert set(edges) == {("notes", "user_id"), ("profiles", "user_id")}
    notes = edges[("notes", "user_id")]
    assert (notes.parent, notes.declared, notes.one_to_one, notes.optional) == (
        "users",
        True,
        False,
        False,
    )
    profiles = edges[("profiles", "user_id")]
    assert (profiles.one_to_one, profiles.optional) == (True, True)
    note_columns = {column.name: column for column in database.entities["notes"].columns}
    assert note_columns["user_id"].foreign == "users"
    assert note_columns["lesson_id"].foreign is None


def test_relationship_without_a_foreign_key_is_a_finding() -> None:
    class Base(DeclarativeBase):
        pass

    class Parent(Base):
        __tablename__ = "parents"
        id: Mapped[str] = mapped_column(String, primary_key=True)

    class Child(Base):
        __tablename__ = "children"
        id: Mapped[str] = mapped_column(String, primary_key=True)
        parent_ref: Mapped[str] = mapped_column(String)
        parent: Mapped[Parent] = relationship(
            Parent, primaryjoin="foreign(Child.parent_ref) == Parent.id"
        )

    Base.registry.configure()
    findings = server_reader.relationship_findings(Base.registry.mappers)
    assert len(findings) == 1
    assert "children.parent" in findings[0] and "parent_ref" in findings[0]


# --- the mapping and what it must resolve ------------------------------------


AREA_YAML = """
areas:
  - key: people
    title: {en: People}
    summary: {en: Who uses the app.}
    tables: [users, profiles]
    stores: {users: users, profiles: profiles}
  - key: writing
    title: {en: Writing}
    summary: {en: What they write.}
    tables: [notes]
    stores: {notes: notes, drafts: null}
server_fields:
  notes.lesson_id: {external: id of a lesson in a content set}
browser_fields:
  profiles.user_id: {store: users}
  notes.user_id: {store: users}
  notes.lesson_id: {external: id of a lesson in a content set}
  drafts.note_id: {store: notes}
"""


def _browser_source() -> tuple[str, str]:
    db_source = (
        "class Db extends Dexie {\n"
        '    users!: EntityTable<UserRow, "id">;\n'
        '    profiles!: EntityTable<ProfileRow, "id">;\n'
        '    notes!: EntityTable<NoteRow, "id">;\n'
        '    drafts!: EntityTable<DraftRow, "id">;\n'
        "    constructor() {\n"
        '        this.version(1).stores({users: "id", profiles: "id, &user_id", notes: "id, user_id", drafts: "id"});\n'
        "    }\n}\n"
    )
    rows_source = (
        "export interface UserRow {\n    id: string;\n}\n"
        "export interface ProfileRow {\n    id: string;\n    user_id: string | null;\n}\n"
        "export interface NoteRow {\n    id: string;\n    user_id: string;\n    lesson_id: string;\n}\n"
        "export interface DraftRow {\n    id: string;\n    note_id?: string;\n}\n"
    )
    return db_source, rows_source


def _model(tmp_path: Path, mapping_yaml: str = AREA_YAML) -> tuple[DataModel, list[str]]:
    path = tmp_path / "areas.yaml"
    path.write_text(mapping_yaml, encoding="utf-8")
    mapping = mapping_rules.load_mapping(path, ("en",))
    return mapping_rules.assemble(
        server_reader.server_database(_server_metadata()),
        dexie.browser_database(*_browser_source()),
        mapping,
    )


def test_a_complete_mapping_resolves_without_findings(tmp_path: Path) -> None:
    model, findings = _model(tmp_path)
    assert findings == []
    browser_edges = {
        (edge.child, edge.field, edge.parent, edge.declared) for edge in model.browser.edges
    }
    assert browser_edges == {
        ("profiles", "user_id", "users", False),
        ("notes", "user_id", "users", False),
        ("drafts", "note_id", "notes", False),
    }
    profile = next(edge for edge in model.browser.edges if edge.child == "profiles")
    assert profile.one_to_one and profile.optional


@pytest.mark.parametrize(
    ("old", "new", "expected"),
    [
        pytest.param(
            "server_fields:\n  notes.lesson_id: {external: id of a lesson in a content set}\n",
            "server_fields: {}\n",
            "server: notes.lesson_id",
            id="server-id-column-without-foreign-key-or-entry",
        ),
        pytest.param(
            "  notes.user_id: {store: users}\n",
            "",
            "browser: notes.user_id",
            id="browser-id-field-without-entry",
        ),
        pytest.param(
            "tables: [notes]",
            "tables: []",
            "server: table notes belongs to no area",
            id="table-without-area",
        ),
        pytest.param(
            "tables: [notes]",
            "tables: [notes, users]",
            "server: table users belongs to 2 areas",
            id="table-in-two-areas",
        ),
        pytest.param(
            "tables: [notes]",
            "tables: [notes, ghosts]",
            "server: area writing names table ghosts",
            id="area-names-unknown-table",
        ),
        pytest.param(
            "drafts: null}",
            "drafts: null, ghosts: null}",
            "browser: area writing names store ghosts",
            id="area-names-unknown-store",
        ),
        pytest.param(
            "  drafts.note_id: {store: notes}\n",
            "  drafts.note_id: {store: notes}\n  drafts.gone_id: {external: x}\n",
            "browser: drafts.gone_id",
            id="entry-for-a-field-that-does-not-exist",
        ),
        pytest.param(
            "server_fields:\n",
            "server_fields:\n  notes.user_id: {external: x}\n",
            "server: notes.user_id has a foreign key",
            id="entry-for-a-declared-foreign-key",
        ),
        pytest.param(
            "  drafts.note_id: {store: notes}\n",
            "  drafts.note_id: {store: memos}\n",
            "browser: drafts.note_id refers to memos",
            id="reference-to-unknown-store",
        ),
        pytest.param(
            "{users: users, profiles: profiles}",
            "{users: users, profiles: notes}",
            "store profiles stands for table notes",
            id="counterpart-in-another-area",
        ),
        pytest.param(
            "  profiles.user_id: {store: users}\n",
            "  profiles.user_id: {store: notes}\n",
            "browser: profiles.user_id refers to notes, but the server column profiles.user_id refers to users",
            id="browser-reference-contradicts-server-foreign-key",
        ),
    ],
)
def test_a_gap_or_contradiction_in_the_mapping_is_a_finding(
    tmp_path: Path, old: str, new: str, expected: str
) -> None:
    assert old in AREA_YAML, "the test's anchor text is gone from the fixture"
    _, findings = _model(tmp_path, AREA_YAML.replace(old, new, 1))
    assert any(expected in finding for finding in findings), findings


@pytest.mark.parametrize(
    "broken",
    [
        pytest.param("areas: []\n", id="no-area"),
        pytest.param(
            AREA_YAML.replace("title: {en: People}", "title: {de: Leute}"),
            id="title-missing-a-locale",
        ),
        pytest.param(
            AREA_YAML.replace(
                "{external: id of a lesson in a content set}\nbrowser", "{external: ''}\nbrowser"
            ),
            id="external-without-reason",
        ),
        pytest.param(
            AREA_YAML.replace(
                "drafts.note_id: {store: notes}", "drafts.note_id: {store: notes, external: x}"
            ),
            id="two-kinds-in-one-entry",
        ),
        pytest.param("areas: [unclosed\n", id="not-yaml"),
    ],
)
def test_load_mapping_fails_closed_on_a_broken_mapping(tmp_path: Path, broken: str) -> None:
    path = tmp_path / "areas.yaml"
    path.write_text(broken, encoding="utf-8")
    with pytest.raises(MappingError):
        mapping_rules.load_mapping(path, ("en",))


# --- the real model and its pages --------------------------------------------


@pytest.fixture(scope="module")
def real_model() -> DataModel:
    model, findings = erd.build_model(REPO)
    assert findings == [], findings
    return model


def test_the_frame_text_covers_every_help_locale() -> None:
    assert set(erd.TEXT) == set(help_locales(REPO / "docs" / "help"))


def test_every_relationship_appears_in_the_diagrams_of_both_its_areas(
    real_model: DataModel,
) -> None:
    """No edge may appear in no picture (#3828), and a cross-area edge shows
    in the diagram of each area it connects."""
    drawn: dict[tuple[str, str], set[tuple[str, str, str]]] = {}
    for diagram in erd.diagrams("en", real_model):
        drawn[(diagram.database, diagram.area)] = {
            (child, field, parent)
            for parent, _, _, _, child, field in RELATION_LINE.findall(diagram.code)
        }
    assert drawn, "no diagram rendered"
    for database in (real_model.server, real_model.browser):
        areas = real_model.areas_of(database.kind)
        assert database.edges, f"{database.kind}: no relationship at all"
        for edge in database.edges:
            for area in {areas[edge.child], areas[edge.parent]}:
                assert (edge.child, edge.field, edge.parent) in drawn[(database.kind, area)], (
                    database.kind,
                    area,
                    edge,
                )


def test_every_diagram_carries_acc_title_and_acc_descr_in_every_locale(
    real_model: DataModel,
) -> None:
    for lang in erd.TEXT:
        blocks = erd.diagrams(lang, real_model)
        assert len(blocks) == 2 * len(real_model.mapping.areas)
        for block in blocks:
            assert re.search(r"^\s*accTitle: \S", block.code, re.M), (lang, block.area)
            assert re.search(r"^\s*accDescr: \S", block.code, re.M), (lang, block.area)


def test_identifiers_are_the_same_in_every_locale(real_model: DataModel) -> None:
    """Only the frame text is translated; entities, fields and relationships
    stay identifiers."""

    def structure(lang: str) -> list[str]:
        return [
            "\n".join(
                line for line in block.code.splitlines() if not line.strip().startswith("acc")
            )
            for block in erd.diagrams(lang, real_model)
        ]

    english = structure("en")
    for lang in erd.TEXT:
        assert structure(lang) == english, lang


def test_every_table_and_store_is_drawn_with_its_attributes_once(real_model: DataModel) -> None:
    for database in (real_model.server, real_model.browser):
        owners = [
            name
            for diagram in erd.diagrams("en", real_model)
            if diagram.database == database.kind
            for name in re.findall(r"^\s*(\w+) \{$", diagram.code, re.M)
        ]
        assert sorted(owners) == sorted(database.entities), database.kind


def test_committed_pages_match_the_sources(capsys: pytest.CaptureFixture[str]) -> None:
    assert erd.main(["--check", "--root", str(REPO)]) == erd.EXIT_OK, capsys.readouterr().out


def test_check_reports_what_it_measured(
    capsys: pytest.CaptureFixture[str], real_model: DataModel
) -> None:
    erd.main(["--check", "--root", str(REPO)])
    out = capsys.readouterr().out
    assert f"{len(real_model.server.entities)} tables" in out
    assert f"{len(real_model.browser.entities)} stores" in out
    assert f"{len(erd.TEXT)} pages" in out


# --- --check and the write path on a scratch tree ----------------------------


def _scratch_root(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    for rel in (
        "scripts/data_model_areas.yaml",
        "frontend/src/storage/dexie/db.ts",
        "frontend/src/storage/dexie/db-rows.ts",
    ):
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / rel, root / rel)
    for lang in erd.TEXT:
        rel = erd.page_rel(lang)
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / rel, root / rel)
    return root


def test_check_names_a_stale_page(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    root = _scratch_root(tmp_path)
    page = root / erd.page_rel("de")
    page.write_text(page.read_text(encoding="utf-8") + "\nhand edit\n", encoding="utf-8")
    assert erd.main(["--check", "--root", str(root)]) == erd.EXIT_FINDINGS
    assert erd.page_rel("de") in capsys.readouterr().out


def test_check_names_a_missing_page(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    root = _scratch_root(tmp_path)
    (root / erd.page_rel("ja")).unlink()
    assert erd.main(["--check", "--root", str(root)]) == erd.EXIT_FINDINGS
    assert erd.page_rel("ja") in capsys.readouterr().out


def test_check_names_a_new_unassigned_id_field_in_a_store(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _scratch_root(tmp_path)
    rows = root / "frontend/src/storage/dexie/db-rows.ts"
    text = rows.read_text(encoding="utf-8")
    seeded = text.replace(
        "export interface TagRow {\n    id: string;\n",
        "export interface TagRow {\n    id: string;\n    seeded_owner_id: string;\n",
        1,
    )
    assert seeded != text, "the seed anchor is gone from db-rows.ts"
    rows.write_text(seeded, encoding="utf-8")
    assert erd.main(["--check", "--root", str(root)]) == erd.EXIT_FINDINGS
    assert "tags.seeded_owner_id" in capsys.readouterr().out


def test_write_refuses_while_the_mapping_has_a_gap(tmp_path: Path) -> None:
    root = _scratch_root(tmp_path)
    mapping = root / "scripts/data_model_areas.yaml"
    text = mapping.read_text(encoding="utf-8")
    gap = re.sub(r"^  userSettings\.user_id: .*\n", "", text, count=1, flags=re.M)
    assert gap != text, "the gap anchor is gone from the mapping"
    mapping.write_text(gap, encoding="utf-8")
    page = root / erd.page_rel("en")
    page.write_text("stale\n", encoding="utf-8")
    assert erd.main(["--root", str(root)]) == erd.EXIT_FINDINGS
    assert page.read_text(encoding="utf-8") == "stale\n"


@pytest.mark.parametrize(
    "missing",
    [
        pytest.param("scripts/data_model_areas.yaml", id="mapping"),
        pytest.param("frontend/src/storage/dexie/db.ts", id="dexie-schema"),
        pytest.param("frontend/src/storage/dexie/db-rows.ts", id="dexie-row-shapes"),
    ],
)
def test_check_fails_closed_when_a_source_is_missing(tmp_path: Path, missing: str) -> None:
    root = _scratch_root(tmp_path)
    (root / missing).unlink()
    assert erd.main(["--check", "--root", str(root)]) == erd.EXIT_FAIL_CLOSED


def test_check_fails_closed_outside_a_git_checkout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    assert erd.main(["--check"]) == erd.EXIT_FAIL_CLOSED
