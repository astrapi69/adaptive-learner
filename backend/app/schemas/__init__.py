"""Pydantic v2 schemas for Adaptive Learner (Phase 1B-C).

For every model in :mod:`app.models` we ship three schemas:

- ``XxxCreate``  — POST body (client-supplied fields only).
- ``XxxUpdate``  — PATCH body (every field optional).
- ``XxxOut``     — server response (includes ``id`` + timestamps).

Conventions:

- All ``Out`` schemas set ``ConfigDict(from_attributes=True)`` so
  routers can pass an SQLAlchemy row directly through
  ``XxxOut.model_validate(row)``.
- ``Update`` schemas have every field as ``Optional[T] | None`` with
  default ``None``; routers should patch by checking
  ``field is not None`` rather than ``Field-was-set``. Routers that
  need set-vs-unset semantics can switch to
  ``model_dump(exclude_unset=True)``.
- Numeric constraints live on the schema layer (not in the DB):
  the six method-weights on :class:`LearningProfile` clamp to
  ``[0.0, 1.0]``; session-rating ints clamp to ``[1, 5]``;
  ``daily_minutes`` is ``> 0``.
- The model's ``order_index`` field stays under that name in the
  schema. Phase 1C routers can rename it to ``order`` in the API
  surface via a thin DTO if the spec's public-API name matters.
- API-key fields on :class:`UserSettings` accept plaintext on
  Create / Update; the Phase 1C settings service encrypts them
  before persisting and decrypts on read. ``Out`` exposes only a
  ``has_<provider>_key: bool`` flag — secrets never reach the
  client.
- The method-key enum lives here so every schema that takes a
  method string agrees on the allowed values.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LearningMethod(str, Enum):
    """The six method keys (see project-reference.md §3.1)."""

    DEDUCTIVE = "deductive"
    INDUCTIVE = "inductive"
    ERROR_BASED = "error_based"
    DIALOGIC = "dialogic"
    CONTEXTUAL = "contextual"
    AI_ADAPTIVE = "ai_adaptive"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class AIProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"


# --- User -------------------------------------------------------------------


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    # EmailStr brings RFC-5321 validation via email-validator
    # (pydantic[email] extra). nullable for single-user desktop
    # installs that never bind an identity to an inbox.
    email: EmailStr | None = None
    language: str = Field(default="de", max_length=10)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    language: str | None = Field(default=None, max_length=10)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    # ORM column is plain String(320); validating with EmailStr on the
    # way out catches a corrupt-row regression early (the DB itself
    # has no CHECK constraint).
    email: EmailStr | None = None
    language: str
    created_at: datetime
    updated_at: datetime


# --- UserSettings -----------------------------------------------------------
#
# UserSettings has no ``Create`` / ``Update`` schema by design:
# the row is auto-created on first GET (via
# ``settings_service.get_or_create_settings``) and updates go
# through narrowly-scoped body schemas — :class:`SettingsPatchBody`
# for active_provider + language; :class:`ApiKeySetBody` for the
# encryption-required api-key write path. A general Update would
# re-expose the raw api_key_* columns to clients, which is exactly
# what the Phase 1C-D security contract forbids.


class UserSettingsOut(BaseModel):
    """Server response: never exposes the encrypted ciphertext.

    The router builds the boolean flags from
    ``settings.api_key_<provider> is not None`` before returning.
    ``language`` is denormalised from the parent :class:`User` row
    so the frontend Settings page has a single endpoint for both
    the provider and the UI language (PATCH on this endpoint
    accepts both, see :class:`SettingsPatchBody`).
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    language: str
    active_provider: AIProvider
    has_anthropic_key: bool = False
    has_openai_key: bool = False
    has_gemini_key: bool = False
    # v0.4.0 — nullable override per provider. ``None`` means
    # "use the session plugin's DEFAULT_MODELS for that provider";
    # a non-null string replaces the default at /message time.
    model_override_anthropic: str | None = None
    model_override_openai: str | None = None
    model_override_gemini: str | None = None
    created_at: datetime
    updated_at: datetime


