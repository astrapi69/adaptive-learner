"""Read the server database from the SQLAlchemy metadata (#3828).

Tables, columns, foreign keys and ``relationship()`` are introspected from
``Base.metadata`` and the mappers, never parsed as text.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from data_model_types import SERVER, Column, Database, Edge, Entity, SchemaReadError
from sqlalchemy import MetaData, Table, UniqueConstraint


def _unique_columns(table: Table) -> set[str]:
    """Columns unique on their own: ``unique=True``, a one-column constraint or index."""
    unique = {column.name for column in table.columns if column.unique}
    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint) and len(constraint.columns) == 1:
            unique.update(column.name for column in constraint.columns)
    for index in table.indexes:
        if index.unique and len(index.columns) == 1:
            unique.update(column.name for column in index.columns)
    return unique


def _one_to_one_by_relationship(mappers: Iterable[Any]) -> set[tuple[str, str]]:
    """``(table, column)`` pairs a ``uselist=False`` one-to-many relationship declares single."""
    single: set[tuple[str, str]] = set()
    for mapper in mappers:
        for rel in mapper.relationships:
            if rel.direction.name == "ONETOMANY" and not rel.uselist:
                single.update(
                    (remote.table.name, remote.name) for _, remote in rel.local_remote_pairs
                )
    return single


def server_database(metadata: MetaData, mappers: Iterable[Any] = ()) -> Database:
    """The server database from SQLAlchemy metadata: tables, columns, foreign keys.

    Args:
        metadata: ``Base.metadata`` (or any ``MetaData``).
        mappers: The ORM mappers; a ``uselist=False`` relationship marks its
            foreign key one-to-one.

    Returns:
        Tables sorted by name, columns in declaration order, one edge per
        foreign-key column.
    """
    single = _one_to_one_by_relationship(mappers)
    entities: dict[str, Entity] = {}
    edges: list[Edge] = []
    for name in sorted(metadata.tables):
        entity = _table_entity(metadata.tables[name])
        entities[name] = entity
        unique = _unique_columns(metadata.tables[name])
        edges += [
            Edge(
                name,
                column.name,
                column.foreign,
                True,
                column.name in unique or (name, column.name) in single,
                column.nullable,
            )
            for column in entity.columns
            if column.foreign
        ]
    return Database(SERVER, entities, tuple(edges))


def _table_entity(table: Table) -> Entity:
    """One server table as an entity; a column may reference one table only."""
    unique = _unique_columns(table)
    columns = []
    for column in table.columns:
        targets = sorted({fk.column.table.name for fk in column.foreign_keys})
        if len(targets) > 1:
            raise SchemaReadError(f"{table.name}.{column.name} references several tables {targets}")
        columns.append(
            Column(
                name=column.name,
                type=type(column.type).__name__,
                nullable=bool(column.nullable),
                primary=column.primary_key,
                unique=column.name in unique and not column.primary_key,
                foreign=targets[0] if targets else None,
            )
        )
    return Entity(table.name, tuple(columns))


def relationship_findings(mappers: Iterable[Any]) -> list[str]:
    """Every ``relationship()`` whose join columns carry no foreign key.

    The diagrams draw foreign keys; a relationship built on a column without
    one would be a relationship the diagrams cannot show.
    """
    findings = []
    for mapper in mappers:
        for rel in mapper.relationships:
            for local, remote in rel.local_remote_pairs:
                if not (local.foreign_keys or remote.foreign_keys):
                    findings.append(
                        f"server: relationship {mapper.local_table.name}.{rel.key} joins "
                        f"{local.table.name}.{local.name} = {remote.table.name}.{remote.name}, "
                        "which carries no foreign key"
                    )
    return findings


def load_server(root: Path) -> tuple[MetaData, list[Any]]:
    """Import the models of ``root`` and return their metadata and mappers.

    The import binds ``app.database``; ``ADAPTIVE_LEARNER_TEST=1`` is set first
    so the engine is the in-memory test database, never a real data dir
    (lessons/core.md "Never run an ad-hoc script against the real SessionLocal").

    Raises:
        SchemaReadError: when the models cannot be imported.
    """
    os.environ["ADAPTIVE_LEARNER_TEST"] = "1"
    backend = str(root / "backend")
    if backend not in sys.path:
        sys.path.insert(0, backend)
    try:
        import app.models  # noqa: F401 - registers every model on Base
        from app.database import Base
    except Exception as exc:  # any import failure means: nothing was read
        raise SchemaReadError(f"cannot import the models from {backend}: {exc}") from exc
    return Base.metadata, list(Base.registry.mappers)
