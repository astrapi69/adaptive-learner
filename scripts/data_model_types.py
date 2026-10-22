"""The data model the ER diagrams draw (#3828): entities, edges, the mapping.

Shared by the readers (``data_model_dexie``, ``data_model_server``), the
mapping (``data_model_mapping``) and the page generator
(``generate_er_diagrams``).
"""

from __future__ import annotations

from dataclasses import dataclass

SERVER = "server"
BROWSER = "browser"


class SchemaReadError(Exception):
    """A source schema cannot be read as the generator expects (fail closed)."""


class MappingError(Exception):
    """The mapping file is missing, not YAML, or not shaped as documented."""


# --- the model ---------------------------------------------------------------


@dataclass(frozen=True)
class Column:
    """One attribute of a table or store, as the diagram shows it."""

    name: str
    type: str
    nullable: bool
    primary: bool = False
    unique: bool = False
    foreign: str | None = None
    note: str = ""


@dataclass(frozen=True)
class Entity:
    """A server table or a browser store with its attributes in source order."""

    name: str
    columns: tuple[Column, ...]

    def column(self, name: str) -> Column | None:
        """The attribute called ``name``, or None."""
        return next((column for column in self.columns if column.name == name), None)


@dataclass(frozen=True)
class Edge:
    """``child.field`` refers to ``parent``.

    ``declared`` is a foreign key in the database (a solid line); otherwise
    the mapping file records the reference (a dashed line).
    """

    child: str
    field: str
    parent: str
    declared: bool
    one_to_one: bool
    optional: bool


@dataclass(frozen=True)
class Database:
    """The server or the browser database: entities and their relationships."""

    kind: str
    entities: dict[str, Entity]
    edges: tuple[Edge, ...] = ()
    versions: int = 0
    version: int = 0


@dataclass(frozen=True)
class Rule:
    """The mapping's decision for one field: a reference, external, or unrelated."""

    kind: str
    target: str | None
    reason: str


@dataclass(frozen=True)
class Area:
    """One area of the model with its tables and stores.

    ``stores`` maps each store to the server table it stands for, or None
    when the store exists only in the browser.
    """

    key: str
    title: dict[str, str]
    summary: dict[str, str]
    tables: tuple[str, ...]
    stores: dict[str, str | None]


@dataclass(frozen=True)
class Mapping:
    """The parsed ``data_model_areas.yaml``."""

    areas: tuple[Area, ...]
    server_fields: dict[str, Rule]
    browser_fields: dict[str, Rule]


@dataclass(frozen=True)
class DataModel:
    """Both databases with every relationship resolved, plus the mapping."""

    server: Database
    browser: Database
    mapping: Mapping

    def areas_of(self, kind: str) -> dict[str, str]:
        """Entity name -> area key for the server or the browser database."""
        if kind == SERVER:
            return {table: area.key for area in self.mapping.areas for table in area.tables}
        return {store: area.key for area in self.mapping.areas for store in area.stores}

    def rules(self, kind: str) -> dict[str, Rule]:
        """The mapping's field rules for the server or the browser database."""
        return self.mapping.server_fields if kind == SERVER else self.mapping.browser_fields
