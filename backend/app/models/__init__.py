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
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
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
]