class SettingsPatchBody(BaseModel):
    """PATCH body for ``/api/settings/{user_id}``.

    Spans two tables: ``active_provider`` lives on
    :class:`UserSettings`, ``language`` lives on :class:`User`.
    The service updates both in one transaction so the response
    reflects a consistent snapshot.

    API-key writes do NOT come through here; the dedicated
    ``POST /api/settings/{user_id}/api-key`` endpoint is the
    only way to set an encrypted key (and ``DELETE …/{provider}``
    is the only way to clear one).

    v0.4.0 also accepts ``model_override_<provider>`` strings —
    pass ``""`` (empty string) or rely on the dedicated DELETE
    endpoint to clear an override; pass a non-empty string to set
    one. ``None`` (field omitted from the body) means "no change".
    """

    active_provider: AIProvider | None = None
    language: str | None = Field(default=None, min_length=2, max_length=10)
    model_override_anthropic: str | None = Field(default=None, max_length=200)
    model_override_openai: str | None = Field(default=None, max_length=200)
    model_override_gemini: str | None = Field(default=None, max_length=200)


class ApiKeySetBody(BaseModel):
    """POST body for ``/api/settings/{user_id}/api-key``.

    ``key`` is the plaintext API token from the user; the service
    Fernet-encrypts it before persisting via
    :mod:`app.services.crypto`.
    """

    provider: AIProvider
    key: str = Field(min_length=1)


# --- LearningProject --------------------------------------------------------


class LearningProjectCreate(BaseModel):
    user_id: str
    topic: str = Field(min_length=1, max_length=500)
    goal: str = Field(min_length=1)
    timeframe: str = Field(min_length=1, max_length=100)
    daily_minutes: int = Field(gt=0)
    current_problem: str | None = None
    active: bool = True


class LearningProjectCreateBody(BaseModel):
    """POST body for the user-scoped ``/users/{user_id}/projects``
    route. Identical to :class:`LearningProjectCreate` minus
    ``user_id`` — the route prefix supplies that, and accepting it
    in the body would let a client forge cross-user writes.
    """

    topic: str = Field(min_length=1, max_length=500)
    goal: str = Field(min_length=1)
    timeframe: str = Field(min_length=1, max_length=100)
    daily_minutes: int = Field(gt=0)
    current_problem: str | None = None
    active: bool = True


class LearningProjectUpdate(BaseModel):
    topic: str | None = Field(default=None, min_length=1, max_length=500)
    goal: str | None = Field(default=None, min_length=1)
    timeframe: str | None = Field(default=None, min_length=1, max_length=100)
    daily_minutes: int | None = Field(default=None, gt=0)
    current_problem: str | None = None
    active: bool | None = None


class LearningProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    topic: str
    goal: str
    timeframe: str
    daily_minutes: int
    current_problem: str | None = None
    active: bool
    created_at: datetime
    updated_at: datetime


# --- LearningProfile --------------------------------------------------------


class LearningProfileCreate(BaseModel):
    user_id: str
    project_id: str
    deductive: float = Field(default=0.0, ge=0.0, le=1.0)
    inductive: float = Field(default=0.0, ge=0.0, le=1.0)
    error_based: float = Field(default=0.0, ge=0.0, le=1.0)
    dialogic: float = Field(default=0.0, ge=0.0, le=1.0)
    contextual: float = Field(default=0.0, ge=0.0, le=1.0)
    ai_adaptive: float = Field(default=0.0, ge=0.0, le=1.0)
    version: int = Field(default=1, ge=1)


class LearningProfileUpdate(BaseModel):
    deductive: float | None = Field(default=None, ge=0.0, le=1.0)
    inductive: float | None = Field(default=None, ge=0.0, le=1.0)
    error_based: float | None = Field(default=None, ge=0.0, le=1.0)
    dialogic: float | None = Field(default=None, ge=0.0, le=1.0)
    contextual: float | None = Field(default=None, ge=0.0, le=1.0)
    ai_adaptive: float | None = Field(default=None, ge=0.0, le=1.0)
    version: int | None = Field(default=None, ge=1)


class LearningProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    project_id: str
    deductive: float
    inductive: float
    error_based: float
    dialogic: float
    contextual: float
    ai_adaptive: float
    assessed_at: datetime
    version: int
    dominant_method: str  # computed @property on the ORM model


# --- Curriculum -------------------------------------------------------------


class CurriculumCreate(BaseModel):
    user_id: str
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    language: str = Field(default="de", max_length=10)


class CurriculumUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    language: str | None = Field(default=None, max_length=10)


class CurriculumOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    description: str | None = None
    language: str
    created_at: datetime
    updated_at: datetime


# --- LearningTopic ----------------------------------------------------------


class LearningTopicCreate(BaseModel):
    curriculum_id: str
    parent_id: str | None = None
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    order_index: int = Field(default=0, ge=0)


class LearningTopicUpdate(BaseModel):
    parent_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    order_index: int | None = Field(default=None, ge=0)


class LearningTopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    curriculum_id: str
    parent_id: str | None = None
    title: str
    description: str | None = None
    order_index: int
    created_at: datetime
    updated_at: datetime


# --- Lesson -----------------------------------------------------------------


class LessonCreate(BaseModel):
    curriculum_id: str
    title: str = Field(min_length=1, max_length=500)
    content: str = ""
    order_index: int = Field(default=0, ge=0)


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = None
    order_index: int | None = Field(default=None, ge=0)


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    curriculum_id: str
    title: str
    content: str
    order_index: int
    created_at: datetime
    updated_at: datetime


# --- LearningSession --------------------------------------------------------


class LearningSessionCreate(BaseModel):
    project_id: str
    method: LearningMethod
    cycle_step: int = Field(default=1, ge=1, le=7)
    status: SessionStatus = SessionStatus.ACTIVE


class LearningSessionUpdate(BaseModel):
    method: LearningMethod | None = None
    cycle_step: int | None = Field(default=None, ge=1, le=7)
    status: SessionStatus | None = None
    ended_at: datetime | None = None


class LearningSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    method: LearningMethod
    started_at: datetime
    ended_at: datetime | None = None
    cycle_step: int
    status: SessionStatus


# --- SessionMessage ---------------------------------------------------------


class SessionMessageCreate(BaseModel):
    session_id: str
    role: MessageRole
    content: str = Field(min_length=1)


class SessionMessageUpdate(BaseModel):
    role: MessageRole | None = None
    content: str | None = Field(default=None, min_length=1)


class SessionMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    role: MessageRole
    content: str
    created_at: datetime


# --- SessionRating ----------------------------------------------------------


class SessionRatingCreate(BaseModel):
    session_id: str
    understanding: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    method_fit: int = Field(ge=1, le=5)
    notes: str | None = None


class SessionRatingUpdate(BaseModel):
    understanding: int | None = Field(default=None, ge=1, le=5)
    stress: int | None = Field(default=None, ge=1, le=5)
    method_fit: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None


class SessionRatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    understanding: int
    stress: int
    method_fit: int
    notes: str | None = None
    created_at: datetime


# --- SessionNote ------------------------------------------------------------


class SessionNoteCreate(BaseModel):
    session_id: str
    content: str = Field(min_length=1)


class SessionNoteUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1)


class SessionNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    content: str
    created_at: datetime


# --- ProgressCommit ---------------------------------------------------------


class ProgressCommitCreate(BaseModel):
    project_id: str
    session_id: str
    method: LearningMethod
    understanding: float = Field(ge=0.0, le=1.0)
    stress: float = Field(ge=0.0, le=1.0)
    error_rate: float = Field(ge=0.0, le=1.0)
    duration_minutes: int = Field(gt=0)


class ProgressCommitUpdate(BaseModel):
    """Immutable in practice — every field stays optional so a
    backfill / data-fix endpoint can correct a bad row without
    deleting it, but the routine session-end path never PATCHes
    a commit.
    """

    method: LearningMethod | None = None
    understanding: float | None = Field(default=None, ge=0.0, le=1.0)
    stress: float | None = Field(default=None, ge=0.0, le=1.0)
    error_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    duration_minutes: int | None = Field(default=None, gt=0)


class ProgressCommitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    session_id: str
    method: LearningMethod
    understanding: float
    stress: float
    error_rate: float
    duration_minutes: int
    committed_at: datetime


# --- StepEvaluation (v0.5.0 / Phase 8D) -----------------------------------


