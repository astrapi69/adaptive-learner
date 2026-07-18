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
from typing import Any, Literal

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
    """Lifecycle state of a learning session."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    """Author role of a chat / session message."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class AIProvider(str, Enum):
    """The supported AI completion providers."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"


# --- User -------------------------------------------------------------------


class UserCreate(BaseModel):
    """Request body for creating a user."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Alex Learner",
                "email": "alex@example.com",
                "language": "de",
            }
        }
    )

    name: str = Field(min_length=1, max_length=200)
    # EmailStr brings RFC-5321 validation via email-validator
    # (pydantic[email] extra). nullable for single-user desktop
    # installs that never bind an identity to an inbox.
    email: EmailStr | None = None
    language: str = Field(default="de", max_length=10)


class UserUpdate(BaseModel):
    """Partial-update payload for a user (all fields optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    language: str | None = Field(default=None, max_length=10)


class UserOut(BaseModel):
    """API response shape for a user."""

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
    # #508 — base64 data URL of the profile picture, or None.
    avatar: str | None = None
    # Phase 34 (v1.20.0) — per-provider key-source enum. The router
    # populates these by consulting env vars + secrets.yaml + the
    # encrypted DB column. Default ``NONE`` so callers that build
    # ``UserSettingsOut`` directly from the ORM row (legacy tests)
    # still validate; the router overrides explicitly.
    key_source_anthropic: ApiKeySource = ApiKeySource.NONE
    key_source_openai: ApiKeySource = ApiKeySource.NONE
    key_source_gemini: ApiKeySource = ApiKeySource.NONE
    # #810 — masked preview of the resolved key (first 4 + last 4 chars,
    # e.g. "AIza…7f3k"), or None when no key is configured. The full /
    # decrypted key is NEVER returned; the router computes the preview by
    # resolving the key and masking it. ``None`` default so callers that
    # build this directly from the ORM row (legacy tests) still validate.
    key_preview_anthropic: str | None = None
    key_preview_openai: str | None = None
    key_preview_gemini: str | None = None
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
    # #508 — base64 data URL of a profile picture. ``""`` clears it,
    # a non-empty value sets it, ``None`` (omitted) means "no change".
    # The cap (~200 KB) backstops the client's <=100 KB resize.
    avatar: str | None = Field(default=None, max_length=200_000)


class ApiKeySetBody(BaseModel):
    """POST body for ``/api/settings/{user_id}/api-key``.

    ``key`` is the plaintext API token from the user; the service
    Fernet-encrypts it before persisting via
    :mod:`app.services.crypto`.
    """

    model_config = ConfigDict(
        json_schema_extra={"example": {"provider": "anthropic", "key": "sk-ant-..."}}
    )

    provider: AIProvider
    key: str = Field(min_length=1)


class ApiKeyTestBody(BaseModel):
    """POST body for ``/api/settings/{user_id}/test-api-key``.

    When ``key`` is given the endpoint tests THAT key (the
    pre-save check); when it is omitted the endpoint resolves the
    user's currently-configured key for ``provider`` (env >
    secrets.yaml > DB) and tests that. Neither path saves anything.
    """

    provider: AIProvider
    key: str | None = None


class ApiKeyTestOut(BaseModel):
    """Result of a live API-key test. ``kind`` is a stable machine
    code the frontend maps to a localized message:

      - ``ok``         — the provider accepted the key.
      - ``invalid``    — 401 / 403 (bad or expired key).
      - ``rate_limit`` — 429 (key works but is throttled).
      - ``network``    — could not reach the provider.
      - ``error``      — any other non-success response.
      - ``no_key``     — no key was provided and none is configured.
    """

    success: bool
    kind: str


class ApiKeyBackupBody(BaseModel):
    """POST body for ``/api/settings/{user_id}/api-key-backup`` — caches
    a tested-good key as the last-known-good backup for ``provider``."""

    provider: AIProvider
    key: str = Field(min_length=1)


class ApiKeyBackupInfoOut(BaseModel):
    """Metadata about a stored backup — never the key itself. ``has``
    is false when no backup exists; ``tested_at`` is the ISO timestamp
    of the last successful test."""

    has: bool
    tested_at: datetime | None = None


class GitHubTokenSetBody(BaseModel):
    """POST body for ``/api/github/token`` — store a GitHub Personal
    Access Token (Fernet-encrypted in secrets.yaml). The token needs
    only the ``repo`` scope (fork + push + open PRs)."""

    token: str = Field(min_length=1)


class GitHubTokenStatusOut(BaseModel):
    """Whether a GitHub token is configured and where it lives.

    ``source`` is one of ``environment`` / ``secrets.yaml`` / ``none``
    (mirrors the AI-key source display). The token itself is never
    returned.
    """

    configured: bool
    source: str


class GitHubVerifyBody(BaseModel):
    """POST body for ``/api/github/verify-token``. When ``token`` is
    given that token is verified (pre-save check); when omitted the
    configured token (env > secrets.yaml) is verified."""

    token: str | None = None


class GitHubVerifyOut(BaseModel):
    """Result of a GitHub token verification. ``kind`` is a stable
    machine code: ok / invalid / rate_limit / network / error /
    no_token."""

    valid: bool
    username: str | None = None
    kind: str


class GitHubManifestUpdate(BaseModel):
    """Best-effort manifest patch passed alongside a PR request."""

    set_path: str
    lesson_filename: str


class GitHubCreatePrBody(BaseModel):
    """POST body for ``/api/github/create-pr`` — the proxy reads the
    stored token and runs the fork -> branch -> commit -> PR flow."""

    upstream: str = Field(min_length=1)
    base_branch: str = Field(min_length=1)
    branch_name: str = Field(min_length=1)
    file_path: str = Field(min_length=1)
    file_content: str = Field(min_length=1)
    commit_message: str = Field(min_length=1)
    pr_title: str = Field(min_length=1)
    pr_body: str
    manifest_update: GitHubManifestUpdate | None = None


class GitHubCreatePrOut(BaseModel):
    """A created pull request: its web URL + number + whether the set
    manifest was updated as part of the same PR."""

    url: str
    number: int
    manifest_updated: bool


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
    """Request body for creating a learning project (carries ``user_id``)."""

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

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "Spanish B1",
                "goal": "Hold a 20-minute conversation.",
                "timeframe": "8 weeks",
                "daily_minutes": 30,
                "current_problem": "Confusing ser vs estar.",
                "active": True,
            }
        }
    )

    topic: str = Field(min_length=1, max_length=500)
    goal: str = Field(min_length=1)
    timeframe: str = Field(min_length=1, max_length=100)
    daily_minutes: int = Field(gt=0)
    current_problem: str | None = None
    active: bool = True


class LearningProjectUpdate(BaseModel):
    """Partial-update payload for a learning project (all fields optional)."""

    topic: str | None = Field(default=None, min_length=1, max_length=500)
    goal: str | None = Field(default=None, min_length=1)
    timeframe: str | None = Field(default=None, min_length=1, max_length=100)
    daily_minutes: int | None = Field(default=None, gt=0)
    current_problem: str | None = None
    active: bool | None = None


class LearningProjectOut(BaseModel):
    """API response shape for a learning project."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    topic: str
    goal: str
    timeframe: str
    daily_minutes: int
    current_problem: str | None = None
    active: bool
    # v1.31.0 / Phase 46F: "standard" (wizard-created) vs
    # "content" (auto-created pseudo-project that owns
    # content-lesson session rows). Default keeps old clients
    # working when reading a fresh row that was created before
    # the migration ran.
    kind: str = "standard"
    created_at: datetime
    updated_at: datetime


