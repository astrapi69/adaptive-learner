"""Alembic environment configuration for Adaptive Learner."""

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

import app.models  # noqa: F401 - ensure models are registered
from app.database import DATABASE_URL, Base

# Alembic Config object
config = context.config

# Three layers of URL precedence:
#
#   1. Caller-set ``sqlalchemy.url`` on the Config (tests do
#      ``cfg.set_main_option("sqlalchemy.url", "sqlite:///...")``).
#   2. The standard ``alembic.ini`` ``sqlalchemy.url`` setting.
#   3. The app's resolved ``DATABASE_URL`` (production fallback,
#      which also seeds the value at module import time).
#
# Reading the URL from the config (not from ``app.database.engine``)
# matters because the production app.database.engine is frozen at
# import time against the env-var URL, while tests need to point at
# a tmp file per test.
if not config.get_main_option("sqlalchemy.url"):
    config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Logging.
#
# Skip fileConfig entirely when the app has already configured
# logging. fileConfig is for the standalone `alembic` CLI use case
# where alembic.ini is the only logging source of truth. When this
# env.py runs under app.main's init_db() the FastAPI app has
# already set up handlers + level + formatter via uvicorn or its
# own basicConfig; calling fileConfig here would:
#
#   1. Reset the root-logger level to WARNING per alembic.ini's
#      [logger_root], silencing every app.main INFO line that fires
#      after init_db (plugin discovery, plugin loading, lifespan
#      shutdown). The user-visible symptom: "backend logs show no
#      plugin loading messages, only alembic plugins".
#   2. Replace the app's handler/formatter with alembic's terser
#      "LEVEL [name] msg" shape, breaking timestamp + structured
#      log discipline mid-startup.
#
# Detection: if the root logger already has handlers, the app has
# configured logging; we leave it alone. The standalone `alembic`
# CLI invokes env.py before any handler is attached, so the
# fileConfig path still fires there.
if config.config_file_name is not None and not logging.getLogger().handlers:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Model metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Required for SQLite ALTER TABLE
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Builds a fresh engine from the resolved ``sqlalchemy.url`` rather
    than reusing ``app.database.engine``: the latter is frozen at
    module import time against the env-var URL, while tests need a
    per-call URL override (``cfg.set_main_option("sqlalchemy.url",
    ...)``).
    """
    url = config.get_main_option("sqlalchemy.url")
    assert url, "alembic env.py: sqlalchemy.url is empty"
    fresh_engine = create_engine(url)
    with fresh_engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
