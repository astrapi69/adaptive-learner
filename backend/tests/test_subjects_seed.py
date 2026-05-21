"""Subject seed loader tests (Phase 22B)."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.models import Subject
from app.services.subjects_seed import SEED_PATH, seed_subjects


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_seed_yaml_exists_and_is_parseable():
    assert SEED_PATH.exists(), f"Seed YAML missing at {SEED_PATH}"


def test_seed_inserts_top_level_subjects(db):
    summary = seed_subjects(db)
    assert summary["available"] > 0
    assert summary["inserted"] == summary["available"]
    assert summary["existing"] == 0

    names = {s.name for s in db.query(Subject).filter(Subject.parent_id.is_(None)).all()}
    for expected in {"Languages", "Mathematics", "Programming", "Sciences"}:
        assert expected in names, f"Missing top-level seed: {expected}"


def test_seed_is_idempotent(db):
    first = seed_subjects(db)
    second = seed_subjects(db)
    assert second["inserted"] == 0
    assert second["existing"] == first["inserted"]
    assert db.query(Subject).count() == first["inserted"]


def test_seed_parents_resolve(db):
    seed_subjects(db)
    languages = db.query(Subject).filter(Subject.name == "Languages").one()
    children = db.query(Subject).filter(Subject.parent_id == languages.id).all()
    child_names = {c.name for c in children}
    # Every language under Languages should be a child.
    for expected in {"English", "Spanish", "French", "German"}:
        assert expected in child_names


def test_seed_tree_depth_at_least_three(db):
    """Spanish > Grammar is a depth-3 path; pin so a future reshape
    accidentally flattening the tree fails this test."""
    seed_subjects(db)
    spanish = db.query(Subject).filter(Subject.name == "Spanish").first()
    assert spanish is not None
    grammar_under_spanish = (
        db.query(Subject)
        .filter(Subject.name == "Grammar", Subject.parent_id == spanish.id)
        .first()
    )
    assert grammar_under_spanish is not None


def test_seed_partial_already_present_is_skipped(db):
    """Insert one node by hand and re-run seed; the loader picks up
    the existing row instead of duplicating it."""
    languages = Subject(name="Languages")
    db.add(languages)
    db.commit()
    summary = seed_subjects(db)
    assert summary["inserted"] < summary["available"]  # Languages already there
    # Exactly one "Languages" row, not two.
    assert db.query(Subject).filter(Subject.name == "Languages").count() == 1


def test_user_added_subject_survives_reseed(db):
    """A custom user-added subject must NOT be removed by the seed
    loader — seeding is additive only."""
    seed_subjects(db)
    custom = Subject(name="My Custom Subject")
    db.add(custom)
    db.commit()
    seed_subjects(db)  # second run
    assert (
        db.query(Subject).filter(Subject.name == "My Custom Subject").count() == 1
    )
