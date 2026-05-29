"""Tests for the export data aggregation service (Phase 16A).

Covers:

- ``build_progress_report`` aggregates profile, projects, sessions,
  method distribution, step-evaluation insights, extractions.
- ``build_session_detail`` returns full transcript + ratings +
  step-evaluation timeline.
- ``build_curriculum_overview`` returns topic tree (depth-first
  with ``depth`` field) + lessons.
- Empty / missing-data cases (no profile, no commits, no
  extractions) return the right empty shape.
- Unknown ids raise NotFoundError.
- The envelope (format / version / type / generated_at /
  app_version) is consistent across all three builders.
- API keys never leak (the export only touches non-secret
  columns).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from app.exceptions import NotFoundError
from app.models import (
    Curriculum,
    ImportedConversation,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    MethodSwitch,
    ProgressCommit,
    SessionMessage,
    SessionRating,
    StepEvaluation,
    User,
)
from app.services.export_service import (
    EXPORT_FORMAT,
    EXPORT_VERSION,
    build_curriculum_overview,
    build_progress_report,
    build_session_detail,
)

# ---- Fixtures --------------------------------------------------------------


@pytest.fixture()
def db_session():
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _seed_minimal_user(db) -> User:
    user = User(name="Aster", language="de")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _seed_user_with_project(db) -> tuple[User, LearningProject]:
    user = _seed_minimal_user(db)
    project = LearningProject(
        user_id=user.id,
        topic="Bayes-Statistik",
        goal="Master it",
        timeframe="2 weeks",
        daily_minutes=30,
        current_problem="Math basics",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return user, project


def _seed_full_progress(db, user, project) -> LearningSession:
    """Add profile + session + rating + commit + step-eval."""
    profile = LearningProfile(
        user_id=user.id,
        project_id=project.id,
        deductive=0.7,
        inductive=0.4,
        error_based=0.2,
        dialogic=0.6,
        contextual=0.5,
        ai_adaptive=0.3,
    )
    db.add(profile)
    db.flush()

    session = LearningSession(
        project_id=project.id,
        method="deductive",
        started_at=datetime(2026, 5, 1, 10, 0, tzinfo=UTC),
        ended_at=datetime(2026, 5, 1, 10, 30, tzinfo=UTC),
        cycle_step=7,
        status="completed",
    )
    db.add(session)
    db.flush()

    db.add(SessionMessage(session_id=session.id, role="user", content="Hello"))
    db.add(SessionMessage(session_id=session.id, role="assistant", content="Hi"))
    db.add(
        SessionRating(
            session_id=session.id,
            understanding=4,
            stress=2,
            method_fit=5,
            notes="Felt clear",
        )
    )
    db.add(
        ProgressCommit(
            project_id=project.id,
            session_id=session.id,
            method="deductive",
            understanding=0.8,
            stress=0.2,
            error_rate=0.1,
            duration_minutes=30,
        )
    )
    db.add(
        StepEvaluation(
            session_id=session.id,
            from_step=1,
            to_step=2,
            advance=True,
            confidence=0.85,
            applied=True,
            fallback_used=False,
            reason="Step understood",
        )
    )
    db.commit()
    db.refresh(session)
    return session


# ---- Envelope consistency --------------------------------------------------


def test_progress_report_envelope(db_session):
    user, _ = _seed_user_with_project(db_session)
    payload = build_progress_report(db_session, user.id)
    assert payload["format"] == EXPORT_FORMAT
    assert payload["version"] == EXPORT_VERSION
    assert payload["type"] == "progress_report"
    assert "generated_at" in payload
    assert "app_version" in payload
    assert payload["lang"] == "de"


def test_session_detail_envelope(db_session):
    user, project = _seed_user_with_project(db_session)
    session = _seed_full_progress(db_session, user, project)
    payload = build_session_detail(db_session, session.id, lang="en")
    assert payload["type"] == "session_detail"
    assert payload["lang"] == "en"
    assert payload["format"] == EXPORT_FORMAT


def test_curriculum_overview_envelope(db_session):
    user = _seed_minimal_user(db_session)
    curriculum = Curriculum(user_id=user.id, title="Intro", language="de")
    db_session.add(curriculum)
    db_session.commit()
    payload = build_curriculum_overview(db_session, curriculum.id)
    assert payload["type"] == "curriculum_overview"
    assert payload["format"] == EXPORT_FORMAT


# ---- Progress report -------------------------------------------------------


def test_progress_report_unknown_user_raises_404(db_session):
    with pytest.raises(NotFoundError):
        build_progress_report(db_session, "nonexistent-id")


def test_progress_report_user_without_data(db_session):
    user = _seed_minimal_user(db_session)
    payload = build_progress_report(db_session, user.id)
    assert payload["user"]["id"] == user.id
    assert payload["user"]["name"] == "Aster"
    assert payload["profile"] is None
    assert payload["projects"] == []
    assert payload["recent_sessions"] == []
    assert payload["step_evaluation_insights"] is None
    assert payload["extractions"] == []


def test_progress_report_includes_profile(db_session):
    user, project = _seed_user_with_project(db_session)
    _seed_full_progress(db_session, user, project)
    payload = build_progress_report(db_session, user.id)
    profile = payload["profile"]
    assert profile is not None
    assert profile["deductive"] == 0.7
    assert profile["dominant_method"] == "deductive"
    assert profile["version"] == 1


def test_progress_report_picks_latest_profile(db_session):
    """Most recent assessment wins when there are multiple."""
    user, project = _seed_user_with_project(db_session)
    older = LearningProfile(
        user_id=user.id,
        project_id=project.id,
        deductive=0.1,
        inductive=0.0,
        error_based=0.0,
        dialogic=0.0,
        contextual=0.0,
        ai_adaptive=0.0,
        assessed_at=datetime(2026, 1, 1, tzinfo=UTC),
        version=1,
    )
    newer = LearningProfile(
        user_id=user.id,
        project_id=project.id,
        deductive=0.0,
        inductive=0.9,
        error_based=0.0,
        dialogic=0.0,
        contextual=0.0,
        ai_adaptive=0.0,
        assessed_at=datetime(2026, 5, 1, tzinfo=UTC),
        version=2,
    )
    db_session.add_all([older, newer])
    db_session.commit()
    payload = build_progress_report(db_session, user.id)
    assert payload["profile"]["version"] == 2
    assert payload["profile"]["inductive"] == 0.9


def test_progress_report_project_summary(db_session):
    user, project = _seed_user_with_project(db_session)
    _seed_full_progress(db_session, user, project)
    payload = build_progress_report(db_session, user.id)
    assert len(payload["projects"]) == 1
    proj = payload["projects"][0]
    assert proj["topic"] == "Bayes-Statistik"
    assert proj["session_count"] == 1
    assert proj["total_minutes"] == 30
    assert proj["mean_understanding"] == 0.8
    assert proj["mean_stress"] == 0.2
    distribution = {entry["method"]: entry for entry in proj["method_distribution"]}
    assert distribution["deductive"]["count"] == 1
    assert distribution["deductive"]["percentage"] == 100
    assert distribution["inductive"]["count"] == 0


def test_progress_report_includes_method_switches(db_session):
    user, project = _seed_user_with_project(db_session)
    db_session.add(
        MethodSwitch(
            project_id=project.id,
            from_method="deductive",
            to_method="inductive",
            reason="Not clicking",
        )
    )
    db_session.commit()
    payload = build_progress_report(db_session, user.id)
    switches = payload["projects"][0]["method_switches"]
    assert len(switches) == 1
    assert switches[0]["from_method"] == "deductive"
    assert switches[0]["to_method"] == "inductive"


def test_progress_report_recent_sessions_newest_first(db_session):
    user, project = _seed_user_with_project(db_session)
    base = datetime(2026, 5, 1, tzinfo=UTC)
    for i in range(3):
        db_session.add(
            LearningSession(
                project_id=project.id,
                method="deductive",
                started_at=base + timedelta(days=i),
                ended_at=base + timedelta(days=i, minutes=15),
                cycle_step=7,
                status="completed",
            )
        )
    db_session.commit()
    payload = build_progress_report(db_session, user.id)
    sessions = payload["recent_sessions"]
    assert len(sessions) == 3
    # Newest first
    assert sessions[0]["started_at"] > sessions[1]["started_at"]
    assert sessions[0]["project_topic"] == "Bayes-Statistik"


def test_progress_report_step_insights_aggregates_by_from_step(db_session):
    user, project = _seed_user_with_project(db_session)
    session = _seed_full_progress(db_session, user, project)
    # Add another step-evaluation at step 1, applied=False (deferred)
    db_session.add(
        StepEvaluation(
            session_id=session.id,
            from_step=1,
            to_step=1,
            advance=False,
            confidence=0.45,
            applied=False,
            fallback_used=False,
            reason="Not ready",
        )
    )
    db_session.commit()
    payload = build_progress_report(db_session, user.id)
    insights = payload["step_evaluation_insights"]
    assert insights is not None
    step_1 = [e for e in insights if e["step"] == 1][0]
    assert step_1["count"] == 2
    assert step_1["advance_count"] == 1
    assert step_1["deferred_count"] == 1
    assert step_1["mean_confidence"] == round((0.85 + 0.45) / 2, 4)


def test_progress_report_extractions_only_includes_analyzed(db_session):
    user = _seed_minimal_user(db_session)
    analyzed = ImportedConversation(
        user_id=user.id,
        source="claude",
        title="Bayes Tutoring",
        message_count=10,
        analyzed=True,
        analysis_result=json.dumps(
            {"topic": "Bayes", "key_gaps": ["priors", "posteriors"]}
        ),
        topic_tag="bayes",
    )
    pending = ImportedConversation(
        user_id=user.id,
        source="chatgpt",
        title="Other",
        message_count=3,
        analyzed=False,
    )
    db_session.add_all([analyzed, pending])
    db_session.commit()
    payload = build_progress_report(db_session, user.id)
    assert len(payload["extractions"]) == 1
    assert payload["extractions"][0]["title"] == "Bayes Tutoring"
    assert payload["extractions"][0]["analysis"]["topic"] == "Bayes"


def test_progress_report_excludes_other_users_projects(db_session):
    user_a = User(name="A", language="de")
    user_b = User(name="B", language="de")
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.add(
        LearningProject(
            user_id=user_b.id,
            topic="Other user's project",
            goal="x",
            timeframe="1 week",
            daily_minutes=10,
        )
    )
    db_session.commit()
    payload = build_progress_report(db_session, user_a.id)
    assert payload["projects"] == []


# ---- Session detail --------------------------------------------------------


def test_session_detail_unknown_id_raises_404(db_session):
    with pytest.raises(NotFoundError):
        build_session_detail(db_session, "nonexistent-id")


def test_session_detail_full_payload(db_session):
    user, project = _seed_user_with_project(db_session)
    session = _seed_full_progress(db_session, user, project)
    payload = build_session_detail(db_session, session.id)
    assert payload["session"]["id"] == session.id
    assert payload["session"]["method"] == "deductive"
    assert payload["session"]["duration_minutes"] == 30
    assert payload["session"]["status"] == "completed"
    assert payload["project"]["topic"] == "Bayes-Statistik"
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["role"] == "user"
    assert payload["messages"][1]["role"] == "assistant"
    rating = payload["rating"]
    assert rating is not None
    assert rating["understanding"] == 4
    assert rating["stress"] == 2
    assert rating["method_fit"] == 5
    assert rating["notes"] == "Felt clear"
    assert len(payload["step_evaluations"]) == 1


def test_session_detail_unrated_session(db_session):
    user, project = _seed_user_with_project(db_session)
    session = LearningSession(
        project_id=project.id,
        method="inductive",
        started_at=datetime(2026, 5, 1, 10, 0, tzinfo=UTC),
        ended_at=None,
        cycle_step=2,
        status="active",
    )
    db_session.add(session)
    db_session.commit()
    payload = build_session_detail(db_session, session.id)
    assert payload["rating"] is None
    assert payload["messages"] == []
    assert payload["step_evaluations"] == []
    assert payload["session"]["duration_minutes"] == 0


# ---- Curriculum overview ---------------------------------------------------


def test_curriculum_overview_unknown_id_raises_404(db_session):
    with pytest.raises(NotFoundError):
        build_curriculum_overview(db_session, "nonexistent-id")


def test_curriculum_overview_empty(db_session):
    user = _seed_minimal_user(db_session)
    curriculum = Curriculum(
        user_id=user.id, title="Empty curriculum", description="Test", language="de"
    )
    db_session.add(curriculum)
    db_session.commit()
    payload = build_curriculum_overview(db_session, curriculum.id)
    assert payload["curriculum"]["title"] == "Empty curriculum"
    assert payload["topics"] == []
    assert payload["lessons"] == []


def test_curriculum_overview_topic_tree_depth(db_session):
    user = _seed_minimal_user(db_session)
    curriculum = Curriculum(user_id=user.id, title="Tree", language="de")
    db_session.add(curriculum)
    db_session.flush()

    root_a = LearningTopic(
        curriculum_id=curriculum.id, title="Root A", order_index=0
    )
    root_b = LearningTopic(
        curriculum_id=curriculum.id, title="Root B", order_index=1
    )
    db_session.add_all([root_a, root_b])
    db_session.flush()

    child_a1 = LearningTopic(
        curriculum_id=curriculum.id,
        parent_id=root_a.id,
        title="Child A.1",
        order_index=0,
    )
    db_session.add(child_a1)
    db_session.flush()

    grandchild = LearningTopic(
        curriculum_id=curriculum.id,
        parent_id=child_a1.id,
        title="Grandchild",
        order_index=0,
    )
    db_session.add(grandchild)
    db_session.commit()

    payload = build_curriculum_overview(db_session, curriculum.id)
    topics = payload["topics"]
    titles = [t["title"] for t in topics]
    depths = {t["title"]: t["depth"] for t in topics}
    # Depth-first order: Root A, Child A.1, Grandchild, Root B
    assert titles == ["Root A", "Child A.1", "Grandchild", "Root B"]
    assert depths["Root A"] == 0
    assert depths["Child A.1"] == 1
    assert depths["Grandchild"] == 2
    assert depths["Root B"] == 0


def test_curriculum_overview_includes_lessons(db_session):
    user = _seed_minimal_user(db_session)
    curriculum = Curriculum(user_id=user.id, title="C", language="de")
    db_session.add(curriculum)
    db_session.flush()
    db_session.add(
        Lesson(
            curriculum_id=curriculum.id,
            title="Lesson 1",
            content="Content here",
            order_index=0,
        )
    )
    db_session.add(
        Lesson(
            curriculum_id=curriculum.id,
            title="Lesson 2",
            content="More content",
            order_index=1,
        )
    )
    db_session.commit()
    payload = build_curriculum_overview(db_session, curriculum.id)
    assert len(payload["lessons"]) == 2
    assert payload["lessons"][0]["title"] == "Lesson 1"
    assert payload["lessons"][1]["title"] == "Lesson 2"


# ---- API key safety (defense in depth) ------------------------------------


def test_progress_report_never_includes_api_keys(db_session):
    """The export service never reads user_settings; verify the
    payload has no fields whose name suggests a secret."""
    user, project = _seed_user_with_project(db_session)
    _seed_full_progress(db_session, user, project)
    payload = build_progress_report(db_session, user.id)
    text = json.dumps(payload, default=str)
    assert "api_key" not in text
    assert "sk-" not in text
