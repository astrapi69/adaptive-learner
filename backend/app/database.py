import logging
import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def _resolve_database_url() -> str:
    """Decide which database URL to hand to SQLAlchemy.

    Priority (highest wins):
    1. ADAPTIVE_LEARNER_TEST=1 forces a test-only URL. TEST_DATABASE_URL may
       override; default is sqlite:///:memory:. When ADAPTIVE_LEARNER_TEST is
       set, it is IMPOSSIBLE to reach the production DB from this
       function, which is the whole point (see tests/conftest.py and
       tests/test_test_isolation.py).
    2. DATABASE_URL env var is honoured verbatim.
    3. ADAPTIVE_LEARNER_DATA_DIR derivation: when set, the database path is
       derived as ``<ADAPTIVE_LEARNER_DATA_DIR>/adaptive_learner.db``.
    4. Default falls through to ``app.paths.get_db_path()`` which
       uses platformdirs for the canonical OS-specific data directory.

    DEP-DBPATH-01 step 3 (full removal): the legacy
    ``ADAPTIVE_LEARNER_DB_PATH`` env var is no longer honoured as a path
    override. If it is still set in the environment, the resolver
    emits a single warning naming the ignored value so the user can
    see it has no effect, then resolves the path through the normal
    DATA_DIR / platformdirs chain. Step 1 (deprecation warning)
    shipped in v0.27.0; step 2 (precedence flip) shipped in v0.28.0;
    this is the final removal.
    """
    if os.getenv("ADAPTIVE_LEARNER_TEST") == "1":
        return os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    if explicit := os.getenv("DATABASE_URL"):
        return explicit
    if db_path_override := os.getenv("ADAPTIVE_LEARNER_DB_PATH"):
        logger.warning(
            "ADAPTIVE_LEARNER_DB_PATH=%s is set but is no longer honoured as of "
            "the v0.30.0 deprecation removal (DEP-DBPATH-01 step 3). The "
            "database path is determined by ADAPTIVE_LEARNER_DATA_DIR or the "
            "platformdirs default. Remove ADAPTIVE_LEARNER_DB_PATH from your "
            "environment; this warning will be removed in a later release.",
            db_path_override,
        )
    # Late import: app.paths import is cheap but keeping it inside
    # the function preserves the historical "database.py imports
    # are minimal" property and avoids any circular-import risk
    # with future paths.py extensions.
    from app.paths import get_db_path

    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"


DATABASE_URL = _resolve_database_url()


def _engine_kwargs(url: str) -> dict:
    """SQLAlchemy engine options. In-memory SQLite needs a StaticPool so
    every SessionLocal() call sees the same ephemeral database; the
    default QueuePool hands out independent connections and each one
    gets its own fresh :memory: database, which is fine for a single
    test but breaks autouse create_all/drop_all and FastAPI's DI."""
    kwargs: dict = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in url:
        from sqlalchemy.pool import StaticPool

        kwargs["poolclass"] = StaticPool
    return kwargs


engine = create_engine(DATABASE_URL, **_engine_kwargs(DATABASE_URL))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _async_database_url(url: str) -> str:
    """Translate a sync SQLAlchemy URL to its async-driver equivalent.

    Adaptive Learner ships SQLite as the only supported backend, so
    we only have to handle the ``sqlite://`` -> ``sqlite+aiosqlite://``
    case. Any other URL passes through untouched (the deployer is on
    their own to use a compatible async driver).
    """
    if url.startswith("sqlite:///") and "+aiosqlite" not in url:
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    if url.startswith("sqlite://") and "+aiosqlite" not in url:
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


def _async_engine_kwargs(url: str) -> dict:
    """StaticPool for in-memory async too, so every async session
    sees the same ephemeral DB. ``check_same_thread=False`` is not
    a concern for aiosqlite (it runs queries in a single dispatcher
    thread) but we keep it for parity with the sync engine."""
    kwargs: dict = {}
    if ":memory:" in url:
        from sqlalchemy.pool import StaticPool

        kwargs["poolclass"] = StaticPool
        kwargs["connect_args"] = {"check_same_thread": False}
    return kwargs


# v1.5.0 — async engine + session maker (Phase 18A). Lives ALONGSIDE
# the sync infrastructure so existing routes / tests stay unchanged.
# New async routes use ``get_async_db`` as their DI dependency.
async_engine = create_async_engine(
    _async_database_url(DATABASE_URL), **_async_engine_kwargs(DATABASE_URL)
)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, expire_on_commit=False, autoflush=False, class_=AsyncSession
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):  # noqa: ARG001
    """Enable WAL + NORMAL sync + foreign keys on every new connection.

    WAL gives us concurrent readers without blocking the writer, which
    matters as soon as background jobs (audiobook, export) run alongside
    the editor saving chapters. synchronous=NORMAL is durable enough for
    a single-user desktop app and avoids the per-commit fsync cost of
    synchronous=FULL. foreign_keys=ON is the SQLite default-that-isn't;
    without it, ON DELETE CASCADE is ignored.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """FastAPI dependency: an :class:`AsyncSession` scoped to one
    request. Mirrors :func:`get_db` for the v1.5.0 async path. Routes
    that need async DB access (currently: nothing in core; reserved
    for plugins that opt in) use this instead of ``get_db``."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def init_db():
    """Initialize database using Alembic migrations.

    For new databases, creates all tables and stamps the alembic version.
    For existing databases, runs any pending migrations.
    """
    from alembic import command
    from alembic.config import Config

    import app.models  # noqa: F401 - ensure models are registered

    alembic_cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(_BACKEND_DIR / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    # Fresh database when there is no alembic version table yet:
    # create whatever ``Base.metadata`` carries (skeleton state =
    # empty) and stamp head. Otherwise upgrade to head.
    from sqlalchemy import inspect

    inspector = inspect(engine)
    has_alembic = inspector.has_table("alembic_version")

    if not has_alembic:
        Base.metadata.create_all(bind=engine)
        command.stamp(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")
