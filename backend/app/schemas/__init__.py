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

import json
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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


class ApiKeySource(str, Enum):
    """Where an API key was sourced from at resolution time.

    Phase 34 (v1.20.0) — surfaces the secrets.yaml + env-var
    precedence to the frontend so the Settings UI can show
    "Key from: secrets.yaml" / "Key from: environment" /
    "Key from: Settings" and gate the Save button when the key
    is externally managed.

    Precedence (highest wins) at resolution time:
      ENV          -- an ``ADAPTIVE_LEARNER_<PROVIDER>_API_KEY``
                      env var was set BEFORE startup (or was set
                      but differs from any secrets.yaml value)
      SECRETS_YAML -- the key was read from
                      ``~/.config/adaptive_learner/secrets.yaml``
      SETTINGS     -- a UI-configured key in UserSettings.api_key_*
                      (Fernet-encrypted ciphertext)
      NONE         -- no key configured anywhere
    """

    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"


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
    # Phase 34 (v1.20.0) — per-provider key-source enum. The router
    # populates these by consulting env vars + secrets.yaml + the
    # encrypted DB column. Default ``NONE`` so callers that build
    # ``UserSettingsOut`` directly from the ORM row (legacy tests)
    # still validate; the router overrides explicitly.
    key_source_anthropic: ApiKeySource = ApiKeySource.NONE
    key_source_openai: ApiKeySource = ApiKeySource.NONE
    key_source_gemini: ApiKeySource = ApiKeySource.NONE
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


class AvailableModelOut(BaseModel):
    """One row returned by ``GET /api/settings/{user_id}/available-models``.

    v1.11.0 / Phase 24A — model discovery picker. The list is
    derived from the provider's own models endpoint (Anthropic
    ``/v1/models``, OpenAI ``/v1/models``, Gemini ``/v1beta/models``)
    so the Settings UI can show what the user actually has access
    to instead of a static suggestion list.
    """

    id: str
    name: str
    context_window: int | None = None
    description: str | None = None


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
    # Phase 36 Bug 3 — optional FK to the imported conversation
    # that produced this curriculum. None for free-form curricula.
    imported_conversation_id: str | None = None


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
    imported_conversation_id: str | None = None


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
    # v1.4.0 — auto-loop. ``cycle_count`` starts at 1 and
    # increments when the topic-transition evaluator advances to
    # a new subtopic. ``cycle_topics`` is the JSON-decoded list
    # of per-cycle summaries; the Pydantic layer keeps it as a
    # plain list of dicts so the frontend does not have to parse
    # JSON-in-JSON.
    cycle_count: int = 1
    cycle_topics: list[dict[str, str]] = Field(default_factory=list)
    # Phase 36 Bug 4 — children-side FK back to the imported
    # conversation that started this session. Lets ImportDetail
    # show a "Continue session" CTA instead of always creating new.
    imported_conversation_id: str | None = None

    @field_validator("cycle_topics", mode="before")
    @classmethod
    def _decode_cycle_topics(cls, value: object) -> object:
        """Accept either a list (already-decoded) or a JSON string
        (raw column from SQLAlchemy). Empty / malformed strings
        collapse to ``[]`` so partial DB state never raises."""
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            try:
                decoded = json.loads(stripped)
            except json.JSONDecodeError:
                return []
            return decoded if isinstance(decoded, list) else []
        return []


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
    # v1.26.0 / Phase 42 — see models.SESSION_NOTE_KINDS for
    # the canonical values. Free-text at the DB layer so
    # plugins can extend with their own kinds without a
    # migration.
    kind: str = Field(default="note", max_length=32)


class SessionNoteUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1)
    kind: str | None = Field(default=None, max_length=32)


class SessionNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    content: str
    kind: str
    created_at: datetime
    # v1.8.0 / Phase 21B — mutable sync surface for SessionNote.
    updated_at: datetime


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
    # v1.14.0 / Phase 27B — joined from SessionRating for the
    # Progress page's "session history" view. May carry plain
    # text (legacy) or a serialised TipTap JSON document. The
    # frontend's content-utils handles both shapes.
    notes: str | None = None


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
    # v1.8.0 / Phase 21D — sync timestamp.
    created_at: datetime


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
    # Phase 36 Bug 1 — SHA-256 of role-prefixed normalised messages.
    # Title-independent so re-imports with a different display title
    # still detect as duplicates. Surfaced on the wire so the
    # frontend can dedupe locally too (Dexie path).
    content_hash: str | None = None


class ImportedConversationDetail(ImportedConversationOut):
    """List endpoint returns ``Out`` (no messages); detail endpoint
    adds the full transcript."""

    messages: list[ImportedMessageOut] = Field(default_factory=list)


# --- Taxonomy: Subject + Tag (Phase 22) -----------------------------------


class SubjectCreate(BaseModel):
    """POST body for ``/api/subjects``.

    Subjects are GLOBAL — no ``user_id`` field. Anyone can add a
    custom node; the seed pack ships with the common taxonomy.
    """

    parent_id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)


class SubjectUpdate(BaseModel):
    parent_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_id: str | None = None
    name: str
    description: str | None = None
    icon: str | None = None
    created_at: datetime
    updated_at: datetime


class TagCreate(BaseModel):
    """POST body for ``/api/users/{user_id}/tags``.

    Tags are per-user; ``user_id`` comes from the path prefix so a
    client can't forge cross-user writes.
    """

    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    color: str | None = None
    created_at: datetime