# --- LearningProfile --------------------------------------------------------


class LearningProfileCreate(BaseModel):
    """Request body for creating a learning profile (six method weights)."""

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
    """Partial-update payload for a learning profile (all fields optional)."""

    deductive: float | None = Field(default=None, ge=0.0, le=1.0)
    inductive: float | None = Field(default=None, ge=0.0, le=1.0)
    error_based: float | None = Field(default=None, ge=0.0, le=1.0)
    dialogic: float | None = Field(default=None, ge=0.0, le=1.0)
    contextual: float | None = Field(default=None, ge=0.0, le=1.0)
    ai_adaptive: float | None = Field(default=None, ge=0.0, le=1.0)
    version: int | None = Field(default=None, ge=1)


class LearningProfileOut(BaseModel):
    """API response shape for a learning profile (includes the derived
    ``dominant_method``)."""

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
    """Request body for creating a curriculum (carries ``user_id``)."""

    user_id: str
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    language: str = Field(default="de", max_length=10)
    # Phase 36 Bug 3 — optional FK to the imported conversation
    # that produced this curriculum. None for free-form curricula.
    imported_conversation_id: str | None = None


class CurriculumUpdate(BaseModel):
    """Partial-update payload for a curriculum (all fields optional)."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    language: str | None = Field(default=None, max_length=10)


class CurriculumOut(BaseModel):
    """API response shape for a curriculum."""

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
    """Request body for creating a curriculum topic node."""

    curriculum_id: str
    parent_id: str | None = None
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    order_index: int = Field(default=0, ge=0)


class LearningTopicUpdate(BaseModel):
    """Partial-update payload for a curriculum topic (all fields optional)."""

    parent_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    order_index: int | None = Field(default=None, ge=0)


class LearningTopicOut(BaseModel):
    """API response shape for a curriculum topic node."""

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
    """Request body for creating a lesson under a curriculum."""

    curriculum_id: str
    title: str = Field(min_length=1, max_length=500)
    content: str = ""
    order_index: int = Field(default=0, ge=0)


class LessonUpdate(BaseModel):
    """Partial-update payload for a lesson (all fields optional)."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = None
    order_index: int | None = Field(default=None, ge=0)


