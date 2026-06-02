"""Production data-dir guard against accidental destructive writes.

``backend/tests/conftest.py`` already protects PYTEST runs from
touching a production-marked data dir (the ``.adaptive-learner-production``
marker + a hard ``pytest.exit``). This module extends that protection
to EVERY process: an ad-hoc ``poetry run python`` script, a REPL, a
maintenance one-liner, a copied-out test helper.

It installs a SQLAlchemy engine listener that refuses *full-table*
``DELETE`` / ``DROP`` / ``TRUNCATE`` statements when BOTH:

1. the active data dir carries the production marker, AND
2. the process is not the sanctioned application runtime.

Scoped deletes (``DELETE ... WHERE ...``) — the app's normal write
path — are never touched, so the running app is unaffected.

The application opts in to "I am allowed to write here" by calling
:func:`mark_app_runtime` from the FastAPI lifespan. Ad-hoc scripts
and tests never run the lifespan, so the flag stays off for them.
Intentional maintenance against production (a deliberate wipe, an
``alembic`` downgrade) sets ``ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE=1``
to bypass the guard explicitly.

Origin: BACKUP-API-RESTORE-01 session, 2026-06-02. A diagnostic
script bound to the real ``SessionLocal`` (no ``ADAPTIVE_LEARNER_TEST``
set) ran a bulk ``DELETE FROM <every table>`` against the production
DB. The conftest tripwire didn't fire because it only guards pytest;
nothing else did. This module is that missing layer.
"""

from __future__ import annotations

import logging
import os
import re

from sqlalchemy.engine import Engine

from app.paths import PRODUCTION_MARKER_FILENAME, get_data_dir

logger = logging.getLogger(__name__)

# Set True by the FastAPI lifespan via mark_app_runtime(). The real
# application is allowed to delete from its own production data dir;
# the guard only targets code that is NEVER supposed to run there.
_APP_RUNTIME = False

_OVERRIDE_ENV = "ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE"

# A full-table wipe / schema teardown. A leading "DELETE FROM <name>"
# with NO WHERE clause is the bulk-wipe shape (``Query.delete()`` emits
# exactly this); DROP / TRUNCATE are always destructive.
_DELETE_NO_WHERE = re.compile(r"^DELETE\s+FROM\s+[^\s]+\s*$", re.IGNORECASE)
_DROP_OR_TRUNCATE = re.compile(r"^(DROP\s+TABLE|TRUNCATE)\b", re.IGNORECASE)


class ProductionDataGuardError(RuntimeError):
    """Raised when a destructive statement targets a production data dir
    from outside the sanctioned application runtime."""


def mark_app_runtime() -> None:
    """Signal that THIS process is the real application runtime.

    Called once from the FastAPI lifespan. After this, the guard lets
    destructive statements through (the app may legitimately purge its
    own data — trash sweeps, the debug-only reset endpoint, ...)."""
    global _APP_RUNTIME
    _APP_RUNTIME = True


def is_production_data_dir() -> bool:
    """True if the active data dir carries the production marker."""
    return (get_data_dir() / PRODUCTION_MARKER_FILENAME).exists()


def _override_enabled() -> bool:
    return os.environ.get(_OVERRIDE_ENV) == "1"


def _is_destructive_statement(statement: str) -> bool:
    """True for a full-table DELETE (no WHERE), DROP TABLE, or TRUNCATE.

    Whitespace is normalised first so multi-line ORM-emitted SQL is
    matched the same as a one-liner."""
    normalized = " ".join(statement.strip().split())
    return bool(_DELETE_NO_WHERE.match(normalized) or _DROP_OR_TRUNCATE.match(normalized))


def assert_safe_for_destructive_use(operation: str = "destructive operation") -> None:
    """Raise if ``operation`` would hit a production-marked data dir.

    Manual guard for code that must NEVER run against production:
    test helpers that wipe tables, ad-hoc maintenance scripts, repros.
    The application's own write path does NOT call this — it is allowed
    to write to its own data dir.
    """
    if _override_enabled():
        return
    if is_production_data_dir():
        raise ProductionDataGuardError(
            f"Refusing {operation}: the active data dir is production-marked "
            f"({get_data_dir() / PRODUCTION_MARKER_FILENAME}). This code path "
            f"must never touch production data. Point ADAPTIVE_LEARNER_DATA_DIR "
            f"at a throwaway dir (and set ADAPTIVE_LEARNER_TEST=1 for tests), or "
            f"set {_OVERRIDE_ENV}=1 to override for an intentional maintenance run."
        )


def _before_cursor_execute(
    conn,
    cursor,
    statement,
    parameters,
    context,
    executemany,  # noqa: ANN001, ARG001
) -> None:
    """Engine listener: block bulk-destructive SQL against production."""
    # The real app short-circuits with zero per-statement cost.
    if _APP_RUNTIME or _override_enabled():
        return
    # Cheap string check before the filesystem stat.
    if not _is_destructive_statement(statement):
        return
    if not is_production_data_dir():
        return
    raise ProductionDataGuardError(
        "Refusing a full-table destructive statement against a "
        f"production-marked data dir ({get_data_dir()}). Statement: "
        f"{' '.join(statement.strip().split())[:200]!r}. This process is not "
        "the application runtime (mark_app_runtime() was never called). If this "
        f"is an intentional maintenance run, set {_OVERRIDE_ENV}=1."
    )


def install(engine: Engine) -> None:
    """Attach the destructive-statement guard to ``engine``.

    Idempotent: a second call on the same engine is a no-op. Called from
    ``app.database`` right after the sync engine is created."""
    from sqlalchemy import event

    if event.contains(engine, "before_cursor_execute", _before_cursor_execute):
        return
    event.listen(engine, "before_cursor_execute", _before_cursor_execute)