class ProjectSubjectOut(BaseModel):
    """Read-only association row (assigned / unassigned, no update)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    subject_id: str
    created_at: datetime


class ProjectTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    tag_id: str
    created_at: datetime


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
    # Taxonomy (Phase 22)
    "SubjectCreate",
    "SubjectUpdate",
    "SubjectOut",
    "TagCreate",
    "TagUpdate",
    "TagOut",
    "ProjectSubjectOut",
    "ProjectTagOut",
    # Gamification (Phase 29)
    "UserXPOut",
    "XPAwardOut",
    "BadgeOut",
    "UserBadgeOut",
    "BadgeWithProgressOut",
    # Anki (Phase 30)
    "AnkiCardSuggestionOut",
    "AnkiCardSuggestionCreate",
    "AnkiCardSuggestionUpdate",
    # NotebookLM (Phase 32)
    "StudyQuestionOut",
    "StudyQuestionCreate",
    "StudyQuestionUpdate",
]


class StudyQuestionOut(BaseModel):
    """Read-side study question (Phase 32B)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    project_id: str
    session_id: str | None
    question: str
    expected_answer: str
    question_type: str
    difficulty: str
    topic: str
    edited: bool
    created_at: datetime
    updated_at: datetime


class StudyQuestionCreate(BaseModel):
    """Manual insert payload (rarely used — most questions come
    from the AI generator)."""

    project_id: str
    session_id: str | None = None
    question: str
    expected_answer: str = ""
    question_type: str = "open"
    difficulty: str = "medium"
    topic: str = ""


class StudyQuestionUpdate(BaseModel):
    """Inline-edit payload. Every field optional; setting any of
    ``question`` / ``expected_answer`` flips ``edited=True`` so
    the AI re-runner skips this row."""

    question: str | None = None
    expected_answer: str | None = None
    question_type: str | None = None
    difficulty: str | None = None
    topic: str | None = None


class AnkiCardSuggestionOut(BaseModel):
    """Read-side flashcard suggestion (Phase 30B)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    session_id: str | None
    conversation_id: str | None
    project_id: str | None
    card_type: str
    front: str
    back: str
    tags: list[str] = []
    accepted: bool
    rejected: bool
    exported_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AnkiCardSuggestionCreate(BaseModel):
    """Manual / extractor-fed insert payload."""

    session_id: str | None = None
    conversation_id: str | None = None
    project_id: str | None = None
    card_type: str = "basic"
    front: str
    back: str
    tags: list[str] = []
    accepted: bool = False


class AnkiCardSuggestionUpdate(BaseModel):
    """Inline-edit payload used by the review UI.

    Every field optional; only those present in the body are
    applied. ``accepted`` + ``rejected`` are mutually exclusive
    at the service layer (asserting here would make a checkbox
    toggle two roundtrips).
    """

    card_type: str | None = None
    front: str | None = None
    back: str | None = None
    tags: list[str] | None = None
    accepted: bool | None = None
    rejected: bool | None = None


class UserXPOut(BaseModel):
    """Per-user XP and level state (Phase 29A)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    total_xp: int
    level: int
    updated_at: datetime


class XPAwardOut(BaseModel):
    """Single XP-award event returned alongside the source action.

    Not a persisted row — the breakdown is computed on the fly so
    the frontend can render the ``+50 XP`` floating animation
    without a second roundtrip. The persisted state is
    :class:`UserXPOut`.
    """

    model_config = ConfigDict(from_attributes=True)

    xp_earned: int
    xp_total: int
    level: int
    level_up: bool = False
    breakdown: dict[str, int] = {}
    multiplier: float = 1.0
    reason: str = ""


class BadgeOut(BaseModel):
    """Catalog entry (Phase 29B)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name_key: str
    description_key: str
    icon: str
    category: str


class UserBadgeOut(BaseModel):
    """Earned-badge record (Phase 29B)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    badge_id: str
    earned_at: datetime


class BadgeWithProgressOut(BaseModel):
    """Combined catalog + earn state for the dashboard showcase.

    ``earned_at`` is non-null iff the badge is earned; locked
    badges still appear in the showcase with a greyed-out icon
    plus an optional ``progress`` hint (e.g. "3 / 7 days") so
    the user knows what's still attainable.
    """

    model_config = ConfigDict(from_attributes=True)

    key: str
    name_key: str
    description_key: str
    icon: str
    category: str
    earned: bool
    earned_at: datetime | None = None
    progress: str | None = None


# --- Identity (Phase 41) ----------------------------------------------------
# The identity.yaml file at ~/.config/adaptive_learner/identity.yaml is
# the recovery surface after a browser data wipe; this schema is the
# wire shape returned by GET /api/identity. Service-side merging keeps
# last_seen fresh on every domain change.


class IdentityOut(BaseModel):
    """Payload of GET /api/identity (Phase 41A).

    Mirrors :func:`app.services.identity_service.load_identity` output.
    ``user_id`` is always present (the file is rejected on load if
    missing); the other three are nullable because the identity is
    created BEFORE the user creates their first project.
    """

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    active_project_id: str | None = None
    language: str | None = None
    last_seen: str | None = None


class IdentityStatusOut(BaseModel):
    """Payload of GET /api/identity/status (Phase 41D).

    Diagnostic surface for the Settings > About > Identity panel.
    Different from :class:`IdentityOut`: always returns 200 (even
    when the file is missing) so the UI can render a "Not found"
    badge without catching a 404. ``path`` is always resolved
    (platformdirs config dir + ``identity.yaml``), so the user can
    see WHERE the file would live even before it gets written.
    """

    model_config = ConfigDict(from_attributes=True)

    exists: bool
    path: str
    last_seen: str | None = None
