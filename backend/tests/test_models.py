"""Phase 1B model tests.

Covers: instantiation, default values, relationships (forward + back),
self-referential tree on :class:`LearningTopic`, cascade-delete
semantics, the ``unique`` constraints on :class:`User.email` and
:class:`UserSettings.user_id`.
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import (
    Curriculum,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    MethodSwitch,
    ProgressCommit,
    SessionMessage,
    SessionNote,
    SessionRating,
    User,
    UserSettings,
)


@pytest.fixture()
def db():
    """Session per test; autouse ``setup_db`` fixture in conftest
    drops + recreates every table around it."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def user(db) -> User:
    u = User(name="Aster", email="aster@example.com", language="de")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def project(db, user) -> LearningProject:
    p = LearningProject(
        user_id=user.id,
        topic="Adaptive learning",
        goal="Ship the MVP",
        timeframe="4 weeks",
        daily_minutes=45,
        current_problem="Lose focus after 20 minutes.",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# --- User / UserSettings ---------------------------------------------------


def test_user_defaults(db):
    u = User(name="Sam")
    db.add(u)
    db.commit()
    db.refresh(u)
    assert u.id and len(u.id) == 36  # str(uuid4()) is 36 chars
    assert u.language == "de"
    assert u.email is None
    assert u.created_at is not None
    assert u.updated_at is not None


def test_user_email_unique(db):
    db.add(User(name="A", email="dup@example.com"))
    db.commit()
    db.add(User(name="B", email="dup@example.com"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_user_settings_one_to_one(db, user):
    s = UserSettings(user_id=user.id, active_provider="openai")
    db.add(s)
    db.commit()
    db.refresh(user)
    assert user.settings is s
    assert s.user is user
    assert s.active_provider == "openai"
    assert s.api_key_anthropic is None  # encrypted-string column, Phase 1C


def test_user_settings_user_id_unique(db, user):
    db.add(UserSettings(user_id=user.id))
    db.commit()
    db.add(UserSettings(user_id=user.id))
    with pytest.raises(IntegrityError):
        db.commit()


def test_user_settings_default_provider(db, user):
    s = UserSettings(user_id=user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.active_provider == "anthropic"


# --- LearningProject --------------------------------------------------------


def test_project_requires_user(db):
    p = LearningProject(
        user_id="does-not-exist",
        topic="x",
        goal="y",
        timeframe="z",
        daily_minutes=30,
    )
    db.add(p)
    with pytest.raises(IntegrityError):
        db.commit()


def test_project_defaults(db, project):
    assert project.active is True
    assert project.current_problem == "Lose focus after 20 minutes."
    assert project.user.name == "Aster"


def test_project_cascade_delete(db, user, project):
    project_id = project.id
    db.delete(user)
    db.commit()
    assert db.query(LearningProject).filter_by(id=project_id).one_or_none() is None


# --- LearningProfile --------------------------------------------------------


def test_profile_dominant_method(db, user, project):
    p = LearningProfile(
        user_id=user.id,
        project_id=project.id,
        deductive=0.1,
        inductive=0.2,
        error_based=0.7,
        dialogic=0.3,
        contextual=0.4,
        ai_adaptive=0.5,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    assert p.dominant_method == "error_based"
    assert p.version == 1


def test_profile_version_bump(db, user, project):
    a = LearningProfile(user_id=user.id, project_id=project.id, version=1)
    b = LearningProfile(user_id=user.id, project_id=project.id, version=2)
    db.add_all([a, b])
    db.commit()
    db.refresh(project)
    assert {p.version for p in project.profiles} == {1, 2}


# --- Curriculum / topic tree / lessons -------------------------------------


def test_curriculum_with_lessons(db, user):
    c = Curriculum(user_id=user.id, title="Python", language="en")
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add_all(
        [
            Lesson(curriculum_id=c.id, title="L1", order_index=1),
            Lesson(curriculum_id=c.id, title="L2", order_index=2),
        ]
    )
    db.commit()
    db.refresh(c)
    assert [l.title for l in c.lessons] == ["L1", "L2"]


def test_topic_tree_self_reference(db, user):
    c = Curriculum(user_id=user.id, title="DS")
    db.add(c)
    db.commit()
    root = LearningTopic(curriculum_id=c.id, title="Trees", order_index=1)
    db.add(root)
    db.commit()
    db.refresh(root)
    child_a = LearningTopic(
        curriculum_id=c.id, parent_id=root.id, title="Binary trees", order_index=1
    )
    child_b = LearningTopic(
        curriculum_id=c.id, parent_id=root.id, title="B-trees", order_index=2
    )
    db.add_all([child_a, child_b])
    db.commit()
    db.refresh(root)
    assert {child.title for child in root.children} == {"Binary trees", "B-trees"}
    assert child_a.parent is root


def test_topic_parent_set_null_on_parent_delete(db, user):
    c = Curriculum(user_id=user.id, title="Algo")
    db.add(c)
    db.commit()
    parent = LearningTopic(curriculum_id=c.id, title="Sorting")
    db.add(parent)
    db.commit()
    db.refresh(parent)
    child = LearningTopic(curriculum_id=c.id, parent_id=parent.id, title="Quicksort")
    db.add(child)
    db.commit()
    # Hard-delete the parent topic directly (not via curriculum cascade).
    db.delete(parent)
    db.commit()
    db.refresh(child)
    assert child.parent_id is None  # SET NULL, not cascade


def test_curriculum_cascade_drops_topics_and_lessons(db, user):
    c = Curriculum(user_id=user.id, title="JS")
    db.add(c)
    db.commit()
    db.add_all(
        [
            LearningTopic(curriculum_id=c.id, title="Closures"),
            Lesson(curriculum_id=c.id, title="Async"),
        ]
    )
    db.commit()
    db.delete(c)
    db.commit()
    assert db.query(LearningTopic).count() == 0
    assert db.query(Lesson).count() == 0


# --- LearningSession + children --------------------------------------------


def test_session_with_messages_and_rating(db, project):
    s = LearningSession(project_id=project.id, method="deductive")
    db.add(s)
    db.commit()
    db.refresh(s)
    db.add_all(
        [
            SessionMessage(session_id=s.id, role="system", content="System prompt"),
            SessionMessage(session_id=s.id, role="user", content="Hello"),
            SessionMessage(session_id=s.id, role="assistant", content="Hi there"),
            SessionRating(
                session_id=s.id,
                understanding=4,
                stress=2,
                method_fit=5,
                notes="Felt productive.",
            ),
            SessionNote(session_id=s.id, content="Re-read chapter 3."),
        ]
    )
    db.commit()
    db.refresh(s)
    assert [m.role for m in s.messages] == ["system", "user", "assistant"]
    assert len(s.ratings) == 1
    assert s.ratings[0].understanding == 4
    assert len(s.notes) == 1


def test_session_defaults(db, project):
    s = LearningSession(project_id=project.id, method="inductive")
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.status == "active"
    assert s.cycle_step == 1
    assert s.ended_at is None


def test_session_cascade_wipes_messages_ratings_notes(db, project):
    s = LearningSession(project_id=project.id, method="error_based")
    db.add(s)
    db.commit()
    db.refresh(s)
    db.add_all(
        [
            SessionMessage(session_id=s.id, role="user", content="x"),
            SessionRating(session_id=s.id, understanding=3, stress=3, method_fit=3),
            SessionNote(session_id=s.id, content="n"),
        ]
    )
    db.commit()
    db.delete(s)
    db.commit()
    assert db.query(SessionMessage).count() == 0
    assert db.query(SessionRating).count() == 0
    assert db.query(SessionNote).count() == 0


# --- ProgressCommit / MethodSwitch -----------------------------------------


def test_progress_commit_links_to_project_and_session(db, project):
    s = LearningSession(project_id=project.id, method="dialogic")
    db.add(s)
    db.commit()
    db.refresh(s)
    pc = ProgressCommit(
        project_id=project.id,
        session_id=s.id,
        method="dialogic",
        understanding=0.6,
        stress=0.3,
        error_rate=0.2,
        duration_minutes=30,
    )
    db.add(pc)
    db.commit()
    db.refresh(project)
    assert pc in project.progress_commits
    assert pc.session is s


def test_method_switch(db, project):
    sw = MethodSwitch(
        project_id=project.id,
        from_method="deductive",
        to_method="dialogic",
        reason="User stress trending up over 3 sessions.",
    )
    db.add(sw)
    db.commit()
    db.refresh(project)
    assert sw in project.method_switches
    assert sw.switched_at is not None