class LessonOut(BaseModel):
    """API response shape for a lesson."""

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
    """Request body for starting a learning session."""

    project_id: str
    method: LearningMethod
    cycle_step: int = Field(default=1, ge=1, le=7)
    status: SessionStatus = SessionStatus.ACTIVE


class LearningSessionUpdate(BaseModel):
    """Partial-update payload for a learning session (all fields optional)."""

    method: LearningMethod | None = None
    cycle_step: int | None = Field(default=None, ge=1, le=7)
    status: SessionStatus | None = None
    ended_at: datetime | None = None


class LearningSessionOut(BaseModel):
    """API response shape for a learning session (auto-loop + import fields)."""

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
    """Request body for appending a message to a session."""

    session_id: str
    role: MessageRole
    content: str = Field(min_length=1)


class SessionMessageUpdate(BaseModel):
    """Partial-update payload for a session message (all fields optional)."""

    role: MessageRole | None = None
    content: str | None = Field(default=None, min_length=1)


class SessionMessageOut(BaseModel):
    """API response shape for a session message."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    role: MessageRole
    content: str
    created_at: datetime


# --- SessionRating ----------------------------------------------------------


class SessionRatingCreate(BaseModel):
    """Request body for rating a session (1-5 scales)."""

    session_id: str
    understanding: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    method_fit: int = Field(ge=1, le=5)
    notes: str | None = None


class SessionRatingUpdate(BaseModel):
    """Partial-update payload for a session rating (all fields optional)."""

    understanding: int | None = Field(default=None, ge=1, le=5)
    stress: int | None = Field(default=None, ge=1, le=5)
    method_fit: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None


class SessionRatingOut(BaseModel):
    """API response shape for a session rating."""

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
    """Request body for adding a note to a session."""

    session_id: str
    content: str = Field(min_length=1)
    # v1.26.0 / Phase 42 — see models.SESSION_NOTE_KINDS for
    # the canonical values. Free-text at the DB layer so
    # plugins can extend with their own kinds without a
    # migration.
    kind: str = Field(default="note", max_length=32)


class SessionNoteUpdate(BaseModel):
    """Partial-update payload for a session note (all fields optional)."""

    content: str | None = Field(default=None, min_length=1)
    kind: str | None = Field(default=None, max_length=32)


class SessionNoteOut(BaseModel):
    """API response shape for a session note."""

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
    """Request body for recording a progress commit at session end."""

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
    """API response shape for a progress commit (with joined notes)."""

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
    """Request body for recording a learning-method switch."""

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
    """API response shape for a method-switch record."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    from_method: LearningMethod
    to_method: LearningMethod
    reason: str
    switched_at: datetime


# --- Imported conversations (Phase 12C) -------------------------------------


class ImportedConversationSource(str, Enum):
    """Origin platform of an imported chat conversation."""

    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class ImportedMessageCreate(BaseModel):
    """One message in the payload that imports a conversation transcript."""

    role: MessageRole
    content: str = Field(min_length=1)
    timestamp: datetime | None = None


class ImportedMessageOut(BaseModel):
    """API response shape for an imported conversation message."""

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
    # v1.54.0 — language pair set at import time (source = chat
    # language / what the learner speaks; target = what they learn).
    source_language: str | None = Field(default=None, max_length=10)
    target_language: str | None = Field(default=None, max_length=10)
    messages: list[ImportedMessageCreate] = Field(min_length=1)


