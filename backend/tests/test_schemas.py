"""Phase 1B-C schema tests.

Covers: required-field enforcement, numeric bounds (rating 1-5,
weights 0.0-1.0, daily_minutes > 0), enum coercion (method /
status / role / provider), Update-with-no-fields validity, ORM
round-trip via ``from_attributes`` mode.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.database import SessionLocal
from app.models import (
    Curriculum,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    User,
    UserSettings,
)
from app.schemas import (
    AIProvider,
    CurriculumCreate,
    CurriculumOut,
    LearningMethod,
    LearningProfileCreate,
    LearningProfileOut,
    LearningProjectCreate,
    LearningProjectUpdate,
    LearningProjectOut,
    LearningSessionCreate,
    LearningSessionOut,
    LearningTopicCreate,
    MessageRole,
    SessionMessageCreate,
    SessionRatingCreate,
    SessionStatus,
    UserCreate,
    UserOut,
    UserSettingsOut,
    UserUpdate,
)


# --- User -------------------------------------------------------------------


def test_user_create_minimum_fields():
    u = UserCreate(name="Aster")
    assert u.name == "Aster"
    assert u.language == "de"
    assert u.email is None


def test_user_create_rejects_empty_name():
    with pytest.raises(ValidationError):
        UserCreate(name="")


def test_user_update_allows_all_none():
    u = UserUpdate()
    assert u.model_dump(exclude_none=True) == {}


def test_user_out_round_trip_from_orm():
    db = SessionLocal()
    try:
        row = User(name="Aster", email="a@example.com", language="en")
        db.add(row)
        db.commit()
        db.refresh(row)
        out = UserOut.model_validate(row)
        assert out.id == row.id
        assert out.email == "a@example.com"
        assert out.language == "en"
    finally:
        db.close()


# --- LearningProject --------------------------------------------------------


def test_project_create_rejects_zero_daily_minutes():
    with pytest.raises(ValidationError):
        LearningProjectCreate(
            user_id="u",
            topic="x",
            goal="g",
            timeframe="4w",
            daily_minutes=0,
        )


def test_project_create_defaults_active_true():
    p = LearningProjectCreate(
        user_id="u",
        topic="x",
        goal="g",
        timeframe="4w",
        daily_minutes=30,
    )
    assert p.active is True


def test_project_update_partial_payload_is_valid():
    p = LearningProjectUpdate(daily_minutes=60)
    payload = p.model_dump(exclude_unset=True)
    assert payload == {"daily_minutes": 60}


def test_project_out_from_orm():
    db = SessionLocal()
    try:
        u = User(name="u")
        db.add(u)
        db.commit()
        db.refresh(u)
        p = LearningProject(
            user_id=u.id,
            topic="t",
            goal="g",
            timeframe="4w",
            daily_minutes=30,
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        out = LearningProjectOut.model_validate(p)
        assert out.user_id == u.id
        assert out.daily_minutes == 30
    finally:
        db.close()


# --- LearningProfile (weight bounds) ---------------------------------------


@pytest.mark.parametrize("bad", [-0.1, 1.1, 2.0, -1.0])
def test_profile_create_rejects_weights_outside_unit_interval(bad: float):
    with pytest.raises(ValidationError):
        LearningProfileCreate(user_id="u", project_id="p", deductive=bad)


def test_profile_create_accepts_zero_and_one_at_boundaries():
    LearningProfileCreate(user_id="u", project_id="p", deductive=0.0, ai_adaptive=1.0)


def test_profile_out_includes_dominant_method_from_orm_property():
    db = SessionLocal()
    try:
        u = User(name="u")
        db.add(u)
        db.commit()
        db.refresh(u)
        proj = LearningProject(
            user_id=u.id, topic="t", goal="g", timeframe="4w", daily_minutes=30
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        prof = LearningProfile(
            user_id=u.id,
            project_id=proj.id,
            deductive=0.1,
            inductive=0.9,
            error_based=0.2,
            dialogic=0.3,
            contextual=0.4,
            ai_adaptive=0.5,
        )
        db.add(prof)
        db.commit()
        db.refresh(prof)
        out = LearningProfileOut.model_validate(prof)
        assert out.dominant_method == "inductive"
        assert out.version == 1
    finally:
        db.close()


# --- Curriculum + LearningTopic --------------------------------------------


def test_curriculum_create_defaults_language_de():
    c = CurriculumCreate(user_id="u", title="Python")
    assert c.language == "de"


def test_topic_create_negative_order_index_rejected():
    with pytest.raises(ValidationError):
        LearningTopicCreate(curriculum_id="c", title="t", order_index=-1)


def test_topic_create_parent_id_optional():
    t = LearningTopicCreate(curriculum_id="c", title="Root")
    assert t.parent_id is None


def test_curriculum_out_from_orm():
    db = SessionLocal()
    try:
        u = User(name="u")
        db.add(u)
        db.commit()
        db.refresh(u)
        c = Curriculum(user_id=u.id, title="Python", language="en")
        db.add(c)
        db.commit()
        db.refresh(c)
        out = CurriculumOut.model_validate(c)
        assert out.user_id == u.id
        assert out.language == "en"
    finally:
        db.close()


# --- LearningSession (enums) -----------------------------------------------


def test_session_create_method_string_coerces_to_enum():
    s = LearningSessionCreate(project_id="p", method="dialogic")
    assert s.method is LearningMethod.DIALOGIC


def test_session_create_rejects_unknown_method():
    with pytest.raises(ValidationError):
        LearningSessionCreate(project_id="p", method="telekinesis")


@pytest.mark.parametrize("bad_step", [0, 8, -1, 100])
def test_session_create_cycle_step_bounded_1_to_7(bad_step: int):
    with pytest.raises(ValidationError):
        LearningSessionCreate(project_id="p", method="deductive", cycle_step=bad_step)


def test_session_create_defaults_active_status():
    s = LearningSessionCreate(project_id="p", method="inductive")
    assert s.status is SessionStatus.ACTIVE
    assert s.cycle_step == 1


def test_session_out_from_orm():
    db = SessionLocal()
    try:
        u = User(name="u")
        db.add(u)
        db.commit()
        db.refresh(u)
        proj = LearningProject(
            user_id=u.id, topic="t", goal="g", timeframe="4w", daily_minutes=30
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        sess = LearningSession(project_id=proj.id, method="deductive")
        db.add(sess)
        db.commit()
        db.refresh(sess)
        out = LearningSessionOut.model_validate(sess)
        assert out.method is LearningMethod.DEDUCTIVE
        assert out.status is SessionStatus.ACTIVE
    finally:
        db.close()


# --- SessionMessage / SessionRating ----------------------------------------


def test_message_create_rejects_unknown_role():
    with pytest.raises(ValidationError):
        SessionMessageCreate(session_id="s", role="god", content="x")


def test_message_create_rejects_empty_content():
    with pytest.raises(ValidationError):
        SessionMessageCreate(session_id="s", role=MessageRole.USER, content="")


@pytest.mark.parametrize("bad", [0, 6, -1, 10])
def test_rating_create_rejects_out_of_range(bad: int):
    with pytest.raises(ValidationError):
        SessionRatingCreate(
            session_id="s",
            understanding=bad,
            stress=3,
            method_fit=3,
        )


def test_rating_create_accepts_boundaries():
    SessionRatingCreate(session_id="s", understanding=1, stress=5, method_fit=3)


# --- UserSettings ----------------------------------------------------------


def test_settings_out_strips_api_keys_via_orm_properties():
    """Out schema never carries plaintext / ciphertext keys.

    The ORM model exposes ``has_<provider>_key`` and ``language``
    as computed properties, so ``model_validate(row)`` works
    directly without the router having to assemble a dict.
    The api_key_* columns themselves are NOT fields on the schema
    and therefore can't leak into the response.
    """
    db = SessionLocal()
    try:
        u = User(name="u", language="en")
        db.add(u)
        db.commit()
        db.refresh(u)
        s = UserSettings(
            user_id=u.id, active_provider="anthropic", api_key_anthropic="ciphertext"
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        out = UserSettingsOut.model_validate(s)
        assert out.has_anthropic_key is True
        assert out.has_openai_key is False
        assert out.has_gemini_key is False
        assert out.language == "en"  # denormalised from User
        dumped = out.model_dump()
        assert "api_key_anthropic" not in dumped
        assert "api_key_openai" not in dumped
        assert "api_key_gemini" not in dumped
    finally:
        db.close()


def test_settings_provider_enum_coercion():
    out_payload = {
        "id": "x",
        "user_id": "u",
        "language": "de",
        "active_provider": "openai",
        "has_anthropic_key": False,
        "has_openai_key": True,
        "has_gemini_key": False,
        "created_at": "2026-05-17T00:00:00+00:00",
        "updated_at": "2026-05-17T00:00:00+00:00",
    }
    out = UserSettingsOut.model_validate(out_payload)
    assert out.active_provider is AIProvider.OPENAI
    assert out.language == "de"
