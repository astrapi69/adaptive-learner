"""Verify the SQLite PRAGMA event listener is active on every connection.

These checks are cheap and catch a class of regression where the
listener is silently removed: the backend keeps working on the surface,
but cascade deletes start failing, commits get slower, and concurrent
readers start blocking the writer.
"""

from pathlib import Path

from sqlalchemy import create_engine, event, text

from app.database import _set_sqlite_pragma, engine


def test_pragma_listener_is_registered_on_the_app_engine() -> None:
    assert event.contains(engine, "connect", _set_sqlite_pragma)


def test_journal_mode_is_wal_on_a_file_backed_database(tmp_path: Path) -> None:
    """#3440 - the harness runs on ``:memory:``, which cannot use WAL, so
    the old check against the app engine was skipped in every run. The
    production listener runs here on a real file instead."""
    file_engine = create_engine(f"sqlite:///{tmp_path / 'wal.db'}")
    event.listen(file_engine, "connect", _set_sqlite_pragma)
    try:
        with file_engine.connect() as conn:
            mode = conn.execute(text("PRAGMA journal_mode")).scalar()
    finally:
        file_engine.dispose()
    assert str(mode).lower() == "wal", f"expected wal, got {mode!r}"


def test_synchronous_is_normal() -> None:
    # SQLite returns the sync mode as an integer: 0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA
    with engine.connect() as conn:
        sync = conn.execute(text("PRAGMA synchronous")).scalar()
    assert int(sync) == 1, f"expected synchronous=1 (NORMAL), got {sync}"


def test_foreign_keys_enabled() -> None:
    with engine.connect() as conn:
        fk = conn.execute(text("PRAGMA foreign_keys")).scalar()
    assert int(fk) == 1, f"expected foreign_keys=1 (ON), got {fk}"