class ImportedConversationUpdate(BaseModel):
    """Partial update for already-imported conversations.

    ``project_id`` + ``topic_tag`` + ``title`` and the v1.54.0
    language pair are user-editable from the UI; the analysis fields
    are set by the analyze endpoint, not by direct PATCH.
    """

    project_id: str | None = None
    topic_tag: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    source_language: str | None = Field(default=None, max_length=10)
    target_language: str | None = Field(default=None, max_length=10)


class ImportedConversationAnalysis(BaseModel):
    """Persist the AI-analysis result.

    Sent by the frontend after it has run the analysis call. The
    server validates the JSON envelope but does NOT prescribe the
    inner schema — the analysis engine's prompt is the spec.
    """

    analysis_result: dict[str, object]


class ImportedConversationOut(BaseModel):
    """API response shape for an imported conversation (summary, no
    transcript)."""

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
    # v1.54.0 — language pair captured at import time, flowed downstream.
    source_language: str | None = None
    target_language: str | None = None


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
    """Partial-update payload for a subject node (all fields optional)."""

    parent_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)


class SubjectOut(BaseModel):
    """API response shape for a taxonomy subject node."""

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
    """Partial-update payload for a tag (all fields optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)


class TagOut(BaseModel):
    """API response shape for a per-user tag."""

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
    """Read-only API response for a project-to-tag association row."""

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
    # GitHub integration (community PR automation)
    "GitHubTokenSetBody",
    "GitHubTokenStatusOut",
    "GitHubVerifyBody",
    "GitHubVerifyOut",
    "GitHubManifestUpdate",
    "GitHubCreatePrBody",
    "GitHubCreatePrOut",
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
    """Catalog entry (Phase 29B; tier fields Phase 57 / v1.40.0)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name_key: str
    description_key: str
    icon: str
    category: str
    # Fixed visual tier (bronze | silver | gold). Phase 57.
    base_tier: str = "bronze"
    # DYNAMIC-badge thresholds {tier: {threshold, xp_bonus}} or None.
    # Stored as a JSON string on the model; the validator decodes it.
    tier_thresholds: dict[str, dict[str, int]] | None = None

    @field_validator("tier_thresholds", mode="before")
    @classmethod
    def _decode_thresholds(cls, value: Any) -> Any:
        if isinstance(value, str):
            return json.loads(value)
        return value


class UserBadgeOut(BaseModel):
    """Earned-badge record (Phase 29B; tier Phase 57 / v1.40.0)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    badge_id: str
    tier: str = "bronze"
    earned_at: datetime
    updated_at: datetime | None = None


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
    # Phase 57 / v1.40.0. ``tier`` is the user's earned tier when
    # earned, else the badge's locked ``base_tier``. ``tier_thresholds``
    # is set for DYNAMIC badges (drives the next-tier progress bar).
    base_tier: str = "bronze"
    tier: str = "bronze"
    tier_thresholds: dict[str, dict[str, int]] | None = None
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


# --- LessonProgress (Phase 44 / EXP-002 / P-109) ---------------------------


class StepResultIn(BaseModel):
    """One step's result, as the viewer reports it on completion."""

    step_id: str = Field(..., min_length=1, max_length=120)
    correct: int = Field(..., ge=0)
    total: int = Field(..., ge=0)
    attempts: int = Field(default=1, ge=1)
    user_answer: str | None = Field(
        default=None,
        max_length=2000,
        description=(
            "Phase 52C / v1.35.0. The user's text-form answer for "
            "the step, when applicable. Free-text + word-tiles "
            "exercises populate this; matching + picture-choice "
            "leave it None. Powers the Phase 52 lesson-summary "
            "token-diff display without a separate ElementError "
            "round-trip."
        ),
    )
    raw_answer: dict[str, Any] | None = Field(
        default=None,
        description=(
            "BUG P1 / Problem 2. The raw user answer "
            "(type-discriminated by a ``kind`` field), persisted "
            "verbatim in the step_results JSON so a revisited "
            "(locked) step re-renders its exact post-check visual "
            "instead of a fresh, re-answerable exercise."
        ),
    )


