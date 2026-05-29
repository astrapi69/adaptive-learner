"""Domain models for Adaptive Learner (Phase 1B).

The 13 SQLAlchemy 2.0 classes below match
``docs/adaptive-learner-project-reference.md`` §5.1 + §4. They are
plain CRUD shells; routers + services that act on them land in
Phase 1C.

Conventions:

- Primary keys are stringified UUIDv4 (``str(uuid.uuid4())``).
- Timestamps store UTC (``datetime.now(UTC)``) in
  ``DateTime(timezone=True)``.
- Foreign keys use ``ondelete="CASCADE"`` when the child cannot
  outlive the parent (every per-user / per-project / per-session
  row) and ``ondelete="SET NULL"`` for the tree self-reference on
  :class:`LearningTopic` so deleting a parent topic detaches the
  children rather than recursively wiping the subtree.
- The 6 learning-method-weight columns on :class:`LearningProfile`
  are floats in ``[0.0, 1.0]``; the bound is a convention enforced
  at the service layer, not in the DB.
- API-key columns on :class:`UserSettings` are declared as nullable
  strings here; the Phase 1C encryption service wraps Fernet around
  reads / writes (the columns store ciphertext).
- The ``LearningTopic.order_index`` / ``Lesson.order_index`` columns
  appear in the project plan as ``order``; renamed in Python +
  schema so the identifier doesn't collide with the SQL reserved
  word. Public-facing API names keep ``order`` per the plan and
  the schemas alias the field.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


# --- Identity ---------------------------------------------------------------


class User(Base):
    """A learner. The only identity row in the system.

    ``email`` is optional and ``unique`` when present so a single-user
    desktop install (no email) and a multi-user / SaaS deployment
    (email-as-handle) work from the same schema.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, unique=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="de")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    projects: Mapped[list[LearningProject]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    curriculums: Mapped[list[Curriculum]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    profiles: Mapped[list[LearningProfile]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    settings: Mapped[UserSettings | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return f"<User {self.id!r} name={self.name!r}>"


class UserSettings(Base):
    """Per-user settings. 1:1 with :class:`User`.

    Holds the active AI provider name + Fernet-encrypted API keys
    per provider. ``api_key_*`` are declared as plain strings here;
    Phase 1C introduces the encryption service that wraps every
    read / write.
    """

    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    active_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="anthropic")
    # Ciphertext, written by the Phase 1C encryption service.
    api_key_anthropic: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key_openai: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key_gemini: Mapped[str | None] = mapped_column(Text, nullable=True)
    # v0.4.0: per-provider model override. NULL means the
    # session plugin's ai_orchestration.DEFAULT_MODELS pick wins;
    # a non-NULL value replaces it for THAT provider only. Plain
    # text — the model name isn't a secret. String(200) leaves
    # room for fully-qualified upstream model IDs (e.g.
    # ``models/gemini-2.5-pro-exp-03-25``).
    model_override_anthropic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model_override_openai: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model_override_gemini: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="settings")

    def __repr__(self) -> str:
        return f"<UserSettings user={self.user_id!r} provider={self.active_provider!r}>"

    # --- Computed fields consumed by ``UserSettingsOut.model_validate(row)``.

    @property
    def language(self) -> str:
        """Mirror the parent :class:`User`'s language so the settings
        response is a single fetch for the frontend. Falls back to
        ``"de"`` when the user relationship is not loaded (defensive
        only — every router-layer caller loads the parent first).
        """
        return self.user.language if self.user else "de"

    @property
    def has_anthropic_key(self) -> bool:
        return self.api_key_anthropic is not None

    @property
    def has_openai_key(self) -> bool:
        return self.api_key_openai is not None

    @property
    def has_gemini_key(self) -> bool:
        return self.api_key_gemini is not None


# --- Learning projects ------------------------------------------------------

# v1.31.0 / Phase 46F: LearningProject.kind splits the wizard-
# created "standard" projects from the auto-managed "content"
# pseudo-project that backs the LessonProgress<->LearningSession
# unification. Frontend project pickers (Dashboard, Onboarding,
# LearningRepoSettings) filter out the "content" kind so the
# pseudo-project never appears as a legit learning goal. See
# .claude/rules/architecture.md and docs/journal/handover-to-v1.31.0.md
# for the D1 decision rationale.
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"
LEARNING_PROJECT_KINDS = frozenset({LEARNING_PROJECT_KIND_STANDARD, LEARNING_PROJECT_KIND_CONTENT})


class LearningProject(Base):
    """A user's concrete learning goal.

    Captures the onboarding answers: WHAT they want to learn
    (``topic``), WHY (``goal``), how long (``timeframe``), how much
    time per day (``daily_minutes``), and the user's self-reported
    current obstacle (``current_problem``). ``active`` is a soft-
    archive flag — the row stays for history.
    """

    __tablename__ = "learning_projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    timeframe: Mapped[str] = mapped_column(String(100), nullable=False)
    daily_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    current_problem: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="projects")
    profiles: Mapped[list[LearningProfile]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[LearningSession]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    progress_commits: Mapped[list[ProgressCommit]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    method_switches: Mapped[list[MethodSwitch]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<LearningProject {self.id!r} topic={self.topic!r} active={self.active}>"


class LearningProfile(Base):
    """The 6-method-weight assessment for a (user, project) pair.

    Each weight is a float in ``[0.0, 1.0]``; the bound is enforced
    by the assessment service (Phase 3), not the DB. ``version``
    counts re-assessments so a stagnation-triggered retake leaves
    the prior row in place for history.
    """

    __tablename__ = "learning_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deductive: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    inductive: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    error_based: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    dialogic: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    contextual: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ai_adaptive: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    user: Mapped[User] = relationship(back_populates="profiles")
    project: Mapped[LearningProject] = relationship(back_populates="profiles")

    def __repr__(self) -> str:
        return (
            f"<LearningProfile project={self.project_id!r} "
            f"v{self.version} dominant={self.dominant_method!r}>"
        )

    @property
    def dominant_method(self) -> str:
        """Method key with the highest weight (ties resolve alphabetically).

        Convenience for ``__repr__`` and dashboard summaries; the
        actual method-pick logic in the session plugin reads the
        full weight vector, not just the argmax.
        """
        weights = {
            "deductive": self.deductive,
            "inductive": self.inductive,
            "error_based": self.error_based,
            "dialogic": self.dialogic,
            "contextual": self.contextual,
            "ai_adaptive": self.ai_adaptive,
        }
        return max(sorted(weights), key=weights.__getitem__)


# --- Curriculum (hierarchical) ---------------------------------------------


class Curriculum(Base):
    """A structured learning track owned by a user.

    Curriculum -> LearningTopic (tree, via ``parent_id`` self-FK on
    :class:`LearningTopic`) -> Lesson (flat list inside the
    curriculum). Independent of :class:`LearningProject`: a single
    curriculum can back multiple projects, and a project can run
    without a curriculum (free-form learning).
    """

    __tablename__ = "curriculums"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="de")
    # Phase 36 Bug 3 — children-side FK back to the conversation the
    # curriculum was auto-generated from. Nullable: free-form
    # curricula keep ``NULL``. ``SET NULL`` on delete so removing
    # the source conversation does not wipe the derived curriculum.
    # Indexed so the ImportDetail page's "did this conversation
    # already produce a curriculum?" check is O(log n).
    imported_conversation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("imported_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="curriculums")
    topics: Mapped[list[LearningTopic]] = relationship(
        back_populates="curriculum",
        cascade="all, delete-orphan",
        order_by="LearningTopic.order_index",
    )
    lessons: Mapped[list[Lesson]] = relationship(
        back_populates="curriculum",
        cascade="all, delete-orphan",
        order_by="Lesson.order_index",
    )

    def __repr__(self) -> str:
        return f"<Curriculum {self.id!r} title={self.title!r}>"


class LearningTopic(Base):
    """One node in a curriculum's topic tree.

    ``parent_id`` is a nullable self-FK with ``ondelete="SET NULL"``:
    deleting a parent detaches the children (they become roots of
    their own subtrees) instead of cascading the delete. Curriculum
    deletion still wipes the whole tree via the curriculum-level
    cascade.

    ``order_index`` is the spec's ``order`` field, renamed because
    ``order`` is a SQL reserved word on most dialects. The Pydantic
    schema layer can expose it as ``order`` to keep the API name
    aligned with the plan.
    """

    __tablename__ = "learning_topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    curriculum_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("curriculums.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("learning_topics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    curriculum: Mapped[Curriculum] = relationship(back_populates="topics")
    parent: Mapped[LearningTopic | None] = relationship(
        remote_side="LearningTopic.id", back_populates="children"
    )
    children: Mapped[list[LearningTopic]] = relationship(
        back_populates="parent",
        order_by="LearningTopic.order_index",
    )

    def __repr__(self) -> str:
        return f"<LearningTopic {self.id!r} title={self.title!r} parent={self.parent_id!r}>"


class Lesson(Base):
    """A single learning unit inside a curriculum.

    Flat list under the curriculum (independent of the topic tree
    at this layer; a future :class:`LearningTopicLesson` join model
    can attach lessons to topics if it becomes useful).
    """

    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    curriculum_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("curriculums.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    curriculum: Mapped[Curriculum] = relationship(back_populates="lessons")

    def __repr__(self) -> str:
        return f"<Lesson {self.id!r} title={self.title!r} order={self.order_index}>"


# --- Sessions ---------------------------------------------------------------


class LearningSession(Base):
    """One run through the 7-step learning cycle for a method.

    ``method`` is one of the six method keys (``deductive``,
    ``inductive``, ``error_based``, ``dialogic``, ``contextual``,
    ``ai_adaptive``). ``cycle_step`` tracks position 1..7. ``status``
    is one of ``active`` / ``completed`` / ``abandoned``.
    """

    __tablename__ = "learning_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    method: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cycle_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # v1.4.0 — auto-loop after step 7. ``cycle_count`` starts at 1
    # and increments when the topic-transition evaluator advances
    # to a new subtopic. ``cycle_topics`` stores a JSON array of
    # per-cycle summaries (topic + summary) so the session detail
    # export can show the full multi-cycle journey.
    cycle_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cycle_topics: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # Phase 36 Bug 4 — children-side FK back to the imported
    # conversation this session was started FROM (the user clicked
    # "Start session" on the analysis page). Nullable: free-form
    # sessions keep ``NULL``. ``SET NULL`` on delete so removing
    # the source conversation does not delete the session. Indexed
    # so ImportDetail's "is there an active session for this
    # conversation?" lookup is O(log n).
    imported_conversation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("imported_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    project: Mapped[LearningProject] = relationship(back_populates="sessions")
    messages: Mapped[list[SessionMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionMessage.created_at",
    )
    ratings: Mapped[list[SessionRating]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionRating.created_at",
    )
    notes: Mapped[list[SessionNote]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionNote.created_at",
    )
    progress_commits: Mapped[list[ProgressCommit]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ProgressCommit.committed_at",
    )
    step_evaluations: Mapped[list[StepEvaluation]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="StepEvaluation.evaluated_at",
    )

    def __repr__(self) -> str:
        return (
            f"<LearningSession {self.id!r} method={self.method!r} "
            f"step={self.cycle_step} status={self.status!r}>"
        )


class SessionMessage(Base):
    """One chat message inside a :class:`LearningSession`.

    ``role`` is ``user`` / ``assistant`` / ``system``.
    """

    __tablename__ = "session_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    session: Mapped[LearningSession] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        return f"<SessionMessage session={self.session_id!r} role={self.role!r}>"


class SessionRating(Base):
    """End-of-session self-rating: understanding, stress, method fit.

    All three are integers in ``[1, 5]``; the bound is enforced at
    the schema / service layer.
    """

    __tablename__ = "session_ratings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    understanding: Mapped[int] = mapped_column(Integer, nullable=False)
    stress: Mapped[int] = mapped_column(Integer, nullable=False)
    method_fit: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    session: Mapped[LearningSession] = relationship(back_populates="ratings")

    def __repr__(self) -> str:
        return (
            f"<SessionRating session={self.session_id!r} "
            f"u={self.understanding} s={self.stress} fit={self.method_fit}>"
        )


# v1.26.0 / Phase 42 — known SessionNote kinds. Free-text
# String(32) column (matches MethodSwitch.from_method /
# to_method shape — no DB-level enum constraint), but these
# constants are the canonical set the rest of the codebase
# uses. The "meta_learning" kind is the Article-3
# "Meta-Learning Insight" slot consumed by the
# learning-repo plugin renderer.
SESSION_NOTE_KIND_NOTE = "note"
SESSION_NOTE_KIND_META_LEARNING = "meta_learning"
SESSION_NOTE_KINDS = frozenset({SESSION_NOTE_KIND_NOTE, SESSION_NOTE_KIND_META_LEARNING})


class SessionNote(Base):
    """Free-form note the user writes during / after a session."""

    __tablename__ = "session_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # v1.26.0 / Phase 42 — see SESSION_NOTE_KINDS above. Free
    # text at the DB layer; callers should prefer the
    # SESSION_NOTE_KIND_* constants.
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default=SESSION_NOTE_KIND_NOTE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    # v1.8.0 / Phase 21B — promoted SessionNote from append-only
    # to mutable for the sync surface. Notes are user-editable in
    # the UI; ``updated_at`` is the timestamp the sync push/pull
    # conflict-resolution layer compares.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    session: Mapped[LearningSession] = relationship(back_populates="notes")

    def __repr__(self) -> str:
        return f"<SessionNote {self.id!r} session={self.session_id!r}>"


# --- Progress + adaptive switching ------------------------------------------


class ProgressCommit(Base):
    """One "commit" in the Git-as-learning-metaphor.

    Written after a session ends. Carries the aggregate metrics the
    stagnation-detector needs to decide whether to recommend a
    method switch.
    """

    __tablename__ = "progress_commits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    method: Mapped[str] = mapped_column(String(50), nullable=False)
    understanding: Mapped[float] = mapped_column(Float, nullable=False)
    stress: Mapped[float] = mapped_column(Float, nullable=False)
    error_rate: Mapped[float] = mapped_column(Float, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    committed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    project: Mapped[LearningProject] = relationship(back_populates="progress_commits")
    session: Mapped[LearningSession] = relationship(back_populates="progress_commits")

    def __repr__(self) -> str:
        return (
            f"<ProgressCommit project={self.project_id!r} method={self.method!r} "
            f"u={self.understanding:.2f}>"
        )


class StepEvaluation(Base):
    """v0.5.0 — one Phase-8 dual-prompt evaluation verdict.

    Written by the session plugin's /message route on every
    successful round-trip when step_evaluation is enabled. Carries
    BOTH the evaluator's raw verdict AND the route's derived
    ``applied`` decision so the 8D analytics layer can answer:

    - average confidence per session / project
    - how often the AI said "not ready yet" (``applied=False``)
    - how often the deterministic fallback fired
      (``fallback_used=True``)
    - time spent per cycle step (diff of ``evaluated_at`` grouped
      by ``from_step``)

    Cascades on session delete so abandoned-session cleanup stays
    clean. ``reason`` is Text rather than String because models
    occasionally emit reasons >200 chars in non-Latin scripts.
    """

    __tablename__ = "step_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_step: Mapped[int] = mapped_column(Integer, nullable=False)
    to_step: Mapped[int] = mapped_column(Integer, nullable=False)
    advance: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    applied: Mapped[bool] = mapped_column(Boolean, nullable=False)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    session: Mapped[LearningSession] = relationship(back_populates="step_evaluations")

    def __repr__(self) -> str:
        return (
            f"<StepEvaluation session={self.session_id!r} "
            f"{self.from_step}->{self.to_step} "
            f"applied={self.applied} conf={self.confidence:.2f}>"
        )


class MethodSwitch(Base):
    """Documents a method switch on a project.

    Either user-initiated or accepted from the stagnation-detector's
    recommendation. ``reason`` is free text the session plugin
    fills in.
    """

    __tablename__ = "method_switches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_method: Mapped[str] = mapped_column(String(50), nullable=False)
    to_method: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    switched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    project: Mapped[LearningProject] = relationship(back_populates="method_switches")

    def __repr__(self) -> str:
        return (
            f"<MethodSwitch project={self.project_id!r} {self.from_method!r}->{self.to_method!r}>"
        )


# --- Imported conversations (Phase 12C) -------------------------------------


class ImportedConversation(Base):
    """One conversation imported from an external chat tool.

    Carries the metadata; ``messages`` is the linear transcript.
    ``analysis_result`` stores the JSON blob produced by the AI
    analysis engine (Phase 12D) — written once, read many times
    by the analysis-results UI.

    Soft-FK to :class:`LearningProject`: a user can pick a project
    when importing OR leave it unattached and assign later. The
    ``ondelete="SET NULL"`` keeps the conversation alive when the
    parent project is deleted (the user's history outlives one
    project).
    """

    __tablename__ = "imported_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="unknown")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    analyzed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Stored as JSON string so the column stays SQLite-portable
    # (sqlite has no native JSON column). Schema validates on read.
    analysis_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic_tag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Phase 36 Bug 1 — SHA-256 of role-prefixed, content-stripped
    # messages joined by ``\n``. Title is NOT part of the hash so
    # re-importing the same transcript with a different display
    # title still detects as a duplicate. Nullable to keep rows
    # created before Alembic 0014 valid; the back-fill in that
    # migration populates every existing row.
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    messages: Mapped[list[ImportedMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ImportedMessage.order_index",
    )

    def __repr__(self) -> str:
        return (
            f"<ImportedConversation {self.id!r} source={self.source!r} "
            f"title={self.title!r} messages={self.message_count}>"
        )


class ImportedMessage(Base):
    """One row in an imported conversation transcript.

    ``order_index`` is the canonical ordering; ``timestamp`` is
    optional and only carried when the source format had one.
    """

    __tablename__ = "imported_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("imported_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # v1.8.0 / Phase 21D — per-row timestamp for sync surface
    # inclusion. Backfilled from parent conversation's
    # ``imported_at`` via Alembic 0007.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    conversation: Mapped[ImportedConversation] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        return (
            f"<ImportedMessage conv={self.conversation_id!r} "
            f"role={self.role!r} order={self.order_index}>"
        )


# --- Taxonomy: Subjects + Tags (Phase 22) ----------------------------------


class Subject(Base):
    """A node in the global subject taxonomy.

    Hierarchical (``parent_id`` self-FK, same pattern as
    :class:`LearningTopic`). GLOBAL: not scoped to a user — pre-seeded
    on first run plus any user-created custom subjects. Cross-project:
    a single Subject can be assigned to multiple
    :class:`LearningProject` rows via :class:`ProjectSubject`.

    Deleting a parent detaches the children rather than recursively
    wiping the subtree (``ondelete="SET NULL"``), so a custom-subject
    removal doesn't take its (potentially also user-meaningful)
    descendants with it.
    """

    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    parent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    parent: Mapped[Subject | None] = relationship(
        remote_side="Subject.id", back_populates="children"
    )
    children: Mapped[list[Subject]] = relationship(
        back_populates="parent",
        order_by="Subject.name",
    )

    def __repr__(self) -> str:
        return f"<Subject {self.id!r} name={self.name!r} parent={self.parent_id!r}>"


class Tag(Base):
    """A user-scoped flat label.

    Per-user (``user_id`` FK, unique-per-user on ``name``). Tags are
    free-form labels the learner creates ad hoc — exam-prep,
    daily-practice, high-priority. Cross-project: a single Tag can
    attach to multiple :class:`LearningProject` rows via
    :class:`ProjectTag`. Optional ``color`` is a hex string the UI
    renders as the badge background.
    """

    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    def __repr__(self) -> str:
        return f"<Tag {self.id!r} user={self.user_id!r} name={self.name!r}>"


class ProjectSubject(Base):
    """Many-to-many between :class:`LearningProject` and :class:`Subject`.

    Append-only association — assigning or unassigning a subject is
    an insert / delete on this table, never an update.
    """

    __tablename__ = "project_subjects"
    __table_args__ = (
        UniqueConstraint("project_id", "subject_id", name="uq_project_subjects_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    def __repr__(self) -> str:
        return f"<ProjectSubject project={self.project_id!r} subject={self.subject_id!r}>"


class ProjectTag(Base):
    """Many-to-many between :class:`LearningProject` and :class:`Tag`."""

    __tablename__ = "project_tags"
    __table_args__ = (UniqueConstraint("project_id", "tag_id", name="uq_project_tags_pair"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    def __repr__(self) -> str:
        return f"<ProjectTag project={self.project_id!r} tag={self.tag_id!r}>"


# --- Gamification (Phase 29) -----------------------------------------------


class UserXP(Base):
    """Per-user XP and level singleton (Phase 29A).

    One row per user (unique ``user_id``). XP accumulates over the
    lifetime of the account; ``level`` is derived from ``total_xp``
    via the exponential curve in
    ``adaptive_learner_gamification.xp_service.compute_level``. The
    column is denormalised so the dashboard can read it without
    recomputing.

    The gamification plugin owns the write path (
    ``on_session_complete`` + the assessment / import earn hooks);
    routes read from this table.
    """

    __tablename__ = "user_xp"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    def __repr__(self) -> str:
        return f"<UserXP user={self.user_id!r} xp={self.total_xp} level={self.level}>"


class Badge(Base):
    """Catalog of available badges (Phase 29B).

    Seeded from ``plugins/adaptive-learner-plugin-gamification/
    badges.yaml`` on first startup; the seeder is idempotent on
    the ``key`` slug. ``name_key`` and ``description_key`` are
    i18n catalog references (under ``gamification.badges.*``)
    rather than literal strings so the badge surface translates
    across all 8 languages without touching the DB.
    """

    __tablename__ = "badges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name_key: Mapped[str] = mapped_column(String(200), nullable=False)
    description_key: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    def __repr__(self) -> str:
        return f"<Badge key={self.key!r} category={self.category!r}>"


class AnkiCardSuggestion(Base):
    """AI-extracted flashcard candidate (Phase 30B).

    Produced by the Anki plugin's extractor (either from a
    completed session's transcript or from
    :class:`ImportedConversation.analysis_result.vocabulary`).
    The user reviews each row in the export UI, edits inline if
    needed, then marks ``accepted=True``. Only accepted rows
    land in a .apkg export.

    ``session_id`` is nullable — vocabulary cards extracted from
    an imported conversation have no parent session. Exactly one
    of ``session_id`` / ``conversation_id`` is set in practice
    (asserted at the service layer, not in the DB constraint).
    """

    __tablename__ = "anki_card_suggestions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("imported_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # "basic" | "cloze"
    card_type: Mapped[str] = mapped_column(String(20), nullable=False, default="basic")
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    # JSON-encoded list of tag strings ([] when empty).
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rejected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    def __repr__(self) -> str:
        return (
            f"<AnkiCardSuggestion id={self.id!r} type={self.card_type!r} "
            f"accepted={self.accepted} front={self.front[:30]!r}>"
        )


class StudyQuestion(Base):
    """AI-generated active-recall question (Phase 32B / v1.19.0).

    Produced by the NotebookLM plugin's question generator (from
    a session transcript or from project-wide data). The user
    reviews, edits, deletes, or accepts each. Accepted questions
    feed the NotebookLM ZIP export's ``flashcards.md`` and the
    Progress page's Study Questions section.

    ``session_id`` is nullable — project-wide generation produces
    rows with no parent session. ``difficulty`` is one of
    ``"easy" | "medium" | "hard"`` (AI picks per question; user
    can edit).
    """

    __tablename__ = "study_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("learning_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("learning_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # "open" | "fill_blank" | "explain" | "compare"
    question_type: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    difficulty: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    topic: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    # User-edited flag. Set by PATCH when the question/answer text
    # changes so the AI doesn't re-generate identical rows on a
    # repeat run.
    edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    def __repr__(self) -> str:
        return (
            f"<StudyQuestion id={self.id!r} project={self.project_id!r} "
            f"difficulty={self.difficulty!r} question={self.question[:40]!r}>"
        )


class UserStreak(Base):
    """Per-user streak state singleton (Phase 29C).

    Holds the streak fields that need persistence beyond what
    we can derive from ``LearningSession`` activity alone:

    - ``freezes_available``: 0..N, max 1 freeze per 7 days. A
      freeze pauses (not resets) the streak when the user
      misses a day. Earned passively as the streak grows.
    - ``last_freeze_earned_on``: the calendar date of the last
      freeze grant; used to throttle the "1 per 7 days" rule.
    - ``last_freeze_used_on``: the date the user most recently
      consumed a freeze (so a missed day doesn't double-spend).
    - ``weekend_mode``: when true, weekends don't count toward
      streak gaps (Saturday/Sunday gaps don't reset).
    - ``current_streak_days`` / ``longest_streak_days``: cached
      snapshots; the live streak is still derived from
      ``LearningSession`` rows (this is the *enhanced* counter
      that respects freeze + weekend mode).
    """

    __tablename__ = "user_streaks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    freezes_available: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_freeze_earned_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_freeze_used_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    weekend_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    current_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    longest_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    def __repr__(self) -> str:
        return (
            f"<UserStreak user={self.user_id!r} current={self.current_streak_days} "
            f"longest={self.longest_streak_days} freezes={self.freezes_available}>"
        )


class UserBadge(Base):
    """Earned-badge record (Phase 29B).

    APPEND-ONLY: once a user earns a badge, the row stays. Unique
    on ``(user_id, badge_id)`` so the evaluator can't double-award
    the same badge.
    """

    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badges_pair"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    badge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("badges.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    def __repr__(self) -> str:
        return (
            f"<UserBadge user={self.user_id!r} badge={self.badge_id!r} "
            f"earned_at={self.earned_at!r}>"
        )


class LessonProgress(Base):
    """User progress on a single content-set lesson
    (Phase 44 / EXP-002 / P-109).

    Per-user × per-lesson row. ``set_id`` and ``lesson_filename``
    point at the content-loader cache; the loader resolves them
    to a ``Lesson`` payload at lesson-open time.

    ``step_results`` carries a JSON-encoded mapping of
    ``{step_id: {correct, total, attempts, completed_at}}`` so
    the viewer can resume a partially-completed lesson and the
    Phase 46 SRS layer can replay step-level performance.

    Parallel to ``LearningSession`` — the session plugin's
    7-step AI-driven model and the content-loader's N-step
    deterministic model differ enough that unifying them is
    a Phase 46 concern (when XP / streak / progress-commit
    integration lands). For v1.28.0 the two systems coexist;
    a lesson does NOT award XP yet, and a session does NOT
    advance lesson progress.
    """

    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source",
            "set_id",
            "lesson_filename",
            name="uq_lesson_progress_user_lesson",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The content-loader source slug shape (``owner/name``).
    # NOT a FK — content sources live in the cache, not the DB.
    source: Mapped[str] = mapped_column(String(200), nullable=False)
    set_id: Mapped[str] = mapped_column(String(120), nullable=False)
    lesson_filename: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    # ``in_progress`` | ``completed``
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="in_progress",
    )
    # JSON object: {step_id: {correct: int, total: int,
    #   attempts: int, completed_at: ISO-8601 string}}.
    # Empty ``{}`` when nothing answered yet.
    step_results: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
    )
    # Aggregate score across all scored exercise steps the
    # user attempted. Lesson-summary screen surfaces these.
    score_correct: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    score_total: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    # Wall-clock seconds the user has spent inside the lesson
    # across all visits. Updated on completion / abandonment.
    time_spent_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<LessonProgress user={self.user_id!r} "
            f"set={self.set_id!r} lesson={self.lesson_filename!r} "
            f"status={self.status!r}>"
        )


class ElementError(Base):
    """Per-element error + mastery tracking (Phase 46B / 4B /
    P-129 — element-level spaced repetition).

    A row tracks one learnable atom — a vocabulary word, a
    grammar rule, a concept — for one user across one
    exercise. The element is identified by the composite
    ``(user_id, set_id, lesson_id, exercise_id, element_key)``
    where ``element_key`` is the canonical surface text the
    exercise teaches (e.g. ``"merci"`` for a free-text
    exercise whose ``accept[0]`` is ``"Merci"``).

    Lesson-scoped by design (D2, Phase 46 plan): the same
    word in two different lessons is two separate elements.
    Cross-lesson element sharing is a future phase (it
    interacts with content versioning + set updates +
    domain-author tagging).

    ``error_count`` is the lifetime wrong-attempt count;
    monotonic — never decremented. ``correct_streak`` is
    the consecutive-correct counter since the last wrong
    answer; resets to 0 on every wrong attempt. The element
    flips ``mastered=true`` when ``correct_streak`` reaches
    the ``MASTERY_THRESHOLD`` constant (3 in v1, hardcoded;
    see Phase 46 D4). The service layer (commit C5) owns
    the transition. Mastered elements are excluded from the
    review queue but stay in the DB as the audit trail.

    Decoupled from ``LearningSession``: no FK. The
    Phase 46F unification (v1.31.0) will introduce the
    "Content Lessons" pseudo-project and create
    ``LearningSession`` rows on lesson completion; this
    table stays as-is and its rows continue to reference
    the lesson by string id, not by session FK. Keeps the
    v1.30.0 element-tracking foundation independent of the
    v1.31.0 unification work.
    """

    __tablename__ = "element_errors"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "set_id",
            "lesson_id",
            "exercise_id",
            "element_key",
            name="uq_element_errors_user_element",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Content-loader identifiers stored as strings — NOT FKs.
    # The content set / lesson / exercise live in the cache,
    # not the DB; the element-error rows survive cache evictions.
    set_id: Mapped[str] = mapped_column(String(120), nullable=False)
    lesson_id: Mapped[str] = mapped_column(String(200), nullable=False)
    exercise_id: Mapped[str] = mapped_column(String(120), nullable=False)
    element_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # "vocabulary" | "grammar_rule" | "concept" — derived
    # heuristically from the exercise type at recording time.
    element_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="vocabulary",
    )
    # Last attempt's text. Overwritten on each new attempt;
    # historical attempts are not preserved at the row level
    # (the review queue only needs the most recent context).
    user_answer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Lifetime wrong-attempt count. Monotonic.
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Consecutive-correct counter since last wrong answer.
    # Resets to 0 on wrong; flips ``mastered`` when it reaches
    # the threshold.
    correct_streak: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    last_error_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # Set on every attempt (correct OR wrong). Drives the SRS
    # "days since last seen" calculation in commit C11.
    last_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    mastered: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    mastered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    def __repr__(self) -> str:
        return (
            f"<ElementError user={self.user_id!r} "
            f"set={self.set_id!r} lesson={self.lesson_id!r} "
            f"key={self.element_key!r} errors={self.error_count} "
            f"streak={self.correct_streak} mastered={self.mastered}>"
        )


class UserMission(Base):
    """A daily mission assigned to a user (EXP-010 / Phase 56).

    The mission CATALOG (``MissionTemplate``) is static config
    loaded from ``config/plugins/missions.yaml`` - only the
    per-user, per-day assignment + progress lives here, the one
    new tracking table the feature adds. ``template_id`` references
    a catalog entry by its string id; ``assigned_date`` is the day
    the mission was handed out (deterministic assignment seeded by
    ``user_id`` + date). ``xp_awarded`` guards against
    double-awarding the completion bonus.
    """

    __tablename__ = "user_missions"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "template_id",
            "assigned_date",
            name="uq_user_missions_user_template_date",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[str] = mapped_column(String(100), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    xp_awarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    def __repr__(self) -> str:
        return (
            f"<UserMission user={self.user_id!r} "
            f"template={self.template_id!r} date={self.assigned_date} "
            f"progress={self.progress} completed={self.completed}>"
        )


__all__ = [
    "Base",
    "User",
    "UserSettings",
    "LearningProject",
    "LearningProfile",
    "Curriculum",
    "LearningTopic",
    "Lesson",
    "LearningSession",
    "SessionMessage",
    "SessionRating",
    "SessionNote",
    "ProgressCommit",
    "StepEvaluation",
    "MethodSwitch",
    "ImportedConversation",
    "ImportedMessage",
    "Subject",
    "Tag",
    "ProjectSubject",
    "ProjectTag",
    "UserXP",
    "Badge",
    "UserBadge",
    "UserStreak",
    "AnkiCardSuggestion",
    "StudyQuestion",
    "LessonProgress",
    "ElementError",
    "UserMission",
]