class StepEvaluationOut(BaseModel):
    """Read-only serialisation of one Phase-8 evaluation verdict.

    Written by the session plugin's /message route; the 8D tracking
    plugin aggregates a project's rows to compute average confidence,
    stay-on-step counts, and time-per-step. No Create / Update
    schemas — the row is immutable once persisted.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    from_step: int
    to_step: int
    advance: bool
    confidence: float
    applied: bool
    fallback_used: bool
    reason: str
    evaluated_at: datetime


# --- MethodSwitch -----------------------------------------------------------


class MethodSwitchCreate(BaseModel):
    project_id: str
    from_method: LearningMethod
    to_method: LearningMethod
    reason: str = Field(min_length=1)


class MethodSwitchUpdate(BaseModel):
    """Same shape as ProgressCommitUpdate — backfill only."""

    from_method: LearningMethod | None = None
    to_method: LearningMethod | None = None
    reason: str | None = Field(default=None, min_length=1)


class MethodSwitchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    from_method: LearningMethod
    to_method: LearningMethod
    reason: str
    switched_at: datetime


# --- Imported conversations (Phase 12C) -------------------------------------


class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class ImportedMessageCreate(BaseModel):
    role: MessageRole
    content: str = Field(min_length=1)
    timestamp: datetime | None = None


class ImportedMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: MessageRole
    content: str
    timestamp: datetime | None = None
    order_index: int


class ImportedConversationCreate(BaseModel):
    """POST body for ``/users/{id}/imports``.

    The user_id comes from the URL prefix (never the body, per the
    cross-user-write guard pattern used by projects/curricula).
    """

    source: ImportedConversationSource = ImportedConversationSource.UNKNOWN
    title: str = Field(min_length=1, max_length=500)
    project_id: str | None = None
    topic_tag: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    source_created_at: datetime | None = None
    messages: list[ImportedMessageCreate] = Field(min_length=1)


class ImportedConversationUpdate(BaseModel):
    """Partial update for already-imported conversations.

    Only ``project_id`` + ``topic_tag`` are user-editable from the
    UI; the analysis fields are set by the analyze endpoint, not
    by direct PATCH from the client.
    """

    project_id: str | None = None
    topic_tag: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, min_length=1, max_length=500)


class ImportedConversationAnalysis(BaseModel):
    """Persist the AI-analysis result.

    Sent by the frontend after it has run the analysis call. The
    server validates the JSON envelope but does NOT prescribe the
    inner schema — the analysis engine's prompt is the spec.
    """

    analysis_result: dict[str, object]


class ImportedConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    project_id: str | None = None
    source: ImportedConversationSource
    title: str
    message_count: int
    imported_at: datetime
    analyzed: bool
    topic_tag: str | None = None
    model: str | None = None
    source_created_at: datetime | None = None
    # ``analysis_result`` is serialised JSON on the DB row; the
    # router deserialises it via a thin DTO before validation so
    # the wire shape is a dict, not a string.
    analysis_result: dict[str, object] | None = None


class ImportedConversationDetail(ImportedConversationOut):
    """List endpoint returns ``Out`` (no messages); detail endpoint
    adds the full transcript."""

    messages: list[ImportedMessageOut] = Field(default_factory=list)


__all__ = [
    # Enums
    "AIProvider",
    "ImportedConversationSource",
    "LearningMethod",
    "MessageRole",
    "SessionStatus",
    # User
    "UserCreate",
    "UserUpdate",
    "UserOut",
    # UserSettings (no Create/Update — see the comment block above
    # UserSettingsOut in the schema definitions).
    "ApiKeySetBody",
    "SettingsPatchBody",
    "UserSettingsOut",
    # LearningProject
    "LearningProjectCreate",
    "LearningProjectCreateBody",
    "LearningProjectUpdate",
    "LearningProjectOut",
    # LearningProfile
    "LearningProfileCreate",
    "LearningProfileUpdate",
    "LearningProfileOut",
    # Curriculum
    "CurriculumCreate",
    "CurriculumUpdate",
    "CurriculumOut",
    # LearningTopic
    "LearningTopicCreate",
    "LearningTopicUpdate",
    "LearningTopicOut",
    # Lesson
    "LessonCreate",
    "LessonUpdate",
    "LessonOut",
    # LearningSession
    "LearningSessionCreate",
    "LearningSessionUpdate",
    "LearningSessionOut",
    # SessionMessage
    "SessionMessageCreate",
    "SessionMessageUpdate",
    "SessionMessageOut",
    # SessionRating
    "SessionRatingCreate",
    "SessionRatingUpdate",
    "SessionRatingOut",
    # SessionNote
    "SessionNoteCreate",
    "SessionNoteUpdate",
    "SessionNoteOut",
    # ProgressCommit
    "ProgressCommitCreate",
    "ProgressCommitUpdate",
    "ProgressCommitOut",
    # MethodSwitch
    "MethodSwitchCreate",
    "MethodSwitchUpdate",
    "MethodSwitchOut",
    # StepEvaluation (v0.5.0 / Phase 8D — read-only)
    "StepEvaluationOut",
    # ImportedConversation + ImportedMessage (v0.9.0 / Phase 12C)
    "ImportedConversationCreate",
    "ImportedConversationUpdate",
    "ImportedConversationAnalysis",
    "ImportedConversationOut",
    "ImportedConversationDetail",
    "ImportedMessageCreate",
    "ImportedMessageOut",
]