class LessonProgressUpsert(BaseModel):
    """Body for the upsert endpoint.

    The viewer calls this every time a step completes; the
    server merges the new ``step_result`` into the existing
    JSON map and recomputes the aggregate score.

    Phase 63 widens the upsert body with the lifecycle controls
    (``mark_paused``, ``mark_abandoned``, ``mark_resumed``) so
    every transition flows through the same endpoint the viewer
    already uses for step completion. At most one of the four
    ``mark_*`` flags may be true per call.
    """

    source: str = Field(..., min_length=1, max_length=200)
    set_id: str = Field(..., min_length=1, max_length=120)
    lesson_filename: str = Field(..., min_length=1, max_length=200)
    lesson_mode: str | None = Field(
        default=None,
        max_length=20,
        description=(
            "#1007 Phase 2 — the lesson mode the run is played in "
            "(practice/exam/timed/…). Sent on the first upsert; omitted "
            "leaves the stored value unchanged."
        ),
    )
    step_result: StepResultIn | None = None
    time_spent_seconds_delta: int = Field(default=0, ge=0)
    current_step: int | None = Field(
        default=None,
        ge=0,
        description=(
            "BUG #41 — the step index the user is currently on, so a "
            "paused lesson resumes at the exact step. Omitted leaves "
            "the stored value unchanged."
        ),
    )
    mark_completed: bool = Field(
        default=False,
        description=(
            "Set to true on the lesson-summary screen. Flips "
            "``status`` to ``completed`` + stamps ``completed_at``."
        ),
    )
    mark_paused: bool = Field(
        default=False,
        description=(
            "Phase 63A — flip ``status`` to ``paused`` and stamp "
            "``paused_at``. step_results stay intact for the resume."
        ),
    )
    mark_abandoned: bool = Field(
        default=False,
        description=(
            "Phase 63A — flip ``status`` to ``abandoned`` and stamp "
            "``abandoned_at``. step_results are cleared; ElementErrors "
            "from completed steps stay (what was learned stays "
            "learned)."
        ),
    )
    mark_resumed: bool = Field(
        default=False,
        description=(
            "Phase 63C — flip a ``paused`` row back to ``in_progress`` and clear ``paused_at``."
        ),
    )
    mark_restarted: bool = Field(
        default=False,
        description=(
            "Phase 63C — discard step_results + score and reset "
            "``status`` to ``in_progress`` regardless of the prior "
            "state. Used by the 'Start Over' path in the resume "
            "dialog. Clears ``paused_at`` and ``abandoned_at``."
        ),
    )


class LessonProgressOut(BaseModel):
    """Server-side lesson progress payload.

    ``step_results`` is the parsed JSON map; the DB stores
    it as Text but every route serialises through this schema
    so callers never see the raw string.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    source: str
    set_id: str
    lesson_filename: str
    # "in_progress" | "paused" | "abandoned" | "completed"
    status: str
    # #1007 Phase 2 — the mode the run was played in (practice/exam/…).
    lesson_mode: str = "practice"
    step_results: dict[str, Any]
    score_correct: int
    score_total: int
    time_spent_seconds: int
    current_step: int = 0
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    paused_at: datetime | None = None
    abandoned_at: datetime | None = None
    # #983 — lesson retry with improvement tracking. ``attempts`` counts
    # completed attempts; ``best_score_*`` keep the highest-percentage
    # attempt; ``attempt_history`` lists ``{at, correct, total}`` entries.
    attempts: int = 0
    best_score_correct: int = 0
    best_score_total: int = 0
    attempt_history: list[dict[str, Any]] = Field(default_factory=list)


# --- ElementError (Phase 46B / EXP-007 / P-129) ----------------------------


class ElementAttemptIn(BaseModel):
    """One element attempt — the unit the recording endpoint
    consumes. Multiple attempts per exercise (matching fans out
    one per pair); one attempt per submit for the other types.
    """

    set_id: str = Field(..., min_length=1, max_length=120)
    lesson_id: str = Field(..., min_length=1, max_length=200)
    exercise_id: str = Field(..., min_length=1, max_length=120)
    element_key: str = Field(..., min_length=1, max_length=500)
    direction: Literal["source_to_target", "target_to_source"] = Field(
        default="target_to_source",
        description=(
            "EXP-018 / Phase 62: which drill direction this attempt "
            "belongs to. ``target_to_source`` (receptive, default) "
            "or ``source_to_target`` (productive). Keyed into the "
            "element-error identity so the two directions master "
            "independently. ``both`` / ``random`` are exercise-level "
            "authoring values; a recorded attempt is always one of "
            "the two concrete directions."
        ),
    )
    element_type: str = Field(
        default="vocabulary",
        min_length=1,
        max_length=50,
        description=(
            "Heuristic classification: vocabulary, "
            "grammar_rule, concept. Set by the exercise-side "
            "deriver in commit C9."
        ),
    )
    user_answer: str = Field(default="", max_length=2000)
    correct_answer: str = Field(default="", max_length=2000)
    correct: bool = Field(
        ...,
        description=(
            "True if this attempt was scored as correct. The "
            "service layer increments correct_streak on true; "
            "resets to 0 and bumps error_count on false."
        ),
    )
    hint_used: bool = Field(
        default=False,
        description=(
            "#594 Hint Economy: true when the learner revealed a hint "
            "before answering. Shortens the SRS review interval and "
            "feeds the 'answers with hint' statistic."
        ),
    )
    exam: bool = Field(
        default=False,
        description=(
            "#1040 Exam-Mode SRS boost (Phase 2 of #1007): true when this "
            "attempt was made in exam mode. A correct exam answer is "
            "stronger retention evidence, so the SRS layer LENGTHENS the "
            "review interval (the inverse of the hint factor). The service "
            "stores the boost only when the attempt is also correct."
        ),
    )


class ElementAttemptsIn(BaseModel):
    """Bulk-upsert body. Capped at 100 attempts per call to
    avoid pathological viewer payloads."""

    attempts: list[ElementAttemptIn] = Field(
        ...,
        min_length=1,
        max_length=100,
    )


class AttemptRecordOut(BaseModel):
    """#603 — one recorded attempt in the per-element history ring buffer."""

    correct: bool
    hint_used: bool = False
    at: str


class ElementErrorOut(BaseModel):
    """Server-side element-error payload. Identical shape on
    both ApiStorage and DexieStorage so the review-queue UI
    in Phase 46C can render either source uniformly."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    set_id: str
    lesson_id: str
    exercise_id: str
    element_key: str
    direction: str
    element_type: str
    user_answer: str
    correct_answer: str
    error_count: int
    correct_streak: int
    last_error_at: datetime | None = None
    last_attempt_at: datetime
    mastered: bool
    mastered_at: datetime | None = None
    hint_used: bool = False
    hint_used_count: int = 0
    # #1040 — most recent attempt was a correct exam answer (lengthens the
    # SRS interval). Defaulted so pre-#1040 rows read back as false.
    last_attempt_exam: bool = False
    # #603 Smart Review Queue — total attempts + the last-10 ring buffer.
    attempt_count: int = 0
    attempt_history: list[AttemptRecordOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("attempt_history", mode="before")
    @classmethod
    def _parse_attempt_history(cls, value: object) -> object:
        """Accept the DB's JSON-string column or an already-parsed list."""
        if value is None:
            return []
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except (ValueError, TypeError):
                return []
            return parsed if isinstance(parsed, list) else []
        return value


class ReviewQueueItemOut(BaseModel):
    """One item in the SRS review queue (Phase 46C / C11 /
    P-129). All ElementError fields plus the computed
    scheduling fields ``suggested_review_at`` + ``overdue``.
    Mirrors ``app.services.element_srs.ReviewQueueItem``."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    set_id: str
    lesson_id: str
    exercise_id: str
    element_key: str
    direction: str
    element_type: str
    user_answer: str
    correct_answer: str
    error_count: int
    correct_streak: int
    last_error_at: datetime | None = None
    last_attempt_at: datetime
    suggested_review_at: datetime
    overdue: bool
    # #603 Smart Review Queue — surfaced so the review UI can show the
    # element's trajectory ("attempt 5: correct") + weakness tier.
    attempt_count: int = 0
    attempt_history: list[AttemptRecordOut] = Field(default_factory=list)


class LearningDataDeleteIn(BaseModel):
    """Body for the learner-data delete endpoint (#1821).

    Mirrors the frontend ``LearningDataDeletion`` shape: specific
    lesson-progress row ids plus bare set ids whose element-error
    (review card) rows are removed. Both lists may be empty - an
    empty deletion is a valid zero-count no-op.
    """

    lesson_progress_ids: list[str] = Field(default_factory=list, max_length=1000)
    set_ids: list[str] = Field(default_factory=list, max_length=1000)


class LearningDataDeleteOut(BaseModel):
    """The real per-table counts removed (#1821)."""

    lessons_deleted: int
    cards_deleted: int
