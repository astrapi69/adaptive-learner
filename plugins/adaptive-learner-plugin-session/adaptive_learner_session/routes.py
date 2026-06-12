"""FastAPI routes for the session plugin.

  POST /api/plugins/session/start              -> SessionStartOut
  POST /api/plugins/session/{id}/message       -> SessionMessageExchangeOut
  POST /api/plugins/session/{id}/rate          -> SessionRatingOut
  POST /api/plugins/session/{id}/end           -> SessionEndOut

POST /start:
  Body: {project_id, method?, cycle_step?, lang?}. If ``method`` is
  omitted, the latest LearningProfile's dominant method seeds it
  (falls back to ``deductive`` when no profile exists). Returns
  the new session + the composed system prompt; the prompt is
  ALSO saved as the first ``role=system`` SessionMessage so the
  ai_complete hook can replay the full history without an
  external sidecar.

POST /message (v0.2.0):
  Body: {role: user, content}. Saves the user message, fires the
  ``ai_complete`` hook against the active provider's API key /
  default model, saves the assistant reply, and returns BOTH
  messages plus an optional ``ai_error`` string. The orchestration
  shifted server-side in v0.2.0 (was client-side in v0.1.0) so:
    - The provider's API key never reaches the browser.
    - Conversation history stays consistent regardless of which
      caller (browser, external integration, future CLI) posts the
      message.
    - A missing-key / provider-down failure degrades gracefully:
      the user message is saved, the route returns
      ``assistant_message: null`` + ``ai_error``.

POST /rate:
  Body: {understanding, stress, method_fit, notes?}. Persists a
  SessionRating row.

POST /end:
  Body: optional. Marks the session ``completed`` + ``ended_at``,
  fires the ``on_session_complete`` hook so the tracking plugin
  (Phase 3-D) can write its ProgressCommit row.

GET /switch-recommendation/{session_id} (v0.2.0):
  Returns the current ``recommend_method_switch`` hook output for
  the most recent ratings on the session's project. Shape:
  ``{recommended: bool, to_method?: str, reason?: str}``.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import (
    ImportedConversation,
    LearningProfile,
    LearningProject,
    LearningSession,
    MethodSwitch,
    SessionMessage,
    SessionRating,
    User,
)
from app.models import (
    StepEvaluation as StepEvaluationRow,
)
from app.schemas import (
    AIProvider,
    LearningMethod,
    LearningSessionOut,
    MessageRole,
    SessionMessageOut,
    SessionRatingOut,
)
from app.services.ai_caller import build_ai_caller

from . import ai_orchestration
from .prompts import (
    MAX_STEP,
    METHODS,
    MIN_STEP,
    build_analysis_context,
    build_prompt,
)
from .step_evaluator import (
    EVALUATION_DEFAULT_MAX_TOKENS,
    StepEvaluation,
    evaluate_step,
)
from .topic_transition import (
    TopicTransition,
    evaluate_topic_transition,
)


def _read_step_evaluation_config() -> tuple[bool, float, int]:
    """Return ``(enabled, confidence_threshold, max_tokens)`` for the
    Phase-8 step-evaluator from ``config/plugins/session.yaml`` with
    sensible defaults.

    Defaults (Phase 8B spec):
      enabled: True
      confidence_threshold: 0.7
      max_tokens: 256

    A missing config file (or a missing ``step_evaluation`` block)
    yields the defaults. Reading inside the route on every call is
    cheap (small YAML file, OS file cache) AND avoids the
    module-level lru_cache test-isolation pitfall called out in
    lessons-learned.md.
    """
    # Lazy import: keep app.* out of the module load path so this
    # file stays importable from the standalone plugin test dir.
    from app.config_overlay import read_plugin_config_merged

    try:
        cfg = read_plugin_config_merged("session")
    except Exception:  # noqa: BLE001 — config glitch must never block /message
        cfg = {}
    block = cfg.get("step_evaluation") if isinstance(cfg, dict) else None
    if not isinstance(block, dict):
        block = {}
    enabled = bool(block.get("enabled", True))
    try:
        threshold = float(block.get("confidence_threshold", 0.7))
    except (TypeError, ValueError):
        threshold = 0.7
    if threshold < 0.0:
        threshold = 0.0
    elif threshold > 1.0:
        threshold = 1.0
    try:
        max_tokens = int(block.get("max_tokens", EVALUATION_DEFAULT_MAX_TOKENS))
    except (TypeError, ValueError):
        max_tokens = EVALUATION_DEFAULT_MAX_TOKENS
    if max_tokens <= 0:
        max_tokens = EVALUATION_DEFAULT_MAX_TOKENS
    return enabled, threshold, max_tokens


def _read_async_evaluation_enabled() -> bool:
    """Read ``session.async_evaluation`` config flag (v1.5.0 / 18C).

    Default ``True``: at the step 6 -> 7 transition the route fires
    step_evaluation and topic_transition concurrently via
    ``asyncio.gather`` instead of sequentially. Set to ``False``
    to fall back to the v1.4.0 sequential behaviour.
    """
    from app.config_overlay import read_plugin_config_merged

    try:
        cfg = read_plugin_config_merged("session")
    except Exception:  # noqa: BLE001
        cfg = {}
    if not isinstance(cfg, dict):
        return True
    raw = cfg.get("async_evaluation")
    if raw is None:
        return True
    return bool(raw)


def _read_auto_loop_config() -> tuple[bool, int, int]:
    """Return ``(enabled, max_cycles, transition_max_tokens)`` for the
    v1.4.0 auto-loop feature from ``config/plugins/session.yaml``.

    Defaults match the spec: enabled, max_cycles=5,
    transition_max_tokens=256. A missing block yields the defaults.
    """
    from app.config_overlay import read_plugin_config_merged

    try:
        cfg = read_plugin_config_merged("session")
    except Exception:  # noqa: BLE001 — never block /message
        cfg = {}
    block = cfg.get("auto_loop") if isinstance(cfg, dict) else None
    if not isinstance(block, dict):
        block = {}
    enabled = bool(block.get("enabled", True))
    try:
        max_cycles = int(block.get("max_cycles", 5))
    except (TypeError, ValueError):
        max_cycles = 5
    if max_cycles < 1:
        max_cycles = 1
    try:
        tt_max = int(block.get("topic_transition_max_tokens", 256))
    except (TypeError, ValueError):
        tt_max = 256
    if tt_max <= 0:
        tt_max = 256
    return enabled, max_cycles, tt_max


router = APIRouter(prefix="/plugins/session", tags=["session"])


# --- Body / response schemas (plugin-local) -------------------------------


class _StartBody(BaseModel):
    project_id: str = Field(min_length=1)
    method: LearningMethod | None = None
    cycle_step: int = Field(default=1, ge=MIN_STEP, le=MAX_STEP)
    lang: str = "de"
    # Phase 36 Bug 4 — children-side FK back to the imported
    # conversation this session was started from. The router uses
    # it to resume an existing active session for the same
    # conversation instead of always creating a new one.
    imported_conversation_id: str | None = None


class _SessionStartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut
    system_prompt: str


class _MessageBody(BaseModel):
    role: MessageRole
    content: str = Field(min_length=1)


class _StepEvaluationOut(BaseModel):
    """v0.5.0 — AI step-evaluation result for the dual-prompt
    architecture (Phase 8).

    ``advance`` / ``confidence`` / ``reason`` / ``suggested_step``
    are the evaluator's raw verdict. ``applied`` is the route's
    DERIVED decision (advance ∧ confidence ≥ threshold; or
    fallback ∧ advance) — true iff the suggestion was actually
    written to ``session.cycle_step``. ``from_step`` is the
    cycle_step BEFORE the suggestion, useful for the 8C
    front-end transition animation and the 8D analytics layer.

    When the route's step_evaluation config is ``enabled: false``
    the route writes ``step_evaluation: null`` and falls back to
    the v0.4.x deterministic +1 advance — Phase 8B's compat
    contract for installs that opt out of AI-based transitions.
    """

    model_config = ConfigDict(from_attributes=True)

    advance: bool
    confidence: float
    reason: str
    suggested_step: int
    fallback_used: bool
    applied: bool
    from_step: int


class _TimingsOut(BaseModel):
    """v1.5.0 / Phase 18E — per-message latency breakdown.

    All values in milliseconds (integer). ``None`` for calls that
    were skipped (e.g. ``topic_transition_ms`` when the route never
    reached the auto-loop branch). ``parallel_saved_ms`` is the
    estimate of how much wall-time the asyncio.gather block saved
    vs. running the two evaluators sequentially.
    """

    model_config = ConfigDict(from_attributes=True)

    learning_ms: int | None = None
    evaluation_ms: int | None = None
    topic_transition_ms: int | None = None
    total_ms: int | None = None
    parallel_saved_ms: int | None = None


class _TopicTransitionOut(BaseModel):
    """v1.4.0 — auto-loop topic-transition result.

    ``cycle_complete`` / ``continue_recommended`` are the AI's
    raw verdict; ``looped`` is the route's DERIVED decision:
    true iff a new cycle was actually started (``cycle_step``
    reset to 1, ``cycle_count`` incremented). The frontend reads
    ``looped`` to decide whether to render the cycle-transition
    card.
    """

    model_config = ConfigDict(from_attributes=True)

    cycle_complete: bool
    summary: str
    next_topic: str | None
    next_topic_rationale: str
    difficulty_adjustment: str
    continue_recommended: bool
    fallback_used: bool
    looped: bool
    new_cycle_count: int


class _SessionMessageExchangeOut(BaseModel):
    """Composite return for POST /{id}/message.

    ``assistant_message`` is ``None`` when AI couldn't reply (no
    API key configured, no provider matched the model, provider
    raised). ``ai_error`` carries a one-line explanation in that
    case so the frontend can render a toast / inline notice
    without parsing a stack trace.

    v0.4.0: ``session`` carries the LearningSession AFTER the
    cycle-step advance has been applied (if any). The frontend
    reads ``session.cycle_step`` to drive CycleProgress without
    a separate fetch. Pure read-only: the route never mutates
    the session row outside of cycle-step advances.

    v0.5.0: ``step_evaluation`` carries the second AI call's
    verdict (Phase 8). ``None`` when step-evaluation is disabled
    in config OR when the route short-circuited before reaching
    the evaluation step (no API key, no provider, role!=user, etc.).
    """

    model_config = ConfigDict(from_attributes=True)

    user_message: SessionMessageOut
    assistant_message: SessionMessageOut | None = None
    ai_error: str | None = None
    session: LearningSessionOut
    step_evaluation: _StepEvaluationOut | None = None
    topic_transition: _TopicTransitionOut | None = None
    timings: _TimingsOut | None = None
    # v1.11.0 / Phase 24D — non-fatal warning when the requested
    # model is not in the provider's cached available-models list.
    # The route falls back to the provider's default model and
    # surfaces this string so the frontend can toast.
    model_warning: str | None = None


class _SwitchRecommendationOut(BaseModel):
    """Shape of GET /switch-recommendation/{id}.

    ``recommended=False`` means the recommend_method_switch hook
    returned nothing (no recommendation); ``to_method`` and
    ``reason`` are only populated when ``recommended=True``.
    """

    recommended: bool
    to_method: LearningMethod | None = None
    reason: str | None = None


class _SwitchAcceptBody(BaseModel):
    """POST /{id}/switch body. The frontend submits the suggested
    method + reason verbatim from the GET /switch-recommendation
    response; the route records a MethodSwitch audit row and
    updates the live session's method in place.
    """

    to_method: LearningMethod
    reason: str = Field(min_length=1)


class _RatingBody(BaseModel):
    understanding: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    method_fit: int = Field(ge=1, le=5)
    notes: str | None = None


class _EndBody(BaseModel):
    pass


class _SessionEndOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut


# --- Helpers -----------------------------------------------------------------


def _get_project(db: Session, project_id: str) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return project


def _get_session(db: Session, session_id: str) -> LearningSession:
    sess = db.get(LearningSession, session_id)
    if sess is None:
        raise NotFoundError(f"LearningSession {session_id!r} not found.")
    return sess


def _latest_profile(db: Session, project_id: str) -> LearningProfile | None:
    return (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.version.desc())
        .first()
    )


def _profile_to_dict(profile: LearningProfile | None) -> dict[str, Any]:
    if profile is None:
        return {}
    return {m: float(getattr(profile, m, 0.0)) for m in METHODS}


def _project_to_dict(project: LearningProject) -> dict[str, Any]:
    return {
        "id": project.id,
        "user_id": project.user_id,
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
        "daily_minutes": project.daily_minutes,
        "current_problem": project.current_problem,
    }


def _pick_initial_method(profile: LearningProfile | None, fallback: str = "deductive") -> str:
    """Use the profile's dominant method when one exists; otherwise
    fall back to ``deductive`` (the most universally-applicable
    method for a brand-new learner).
    """
    if profile is None:
        return fallback
    return profile.dominant_method or fallback


# --- POST /start -----------------------------------------------------------


def _analysis_context_for(
    db: Session, imported_conversation_id: str | None, lang: str
) -> str:
    """Render the imported conversation's analysis as a prompt addendum.

    Loads ``ImportedConversation.analysis_result`` (stored as a JSON
    string), parses it, and delegates to
    :func:`build_analysis_context`. Returns ``""`` when there is no
    conversation, no analysis, or the JSON is unusable, so the caller
    can append unconditionally.
    """
    if not imported_conversation_id:
        return ""
    conv = db.get(ImportedConversation, imported_conversation_id)
    if conv is None or not conv.analysis_result:
        return ""
    try:
        parsed = json.loads(conv.analysis_result)
    except (TypeError, json.JSONDecodeError):
        return ""
    if not isinstance(parsed, dict):
        return ""
    return build_analysis_context(parsed, lang)


@router.post(
    "/start",
    response_model=_SessionStartOut,
    status_code=status.HTTP_201_CREATED,
)
def start_session(payload: _StartBody, db: Session = Depends(get_db)) -> _SessionStartOut:
    project = _get_project(db, payload.project_id)
    profile = _latest_profile(db, project.id)
    method_key = payload.method.value if payload.method else _pick_initial_method(profile)

    # Phase 36 Bug 4 — resume an existing active session for the
    # same conversation instead of creating a new one. The lookup
    # short-circuits the new-session insert; the system prompt
    # already lives on the session's first message.
    if payload.imported_conversation_id:
        active = (
            db.query(LearningSession)
            .filter(
                LearningSession.imported_conversation_id
                == payload.imported_conversation_id,
                LearningSession.status == "active",
            )
            .order_by(LearningSession.started_at.desc())
            .first()
        )
        if active is not None:
            prior_system = (
                db.query(SessionMessage)
                .filter(
                    SessionMessage.session_id == active.id,
                    SessionMessage.role == "system",
                )
                .order_by(SessionMessage.created_at.asc())
                .first()
            )
            return _SessionStartOut(
                session=LearningSessionOut.model_validate(active),
                system_prompt=prior_system.content if prior_system else "",
            )

    sess = LearningSession(
        project_id=project.id,
        method=method_key,
        cycle_step=payload.cycle_step,
        status="active",
        imported_conversation_id=payload.imported_conversation_id,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)

    try:
        prompt = build_prompt(
            project=_project_to_dict(project),
            profile=_profile_to_dict(profile),
            method=method_key,
            step=payload.cycle_step,
            lang=payload.lang,
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    # When the session is started from an analysed chat import, fold the
    # analysis (topic / summary / level / strengths / weaknesses / error
    # patterns / vocabulary / suggested curriculum) into the system
    # prompt so the AI continues with the imported context instead of
    # starting blank.
    analysis_block = _analysis_context_for(db, payload.imported_conversation_id, payload.lang)
    if analysis_block:
        prompt = f"{prompt}\n\n{analysis_block}"

    # v0.2.0: persist the system prompt as a real SessionMessage so
    # subsequent /message calls (where the AI orchestrator loads
    # the chronological history) see the prompt as the first turn
    # without the frontend having to re-post it. Stored under the
    # ``system`` role so the Anthropic / OpenAI / Gemini client
    # wrappers can lift it back into their per-provider system
    # field.
    db.add(
        SessionMessage(
            session_id=sess.id,
            role="system",
            content=prompt,
        )
    )
    db.commit()

    return _SessionStartOut(
        session=LearningSessionOut.model_validate(sess),
        system_prompt=prompt,
    )


# --- POST /{id}/message ----------------------------------------------------


def _load_prior_messages(db: Session, session_id: str) -> list[dict[str, Any]]:
    """Return every SessionMessage for the session in chronological
    order as plain dicts. Stable column subset (role + content) so
    the AI provider sees only what it needs.
    """
    rows = (
        db.query(SessionMessage)
        .filter(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc(), SessionMessage.id.asc())
        .all()
    )
    return [{"role": r.role, "content": r.content} for r in rows]


def _resolve_active_key(db: Session, user_id: str) -> tuple[str | None, str | None, str | None]:
    """Return (active_provider, decrypted_api_key, model_override) for the user.

    Any of the three can be ``None``:
      - active_provider is None if the UserSettings row never got
        seeded (shouldn't happen — settings_service auto-creates
        it on first GET).
      - api_key is None when the user hasn't entered one for the
        active provider yet.
      - model_override (v0.4.0) is None when the user hasn't
        overridden ai_orchestration.DEFAULT_MODELS for the active
        provider.
    """
    from app.services import settings as settings_service
    from app.repositories.settings_repo import SqlAlchemySettingsRepository

    settings = settings_service.get_or_create_settings(SqlAlchemySettingsRepository(db), user_id)
    provider_key = settings.active_provider
    try:
        provider_enum = AIProvider(provider_key)
    except ValueError:
        return None, None, None
    # Phase 34 — env > secrets.yaml > DB resolution.
    api_key, _source = settings_service.resolve_api_key(SqlAlchemySettingsRepository(db), user_id, provider_enum)
    override_attr = f"model_override_{provider_key}"
    override = getattr(settings, override_attr, None)
    return provider_key, api_key, override


@dataclass
class MessageContext:
    """Mutable carrier threaded through the ``/{id}/message`` handler.

    Holds the request inputs, the persisted learner turn, and the
    running latency budget so the phase functions the handler is being
    decomposed into (persist_user_message, resolve_ai_context,
    run_step_evaluation, run_auto_loop, assemble_exchange) read and
    update one typed object instead of a fan of positional args and
    single-key ``dict`` holders.

    The ``*_ms`` fields stay ``None`` until their phase runs; the
    response builder reads them verbatim into the ``timings`` payload.
    """

    db: Session
    session: LearningSession
    payload: _MessageBody
    request_start_ts: float
    user_msg: SessionMessage | None = None
    project: LearningProject | None = None
    provider_key: str | None = None
    api_key: str | None = None
    model: str | None = None
    history: list[dict[str, Any]] = field(default_factory=list)
    assistant_text: str | None = None
    assistant_msg: SessionMessage | None = None
    precomputed_transition: TopicTransition | None = None
    step_eval_out: _StepEvaluationOut | None = None
    topic_transition_out: _TopicTransitionOut | None = None
    learning_ms: int | None = None
    evaluation_ms: int | None = None
    topic_transition_ms: int | None = None
    parallel_saved_ms: int | None = None
    model_warning: str | None = None


def persist_user_message(ctx: MessageContext) -> SessionMessage:
    """Persist the inbound learner turn and record it on the context.

    Commits immediately so the learner's message survives even when
    the downstream AI round-trip later fails; ``ctx.user_msg`` is set
    so the response builder can echo it on every exit path.

    Args:
        ctx: The in-flight message context (db + session + payload).

    Returns:
        The persisted, refreshed ``SessionMessage`` row.
    """
    user_msg = SessionMessage(
        session_id=ctx.session.id,
        role=ctx.payload.role.value,
        content=ctx.payload.content,
    )
    ctx.db.add(user_msg)
    ctx.db.commit()
    ctx.db.refresh(user_msg)
    ctx.user_msg = user_msg
    return user_msg


def _validate_model_against_cache(ctx: MessageContext) -> None:
    """Phase 24D — sanity-check the chosen model against the provider's
    cached available-models list.

    When the cache holds a list (the Settings picker fetched it earlier
    in this process) AND the requested model is not in it, downgrade
    ``ctx.model`` to the provider default and set ``ctx.model_warning``.
    When no cache exists, validation is skipped — the spec is to try
    anyway, not to block the route on a fresh fetch. Any glitch in the
    lookup must never break the chat path, so it is swallowed (logged
    at debug) and the chosen model is kept.
    """
    if ctx.provider_key is None or ctx.api_key is None or ctx.model is None:
        return
    try:
        from app.schemas import AIProvider as _AIProvider
        from app.services import model_discovery as _model_discovery

        provider_enum = _AIProvider(ctx.provider_key)
        cached = _model_discovery.get_cached_models(provider_enum, ctx.api_key)
        if cached is not None and not any(m.id == ctx.model for m in cached):
            default_model = ai_orchestration.DEFAULT_MODELS.get(ctx.provider_key)
            if default_model and default_model != ctx.model:
                ctx.model_warning = (
                    f"Model {ctx.model!r} is not in the available models for "
                    f"provider {ctx.provider_key!r}. Falling back to {default_model!r}."
                )
                ctx.model = default_model
            else:
                ctx.model_warning = (
                    f"Model {ctx.model!r} may not be available for provider "
                    f"{ctx.provider_key!r}; trying anyway."
                )
    except Exception as err:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).debug(
            "Model validation skipped for provider %r: %s", ctx.provider_key, err
        )


def resolve_ai_context(ctx: MessageContext) -> str | None:
    """Resolve project -> active provider -> API key -> model.

    Populates ``ctx.project`` / ``provider_key`` / ``api_key`` / ``model``
    and runs the Phase 24D model-availability validation (which may
    downgrade ``ctx.model`` and set ``ctx.model_warning``).

    The handler needs the resolved triple exposed (the model + key feed
    the learning call AND the step-evaluation / topic-transition calls),
    so this keeps the explicit resolution rather than wrapping the
    closure-shaped ``build_ai_caller``.

    Returns:
        ``None`` on success, or a non-fatal ``ai_error`` string the
        handler echoes via ``_build_response`` when the context can't be
        resolved (no project / provider / key / model).
    """
    db = ctx.db
    project = db.get(LearningProject, ctx.session.project_id)
    if project is None:
        return "session has no project; AI reply skipped."
    ctx.project = project

    provider_key, api_key, model_override = _resolve_active_key(db, project.user_id)
    if provider_key is None:
        return "No active AI provider configured."
    if not api_key:
        return f"No API key stored for provider {provider_key!r}."

    model = ai_orchestration.resolve_model(provider_key, override=model_override)
    if model is None:
        return f"Provider {provider_key!r} has no default model registered."

    ctx.provider_key = provider_key
    ctx.api_key = api_key
    ctx.model = model
    _validate_model_against_cache(ctx)
    return None


def _maybe_parallel_precompute(
    ctx: MessageContext,
    *,
    async_eval_enabled: bool,
    step_eval_enabled: bool,
    auto_loop_enabled: bool,
    eval_max_tokens: int,
    tt_max_tokens: int,
) -> StepEvaluation | None:
    """Phase 18C — run step-eval + topic-transition concurrently at the
    step 6 -> 7 boundary (saves ~one AI call of latency at the cycle edge).

    Fires only when async evaluation + step-eval + auto-loop are all on
    AND ``from_step == MAX_STEP - 1``. Stores the transition on
    ``ctx.precomputed_transition`` for :func:`run_auto_loop` and records
    the symmetric timing split. Returns the precomputed step evaluation,
    or ``None`` when the path does not run or the gather fails (the caller
    then falls back to the sequential evaluator).
    """
    sess = ctx.session
    from_step = int(sess.cycle_step)
    if not (
        async_eval_enabled and step_eval_enabled and auto_loop_enabled and from_step == MAX_STEP - 1
    ):
        return None

    import asyncio

    from app.main import manager

    from .step_evaluator import evaluate_step_async
    from .topic_transition import evaluate_topic_transition_async

    assert ctx.project is not None and ctx.model is not None and ctx.api_key is not None
    project, model, api_key = ctx.project, ctx.model, ctx.api_key
    owner = ctx.db.get(User, project.user_id)
    parallel_lang = owner.language if owner else "en"
    parallel_history = ctx.history + [{"role": "assistant", "content": ctx.assistant_text}]

    async def _run_both() -> tuple[StepEvaluation, TopicTransition]:
        return await asyncio.gather(
            evaluate_step_async(
                pm=manager._pm,
                method=sess.method,
                current_step=from_step,
                history=parallel_history,
                model=model,
                api_key=api_key,
                output_language=parallel_lang,
                max_tokens=eval_max_tokens,
            ),
            evaluate_topic_transition_async(
                pm=manager._pm,
                goal=project.goal,
                topic=project.topic,
                method=sess.method,
                history=parallel_history,
                model=model,
                api_key=api_key,
                output_language=parallel_lang,
                max_tokens=tt_max_tokens,
            ),
        )

    parallel_start = time.monotonic()
    try:
        precomputed_eval, precomputed_transition = asyncio.run(_run_both())
    except Exception:  # noqa: BLE001 — fall back to sequential
        return None
    # Both calls ran concurrently inside that ms budget; attribute the
    # elapsed time symmetrically for the parallel_saved_ms display.
    parallel_ms = int((time.monotonic() - parallel_start) * 1000)
    ctx.evaluation_ms = parallel_ms
    ctx.topic_transition_ms = parallel_ms
    ctx.parallel_saved_ms = parallel_ms
    ctx.precomputed_transition = precomputed_transition
    return precomputed_eval


def run_step_evaluation(ctx: MessageContext) -> None:
    """Phase 8B — dual-prompt step evaluation + cycle-step advance.

    When step evaluation is enabled, fires a second AI call returning a
    JSON verdict and applies the suggested step iff ``advance`` and
    ``confidence >= threshold`` (or simply ``advance`` on the
    deterministic fallback path). Persists a ``StepEvaluationRow`` and
    sets ``ctx.step_eval_out``. When disabled, keeps the v0.4.x
    deterministic +1 advance. At the step 6 -> 7 boundary the async path
    also precomputes the topic transition onto ``ctx`` for
    :func:`run_auto_loop`.
    """
    from app.main import manager

    sess = ctx.session
    db = ctx.db
    from_step = int(sess.cycle_step)
    step_eval_enabled, threshold, eval_max_tokens = _read_step_evaluation_config()
    auto_loop_enabled, _max_cycles, tt_max_tokens = _read_auto_loop_config()
    async_eval_enabled = _read_async_evaluation_enabled()

    precomputed_eval = _maybe_parallel_precompute(
        ctx,
        async_eval_enabled=async_eval_enabled,
        step_eval_enabled=step_eval_enabled,
        auto_loop_enabled=auto_loop_enabled,
        eval_max_tokens=eval_max_tokens,
        tt_max_tokens=tt_max_tokens,
    )

    if not step_eval_enabled:
        # v0.4.x compat: deterministic +1 advance, capped at 7.
        if sess.cycle_step < MAX_STEP:
            sess.cycle_step += 1
        return

    assert ctx.project is not None and ctx.model is not None and ctx.api_key is not None
    # The evaluator judges the FULL exchange including the AI's
    # just-produced answer, so append it to the loaded history.
    full_history = ctx.history + [{"role": "assistant", "content": ctx.assistant_text}]
    if precomputed_eval is not None:
        evaluation = precomputed_eval
    else:
        owner = db.get(User, ctx.project.user_id)
        eval_lang = owner.language if owner else "en"
        eval_start = time.monotonic()
        evaluation = evaluate_step(
            pm=manager._pm,
            method=sess.method,
            current_step=from_step,
            history=full_history,
            model=ctx.model,
            api_key=ctx.api_key,
            output_language=eval_lang,
            max_tokens=eval_max_tokens,
        )
        ctx.evaluation_ms = int((time.monotonic() - eval_start) * 1000)

    if evaluation.fallback_used:
        # Fallback IS the deterministic advance: apply per advance
        # (+1 below step 7, False at step 7 to cap the cycle).
        applied = evaluation.advance
    else:
        applied = evaluation.advance and (evaluation.confidence >= threshold)
    if applied:
        sess.cycle_step = evaluation.suggested_step
    # ``to_step`` records where the session ACTUALLY went; ``reason`` is
    # stored verbatim regardless of fallback_used for later audit.
    to_step = evaluation.suggested_step if applied else from_step
    db.add(
        StepEvaluationRow(
            session_id=sess.id,
            from_step=from_step,
            to_step=to_step,
            advance=evaluation.advance,
            confidence=evaluation.confidence,
            applied=applied,
            fallback_used=evaluation.fallback_used,
            reason=evaluation.reason,
        )
    )
    ctx.step_eval_out = _StepEvaluationOut(
        advance=evaluation.advance,
        confidence=evaluation.confidence,
        reason=evaluation.reason,
        suggested_step=evaluation.suggested_step,
        fallback_used=evaluation.fallback_used,
        applied=applied,
        from_step=from_step,
    )


def _append_cycle_summary(ctx: MessageContext, transition: TopicTransition) -> None:
    """Append the just-completed cycle to ``session.cycle_topics`` before
    the step-1 reset, so a later export tells the full multi-cycle story.
    """
    sess = ctx.session
    assert ctx.project is not None
    try:
        topics_list = json.loads(sess.cycle_topics or "[]")
        if not isinstance(topics_list, list):
            topics_list = []
    except json.JSONDecodeError:
        topics_list = []
    topics_list.append(
        {
            "cycle": sess.cycle_count,
            "topic": ctx.project.topic,
            "summary": transition.summary,
            "next_topic": transition.next_topic or "",
        }
    )
    sess.cycle_topics = json.dumps(topics_list, ensure_ascii=False)


def run_auto_loop(ctx: MessageContext) -> None:
    """v1.4.0 — auto-loop after step 7.

    When the evaluator just ADVANCED the session INTO step 7 with
    ``advance=true``, ask the AI whether the topic was integrated and what
    to learn next. When ``cycle_complete`` ∧ ``continue_recommended`` ∧ a
    ``next_topic`` exists ∧ ``cycle_count < max_cycles``, persist the
    completed cycle's summary, reset to step 1, and bump ``cycle_count``.
    Sets ``ctx.topic_transition_out``; reuses ``ctx.precomputed_transition``
    when the Phase 18C parallel path already ran the transition call.
    """
    from app.main import manager

    sess = ctx.session
    auto_loop_enabled, max_cycles, tt_max_tokens = _read_auto_loop_config()
    step_eval_out = ctx.step_eval_out
    just_hit_step_7 = (
        step_eval_out is not None
        and step_eval_out.applied
        and step_eval_out.suggested_step == MAX_STEP
        and step_eval_out.advance
    )
    if not (auto_loop_enabled and just_hit_step_7):
        return

    assert ctx.project is not None and ctx.model is not None and ctx.api_key is not None
    project, model, api_key = ctx.project, ctx.model, ctx.api_key
    if ctx.precomputed_transition is not None:
        transition = ctx.precomputed_transition
    else:
        owner = ctx.db.get(User, project.user_id)
        loop_lang = owner.language if owner else "en"
        full_history = ctx.history + [{"role": "assistant", "content": ctx.assistant_text}]
        transition_start = time.monotonic()
        transition = evaluate_topic_transition(
            pm=manager._pm,
            goal=project.goal,
            topic=project.topic,
            method=sess.method,
            history=full_history,
            model=model,
            api_key=api_key,
            output_language=loop_lang,
            max_tokens=tt_max_tokens,
        )
        ctx.topic_transition_ms = int((time.monotonic() - transition_start) * 1000)
    looped = (
        not transition.fallback_used
        and transition.cycle_complete
        and transition.continue_recommended
        and transition.next_topic is not None
        and sess.cycle_count < max_cycles
    )
    if looped:
        _append_cycle_summary(ctx, transition)
        sess.cycle_count += 1
        sess.cycle_step = MIN_STEP
    ctx.topic_transition_out = _TopicTransitionOut(
        cycle_complete=transition.cycle_complete,
        summary=transition.summary,
        next_topic=transition.next_topic,
        next_topic_rationale=transition.next_topic_rationale,
        difficulty_adjustment=transition.difficulty_adjustment,
        continue_recommended=transition.continue_recommended,
        fallback_used=transition.fallback_used,
        looped=looped,
        new_cycle_count=sess.cycle_count,
    )


def build_exchange_response(
    ctx: MessageContext,
    *,
    assistant: SessionMessage | None = None,
    ai_error: str | None = None,
    step_evaluation: _StepEvaluationOut | None = None,
    topic_transition: _TopicTransitionOut | None = None,
) -> _SessionMessageExchangeOut:
    """Build the composite exchange response shared by every exit point.

    Returning one shape from all exits keeps the frontend's typed
    contract consistent; it carries the full LearningSession row (so the
    frontend reads ``cycle_step`` without a refetch) and the accumulated
    timing budget.
    """
    total_ms = int((time.monotonic() - ctx.request_start_ts) * 1000)
    timings = _TimingsOut(
        learning_ms=ctx.learning_ms,
        evaluation_ms=ctx.evaluation_ms,
        topic_transition_ms=ctx.topic_transition_ms,
        total_ms=total_ms,
        parallel_saved_ms=ctx.parallel_saved_ms,
    )
    return _SessionMessageExchangeOut(
        user_message=SessionMessageOut.model_validate(ctx.user_msg),
        assistant_message=(
            SessionMessageOut.model_validate(assistant) if assistant is not None else None
        ),
        ai_error=ai_error,
        session=LearningSessionOut.model_validate(ctx.session),
        step_evaluation=step_evaluation,
        topic_transition=topic_transition,
        timings=timings,
        model_warning=ctx.model_warning,
    )


def assemble_exchange(ctx: MessageContext) -> _SessionMessageExchangeOut:
    """Commit the turn + refresh the rows, then build the success response
    from the assistant message + step-evaluation + topic-transition stored
    on the context.
    """
    ctx.db.commit()
    assert ctx.assistant_msg is not None
    ctx.db.refresh(ctx.assistant_msg)
    ctx.db.refresh(ctx.session)
    return build_exchange_response(
        ctx,
        assistant=ctx.assistant_msg,
        step_evaluation=ctx.step_eval_out,
        topic_transition=ctx.topic_transition_out,
    )


@router.post(
    "/{session_id}/message",
    response_model=_SessionMessageExchangeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send a learner message and get the AI reply",
    description=(
        "Appends the learner's message to the session, runs the method-aware "
        "AI completion, persists both turns + the step evaluation. This is an "
        "AI-credit-burning call and is rate-limited (see X-RateLimit-* / 429)."
    ),
    response_description="The learner + assistant turns and the step evaluation.",
    responses={
        404: {"description": "Session not found"},
        409: {"description": "Session already ended"},
        502: {"description": "AI provider unreachable"},
        429: {"description": "Rate limit exceeded"},
    },
)
def append_message(
    session_id: str,
    payload: _MessageBody,
    db: Session = Depends(get_db),
) -> _SessionMessageExchangeOut:
    sess = _get_session(db, session_id)
    if sess.status != "active":
        raise ValidationError(
            f"Session {session_id!r} is {sess.status!r}; cannot append messages "
            f"(reopen by starting a new session)."
        )

    # v0.2.0: orchestrate AI server-side. The v0.1.0 contract
    # (only user-side append, no AI call) is gone; the route now
    # owns the round-trip. Callers post user content; the route
    # saves it, fires ai_complete, persists the assistant reply,
    # and returns the composite. role=assistant / role=system
    # bodies are still accepted for back-compat with any external
    # integration that posts those directly — but the AI step
    # only fires for role=user.
    # v1.5.0 / 18E — message-level timing budget. ``total_start``
    # captures the wall clock at the entry to the AI orchestration
    # path; per-call markers (learning_ms, evaluation_ms,
    # topic_transition_ms) accumulate below. The response carries
    # the breakdown as ``timings`` so the frontend / monitoring can
    # surface latency without an extra introspection roundtrip.
    ctx = MessageContext(
        db=db,
        session=sess,
        payload=payload,
        request_start_ts=time.monotonic(),
    )

    persist_user_message(ctx)

    if payload.role != MessageRole.USER:
        # No AI step for assistant / system writes; no cycle-step
        # advance either (the advance only fires on a real
        # learner-AI round-trip).
        return build_exchange_response(ctx)

    ai_error = resolve_ai_context(ctx)
    if ai_error is not None:
        return build_exchange_response(ctx, ai_error=ai_error)
    # resolve_ai_context guarantees these are set when it returns None;
    # the downstream phase functions read ctx.project directly.
    assert ctx.provider_key is not None
    assert ctx.api_key is not None
    assert ctx.model is not None
    provider_key = ctx.provider_key
    api_key = ctx.api_key
    model = ctx.model

    # Load EVERY prior message INCLUDING the user message we just
    # saved (chronological order; the AI sees the freshest user
    # turn at the end naturally). Loading from the DB rather than
    # re-using build_messages_history's split keeps the route
    # consistent with what's actually persisted — anyone who
    # manually edits the DB sees the same conversation the AI
    # sees on the next turn.
    history = _load_prior_messages(db, sess.id)

    # Fire the ai_complete hook. firstresult=True: the matching
    # provider plugin returns text; the others return None. Any
    # plugin exception is wrapped server-side as
    # ExternalServiceError, which the global handler turns into
    # HTTP 502 — but we catch it here so the user message is
    # still returned + the error surfaces inline rather than
    # losing the user turn to a 5xx.
    try:
        from app.main import manager  # lazy: app.* not on sys.path in plugin's own test dir

        learning_start = time.monotonic()
        assistant_text = ai_orchestration.call_ai_complete(
            pm=manager._pm,
            messages=history,
            model=model,
            api_key=api_key,
        )
        ctx.learning_ms = int((time.monotonic() - learning_start) * 1000)
    except Exception as exc:  # noqa: BLE001
        return build_exchange_response(ctx, ai_error=f"AI provider error: {exc}")

    if not assistant_text:
        return build_exchange_response(
            ctx,
            ai_error=(
                f"No registered provider returned a reply for model {model!r}. "
                f"Is the {provider_key!r} provider plugin enabled?"
            ),
        )

    assistant_msg = SessionMessage(
        session_id=sess.id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant_msg)
    db.flush()  # assign assistant_msg.id without committing the txn yet
    ctx.history = history
    ctx.assistant_text = assistant_text
    ctx.assistant_msg = assistant_msg

    run_step_evaluation(ctx)
    run_auto_loop(ctx)

    return assemble_exchange(ctx)


# --- POST /{id}/message/stream (v1.6.0 / Phase 19) -------------------------


def _sse_event(event: str, data: dict[str, Any]) -> bytes:
    """Format one Server-Sent-Events frame.

    SSE wire format: ``event: <name>\\ndata: <json>\\n\\n``. We
    always JSON-encode the data block so the client parser doesn't
    have to branch on event type.
    """
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n".encode()


@router.post(
    "/{session_id}/message/stream",
    status_code=status.HTTP_200_OK,
    response_class=StreamingResponse,
)
async def append_message_stream(
    session_id: str,
    payload: _MessageBody,
    request: Request,  # noqa: ARG001  — kept for symmetry / future use
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """v1.6.0 / Phase 19 — token-streaming variant of /message.

    Mirrors the non-streaming /message orchestration with these
    differences:

    - The assistant response streams back via SSE ``chunk`` events
      so the UI can render tokens as they arrive instead of waiting
      for the full completion.
    - When the active provider's plugin implements
      ``ai_complete_stream`` (Phase 19A), tokens arrive incrementally
      from the SDK. When it doesn't, the route falls back to
      ``call_ai_complete_async`` and emits the full string as one
      ``chunk`` event so the client UI doesn't have to branch.
    - Step-evaluation + topic-transition still fire AFTER the
      stream completes (the evaluator reads the assistant message
      from the transcript). The route emits a final ``done`` event
      carrying ``session``, ``user_message``, ``assistant_message``,
      ``step_evaluation``, ``topic_transition``, and ``timings`` —
      the same payload the non-stream /message returns in one shot.
    - On a provider error the route emits an ``error`` event with
      ``ai_error`` set on the final ``done`` event, then closes.
      The user message is still persisted so the conversation
      record stays intact.

    SSE event schema:
      - ``start``: ``{user_message: SessionMessageOut}``
      - ``chunk``: ``{delta: str}``
      - ``done``:  ``{session, user_message, assistant_message?,
                       ai_error?, step_evaluation?, topic_transition?,
                       timings}``
      - ``error``: ``{detail: str}`` (only on auth/setup failures
                    where the route bails before opening the stream
                    proper; provider errors land in ``done.ai_error``).
    """
    sess = _get_session(db, session_id)
    if sess.status != "active":
        raise ValidationError(
            f"Session {session_id!r} is {sess.status!r}; cannot append messages "
            f"(reopen by starting a new session)."
        )

    if payload.role != MessageRole.USER:
        raise ValidationError(
            "POST /message/stream only accepts role=user payloads; "
            "non-user writes use POST /message."
        )

    request_start_ts = time.monotonic()
    learning_ms_holder: dict[str, int | None] = {"value": None}
    eval_ms_holder: dict[str, int | None] = {"value": None}
    transition_ms_holder: dict[str, int | None] = {"value": None}
    parallel_saved_ms_holder: dict[str, int | None] = {"value": None}

    user_msg = SessionMessage(
        session_id=sess.id,
        role=payload.role.value,
        content=payload.content,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    project = db.get(LearningProject, sess.project_id)
    if project is None:
        # Mirror the non-stream behaviour: surface the error inside
        # ``done`` rather than as a hard 500. The user message is
        # already persisted.
        async def _orphan_stream() -> Any:
            yield _sse_event(
                "start",
                {
                    "user_message": SessionMessageOut.model_validate(user_msg).model_dump(
                        mode="json"
                    )
                },
            )
            yield _sse_event(
                "done",
                {
                    "session": LearningSessionOut.model_validate(sess).model_dump(mode="json"),
                    "user_message": SessionMessageOut.model_validate(user_msg).model_dump(
                        mode="json"
                    ),
                    "assistant_message": None,
                    "ai_error": "session has no project; AI reply skipped.",
                    "step_evaluation": None,
                    "topic_transition": None,
                    "timings": _empty_timings(request_start_ts),
                },
            )

        return StreamingResponse(_orphan_stream(), media_type="text/event-stream")

    provider_key, api_key, model_override = _resolve_active_key(db, project.user_id)
    if provider_key is None:
        return _setup_error_stream(
            request_start_ts, user_msg, sess, "No active AI provider configured."
        )
    if not api_key:
        return _setup_error_stream(
            request_start_ts,
            user_msg,
            sess,
            f"No API key stored for provider {provider_key!r}.",
        )
    model = ai_orchestration.resolve_model(provider_key, override=model_override)
    if model is None:
        return _setup_error_stream(
            request_start_ts,
            user_msg,
            sess,
            f"Provider {provider_key!r} has no default model registered.",
        )

    history = _load_prior_messages(db, sess.id)
    from app.main import manager

    async def _event_stream() -> Any:
        from .ai_orchestration import (
            call_ai_complete_async,
            call_ai_complete_stream,
        )

        yield _sse_event(
            "start",
            {"user_message": SessionMessageOut.model_validate(user_msg).model_dump(mode="json")},
        )

        accumulator: list[str] = []
        ai_error: str | None = None
        learning_start = time.monotonic()
        try:
            iterator = await call_ai_complete_stream(
                pm=manager._pm,
                messages=history,
                model=model,
                api_key=api_key,
            )
            if iterator is None:
                # Fallback path: the provider doesn't implement the
                # stream hook. Call the async non-stream variant and
                # emit one chunk so the client doesn't have to
                # branch.
                full_text = await call_ai_complete_async(
                    pm=manager._pm,
                    messages=history,
                    model=model,
                    api_key=api_key,
                )
                if isinstance(full_text, str) and full_text:
                    accumulator.append(full_text)
                    yield _sse_event("chunk", {"delta": full_text})
            else:
                async for delta in iterator:
                    if isinstance(delta, str) and delta:
                        accumulator.append(delta)
                        yield _sse_event("chunk", {"delta": delta})
        except Exception as exc:  # noqa: BLE001 — surface as ai_error
            ai_error = f"AI provider error: {exc}"

        learning_ms_holder["value"] = int((time.monotonic() - learning_start) * 1000)

        assistant_text = "".join(accumulator)
        if not assistant_text and ai_error is None:
            ai_error = (
                f"No registered provider returned a reply for model {model!r}. "
                f"Is the {provider_key!r} provider plugin enabled?"
            )

        # Finalise: save assistant message, run step-eval +
        # topic-transition, emit done.
        assistant_msg = (
            _finalize_stream_exchange(
                db=db,
                sess=sess,
                project=project,
                history=history,
                assistant_text=assistant_text,
                model=model,
                api_key=api_key,
                eval_ms_holder=eval_ms_holder,
                transition_ms_holder=transition_ms_holder,
            )
            if not ai_error
            else None
        )

        total_ms = int((time.monotonic() - request_start_ts) * 1000)
        yield _sse_event(
            "done",
            {
                "session": LearningSessionOut.model_validate(sess).model_dump(mode="json"),
                "user_message": SessionMessageOut.model_validate(user_msg).model_dump(mode="json"),
                "assistant_message": (
                    SessionMessageOut.model_validate(assistant_msg.message).model_dump(mode="json")
                    if assistant_msg is not None
                    else None
                ),
                "ai_error": ai_error,
                "step_evaluation": (
                    assistant_msg.step_evaluation.model_dump(mode="json")
                    if assistant_msg and assistant_msg.step_evaluation
                    else None
                ),
                "topic_transition": (
                    assistant_msg.topic_transition.model_dump(mode="json")
                    if assistant_msg and assistant_msg.topic_transition
                    else None
                ),
                "timings": {
                    "learning_ms": learning_ms_holder["value"],
                    "evaluation_ms": eval_ms_holder["value"],
                    "topic_transition_ms": transition_ms_holder["value"],
                    "total_ms": total_ms,
                    "parallel_saved_ms": parallel_saved_ms_holder["value"],
                },
            },
        )

    return StreamingResponse(_event_stream(), media_type="text/event-stream")


def _empty_timings(request_start_ts: float) -> dict[str, Any]:
    total_ms = int((time.monotonic() - request_start_ts) * 1000)
    return {
        "learning_ms": None,
        "evaluation_ms": None,
        "topic_transition_ms": None,
        "total_ms": total_ms,
        "parallel_saved_ms": None,
    }


def _setup_error_stream(
    request_start_ts: float,
    user_msg: SessionMessage,
    sess: LearningSession,
    ai_error: str,
) -> StreamingResponse:
    """Build a one-shot SSE response for setup failures (no provider,
    no key, no model). The user message is already persisted; we
    just emit start + done so the client sees the error inline
    rather than as a hard HTTP 4xx (consistent with /message)."""

    async def _gen() -> Any:
        yield _sse_event(
            "start",
            {"user_message": SessionMessageOut.model_validate(user_msg).model_dump(mode="json")},
        )
        yield _sse_event(
            "done",
            {
                "session": LearningSessionOut.model_validate(sess).model_dump(mode="json"),
                "user_message": SessionMessageOut.model_validate(user_msg).model_dump(mode="json"),
                "assistant_message": None,
                "ai_error": ai_error,
                "step_evaluation": None,
                "topic_transition": None,
                "timings": _empty_timings(request_start_ts),
            },
        )

    return StreamingResponse(_gen(), media_type="text/event-stream")


class _StreamExchangeResult:
    """Container for the post-stream finalisation output."""

    def __init__(
        self,
        message: SessionMessage,
        step_evaluation: _StepEvaluationOut | None,
        topic_transition: _TopicTransitionOut | None,
    ) -> None:
        self.message = message
        self.step_evaluation = step_evaluation
        self.topic_transition = topic_transition


def _finalize_stream_exchange(
    *,
    db: Session,
    sess: LearningSession,
    project: LearningProject,
    history: list[dict[str, Any]],
    assistant_text: str,
    model: str,
    api_key: str,
    eval_ms_holder: dict[str, int | None],
    transition_ms_holder: dict[str, int | None],
) -> _StreamExchangeResult:
    """Persist the assistant message + run step-eval + topic-transition.

    Mirrors the second half of :func:`append_message` from the
    point ``assistant_text`` is known. Kept inline here rather than
    extracted as a shared helper because the parallel-evaluation
    path at the step 6 -> 7 boundary is intrinsically tied to the
    non-streaming route's flow (evaluators run BEFORE the AI reply
    in the parallel path, which doesn't make sense for streaming —
    by the time we get here, the stream is finished and we have
    the full text).
    """
    from app.main import manager  # noqa: F401  — kept for symmetry with /message

    assistant_msg = SessionMessage(
        session_id=sess.id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant_msg)
    db.flush()

    from_step = int(sess.cycle_step)
    step_eval_enabled, threshold, eval_max_tokens = _read_step_evaluation_config()
    auto_loop_enabled, max_cycles, tt_max_tokens = _read_auto_loop_config()
    step_eval_out: _StepEvaluationOut | None = None

    if step_eval_enabled:
        owner = db.get(User, project.user_id)
        eval_lang = owner.language if owner else "en"
        full_history = history + [{"role": "assistant", "content": assistant_text}]
        eval_start = time.monotonic()
        evaluation = evaluate_step(
            pm=manager._pm,
            method=sess.method,
            current_step=from_step,
            history=full_history,
            model=model,
            api_key=api_key,
            output_language=eval_lang,
            max_tokens=eval_max_tokens,
        )
        eval_ms_holder["value"] = int((time.monotonic() - eval_start) * 1000)
        if evaluation.fallback_used:
            applied = evaluation.advance
        else:
            applied = evaluation.advance and (evaluation.confidence >= threshold)
        if applied:
            sess.cycle_step = evaluation.suggested_step
        to_step = evaluation.suggested_step if applied else from_step
        db.add(
            StepEvaluationRow(
                session_id=sess.id,
                from_step=from_step,
                to_step=to_step,
                advance=evaluation.advance,
                confidence=evaluation.confidence,
                applied=applied,
                fallback_used=evaluation.fallback_used,
                reason=evaluation.reason,
            )
        )
        step_eval_out = _StepEvaluationOut(
            advance=evaluation.advance,
            confidence=evaluation.confidence,
            reason=evaluation.reason,
            suggested_step=evaluation.suggested_step,
            fallback_used=evaluation.fallback_used,
            applied=applied,
            from_step=from_step,
        )
    else:
        if sess.cycle_step < MAX_STEP:
            sess.cycle_step += 1

    topic_transition_out: _TopicTransitionOut | None = None
    just_hit_step_7 = (
        step_eval_out is not None
        and step_eval_out.applied
        and step_eval_out.suggested_step == MAX_STEP
        and step_eval_out.advance
    )
    if auto_loop_enabled and just_hit_step_7:
        owner = db.get(User, project.user_id)
        loop_lang = owner.language if owner else "en"
        full_history = history + [{"role": "assistant", "content": assistant_text}]
        transition_start = time.monotonic()
        transition = evaluate_topic_transition(
            pm=manager._pm,
            goal=project.goal,
            topic=project.topic,
            method=sess.method,
            history=full_history,
            model=model,
            api_key=api_key,
            output_language=loop_lang,
            max_tokens=tt_max_tokens,
        )
        transition_ms_holder["value"] = int((time.monotonic() - transition_start) * 1000)
        looped = (
            not transition.fallback_used
            and transition.cycle_complete
            and transition.continue_recommended
            and transition.next_topic is not None
            and sess.cycle_count < max_cycles
        )
        if looped:
            try:
                topics_list = json.loads(sess.cycle_topics or "[]")
                if not isinstance(topics_list, list):
                    topics_list = []
            except json.JSONDecodeError:
                topics_list = []
            topics_list.append(
                {
                    "cycle": sess.cycle_count,
                    "topic": project.topic,
                    "summary": transition.summary,
                    "next_topic": transition.next_topic or "",
                }
            )
            sess.cycle_topics = json.dumps(topics_list, ensure_ascii=False)
            sess.cycle_count += 1
            sess.cycle_step = MIN_STEP
        topic_transition_out = _TopicTransitionOut(
            cycle_complete=transition.cycle_complete,
            summary=transition.summary,
            next_topic=transition.next_topic,
            next_topic_rationale=transition.next_topic_rationale,
            difficulty_adjustment=transition.difficulty_adjustment,
            continue_recommended=transition.continue_recommended,
            fallback_used=transition.fallback_used,
            looped=looped,
            new_cycle_count=sess.cycle_count,
        )

    db.commit()
    db.refresh(assistant_msg)
    db.refresh(sess)
    return _StreamExchangeResult(
        message=assistant_msg,
        step_evaluation=step_eval_out,
        topic_transition=topic_transition_out,
    )


# --- POST /{id}/rate -------------------------------------------------------


@router.post(
    "/{session_id}/rate",
    response_model=SessionRatingOut,
    status_code=status.HTTP_201_CREATED,
)
def rate_session(
    session_id: str,
    payload: _RatingBody,
    db: Session = Depends(get_db),
) -> SessionRatingOut:
    sess = _get_session(db, session_id)
    rating = SessionRating(
        session_id=sess.id,
        understanding=payload.understanding,
        stress=payload.stress,
        method_fit=payload.method_fit,
        notes=payload.notes,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return SessionRatingOut.model_validate(rating)


# --- POST /{id}/end --------------------------------------------------------


@router.post("/{session_id}/end", response_model=_SessionEndOut)
def end_session(
    session_id: str,
    _payload: _EndBody | None = None,
    db: Session = Depends(get_db),
) -> _SessionEndOut:
    sess = _get_session(db, session_id)
    if sess.status == "completed":
        # Idempotent: re-ending a closed session is a no-op + returns
        # the existing row. Pre-empts the "user double-clicked end"
        # race the frontend can produce on a slow network.
        return _SessionEndOut(session=LearningSessionOut.model_validate(sess))

    sess.status = "completed"
    sess.ended_at = datetime.now(UTC)
    db.commit()
    db.refresh(sess)

    # Notify the tracking plugin (Phase 3-D) that this session
    # closed; pluggy's list-mode dispatch fans the call out to
    # every subscriber. Errors here MUST NOT roll back the close —
    # the hookspec docstring records that contract.
    latest_rating = (
        db.query(SessionRating)
        .filter(SessionRating.session_id == sess.id)
        .order_by(SessionRating.created_at.desc())
        .first()
    )
    _fire_on_session_complete(
        session={
            "id": sess.id,
            "project_id": sess.project_id,
            "method": sess.method,
            "cycle_step": sess.cycle_step,
            "started_at": sess.started_at.isoformat() if sess.started_at else None,
            "ended_at": sess.ended_at.isoformat() if sess.ended_at else None,
            "status": sess.status,
        },
        rating={
            "understanding": latest_rating.understanding if latest_rating else None,
            "stress": latest_rating.stress if latest_rating else None,
            "method_fit": latest_rating.method_fit if latest_rating else None,
            "notes": latest_rating.notes if latest_rating else None,
        }
        if latest_rating
        else {},
    )

    return _SessionEndOut(session=LearningSessionOut.model_validate(sess))


# --- GET /{session_id} + /{session_id}/messages (v1.23.0 / Phase 38 Bug 7) ---


@router.get(
    "/{session_id}",
    response_model=LearningSessionOut,
)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
) -> LearningSessionOut:
    """Fetch a session record by ID. Used by the frontend's
    resume path: when a user clicks "Continue session" on the
    ImportDetail page, the Session route reads ``?session=<id>``
    and pulls the existing record instead of calling
    ``POST /start`` (which creates a new session).

    Raises ``NotFoundError`` (-> 404) if the session does not
    exist; the global exception handler maps it.
    """
    sess = _get_session(db, session_id)
    return LearningSessionOut.model_validate(sess)


@router.get(
    "/{session_id}/messages",
    response_model=list[SessionMessageOut],
)
def list_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
) -> list[SessionMessageOut]:
    """Return the chat history (oldest-first) for a session.
    Used by the resume path so the SessionChat re-mounts with
    the prior conversation visible. The system-prompt message
    is included so the AI orchestrator's next ``message`` call
    sees the chronological history."""
    _get_session(db, session_id)
    rows = (
        db.query(SessionMessage)
        .filter(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc())
        .all()
    )
    return [SessionMessageOut.model_validate(row) for row in rows]


# --- GET /switch-recommendation/{id} (v0.2.0) -----------------------------


@router.get(
    "/switch-recommendation/{session_id}",
    response_model=_SwitchRecommendationOut,
)
def get_switch_recommendation(
    session_id: str,
    db: Session = Depends(get_db),
) -> _SwitchRecommendationOut:
    """Fire the ``recommend_method_switch`` hook against the recent
    SessionRating history for the session's project. Returns the
    first non-empty recommendation any plugin produced.

    Pluggy's list-mode dispatch returns a list of every plugin's
    return value; we pick the first non-empty dict so the route
    shape is stable. A future ranking strategy (most stale method?
    most-confident plugin?) replaces this with a real selector.
    """
    sess = _get_session(db, session_id)

    # Pull the most recent 5 ratings for the project (across ALL
    # sessions of that project, not just this one — the
    # recommender uses cross-session trends). Newest first;
    # switching.recommend expects ordered-newest-first per its
    # own docstring.
    project = db.get(LearningProject, sess.project_id)
    if project is None:
        return _SwitchRecommendationOut(recommended=False)

    recent_rows = (
        db.query(SessionRating)
        .join(LearningSession, LearningSession.id == SessionRating.session_id)
        .filter(LearningSession.project_id == project.id)
        .order_by(SessionRating.created_at.desc())
        .limit(5)
        .all()
    )
    recent_ratings = [
        {
            "understanding": r.understanding,
            "stress": r.stress,
            "method_fit": r.method_fit,
            "method": db.get(LearningSession, r.session_id).method
            if db.get(LearningSession, r.session_id) is not None
            else None,
        }
        for r in recent_rows
    ]

    try:
        from app.main import manager  # lazy: app.* not on sys.path in plugin tests

        results = manager._pm.hook.recommend_method_switch(
            project_id=project.id,
            current_method=sess.method,
            recent_ratings=recent_ratings,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "recommend_method_switch raised; returning recommended=false",
            exc_info=True,
        )
        return _SwitchRecommendationOut(recommended=False)

    # First non-empty dict wins. pluggy list-mode strips None
    # automatically; an empty dict counts as "no recommendation"
    # too so the plugin can return {} for "I don't have one yet"
    # without breaking the chain.
    for entry in results or []:
        if isinstance(entry, dict) and entry.get("to_method"):
            try:
                to_method = LearningMethod(entry["to_method"])
            except ValueError:
                continue
            reason = entry.get("reason") if isinstance(entry.get("reason"), str) else None
            return _SwitchRecommendationOut(
                recommended=True,
                to_method=to_method,
                reason=reason,
            )

    return _SwitchRecommendationOut(recommended=False)


# --- POST /{id}/switch (v0.2.0) --------------------------------------------


@router.post(
    "/{session_id}/switch",
    response_model=LearningSessionOut,
)
def accept_method_switch(
    session_id: str,
    payload: _SwitchAcceptBody,
    db: Session = Depends(get_db),
) -> LearningSessionOut:
    """Accept a method-switch recommendation.

    Persists a MethodSwitch audit row (project-scoped — the model
    column lives on ``MethodSwitch.project_id``, not on the
    session, by design — see :class:`app.models.MethodSwitch`)
    and updates the current session's method in place. The chat
    history stays; only the method (and therefore the system
    prompt for subsequent /message calls) changes.

    Returns the updated LearningSession. The frontend uses the
    new method to re-render the MethodBadge + drive the cycle UI;
    a fresh system prompt is NOT injected as a SessionMessage to
    avoid an opinionated double-prompt — the next AI turn will
    pick up the per-method prompt via build_prompt at the route
    layer if a future refactor wires it in. For v0.2.0 the
    switch is recorded for analytics, the live conversation
    continues with the original system prompt.
    """
    sess = _get_session(db, session_id)
    if sess.status != "active":
        raise ValidationError(
            f"Session {session_id!r} is {sess.status!r}; cannot switch methods "
            f"(start a new session to pick a method)."
        )
    from_method = sess.method
    to_method = payload.to_method.value
    if from_method == to_method:
        # Idempotent: no-op when the user re-accepts the current
        # method (shouldn't happen via the UI but is cheap to
        # guard against).
        return LearningSessionOut.model_validate(sess)

    db.add(
        MethodSwitch(
            project_id=sess.project_id,
            from_method=from_method,
            to_method=to_method,
            reason=payload.reason,
        )
    )
    sess.method = to_method
    db.commit()
    db.refresh(sess)
    return LearningSessionOut.model_validate(sess)


def _fire_on_session_complete(session: dict[str, Any], rating: dict[str, Any]) -> None:
    """Wrap the hook call so subscriber exceptions don't propagate
    into the route response. Logs but does not raise."""
    try:
        # Lazy import: avoids a circular dependency with app.main
        # at module load (the route module gets imported during
        # PluginForge discovery, which itself runs from
        # app.main.lifespan).
        from app.main import manager

        manager._pm.hook.on_session_complete(session=session, rating=rating)
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "on_session_complete subscriber raised; session close not affected",
            exc_info=True,
        )


# --- Pronunciation Practice (v1.18.0 / Phase 31C) -------------------------

from . import pronunciation as _pronunciation


def _is_language_project(db: Session, project_id: str) -> bool:
    """True iff the project has at least one Subject under the
    ``languages`` slug (transitive — direct or via the
    ancestor chain). Used by the dashboard to decide whether to
    surface the Pronunciation quick-start.

    Returns False when the project has no subjects assigned —
    intentional graceful degradation (the page stays hidden
    rather than guessing from the topic string).
    """
    from app.models import ProjectSubject, Subject

    rows = (
        db.query(Subject)
        .join(ProjectSubject, ProjectSubject.subject_id == Subject.id)
        .filter(ProjectSubject.project_id == project_id)
        .all()
    )
    if not rows:
        return False
    # Walk each subject up the parent chain looking for the
    # ``languages`` ancestor. The seed taxonomy from Phase 22A
    # uses the slug encoded in ``Subject.icon`` via the
    # ``Subject.name`` lookup — but we'd rather match by name
    # since the seed loader is name-keyed.
    visited: set[str] = set()
    for start in rows:
        cursor: Subject | None = start
        while cursor is not None and cursor.id not in visited:
            visited.add(cursor.id)
            # Slug encoded in the name: the seed YAML uses
            # ``name: Languages`` for the root; check that.
            if cursor.name.lower() in ("languages", "sprachen"):
                return True
            if cursor.parent_id is None:
                break
            cursor = db.get(Subject, cursor.parent_id)
    return False


class _PronunciationPhraseBody(BaseModel):
    project_id: str
    language: str = "en"
    level: str = "beginner"
    focus: str = "common sounds"
    previous: list[str] = Field(default_factory=list)


class _PronunciationPhraseOut(BaseModel):
    phrase: str
    language: str


@router.post(
    "/pronunciation/phrase", response_model=_PronunciationPhraseOut
)
def get_pronunciation_phrase(
    body: _PronunciationPhraseBody,
    db: Session = Depends(get_db),
) -> _PronunciationPhraseOut:
    """Generate one practice phrase for the user.

    Resolves the project owner, fires the AI with the
    phrase-prompt, returns ``{phrase, language}``. The phrase is
    NOT persisted — pronunciation practice is ephemeral
    (per the v1.18.0 scope decision).
    """
    project = db.get(LearningProject, body.project_id)
    if project is None:
        raise NotFoundError(
            f"LearningProject {body.project_id!r} not found."
        )
    ai_call = build_ai_caller(db, project.user_id, max_tokens=256)
    phrase = _pronunciation.generate_phrase(
        ai_call,
        language=body.language,
        level=body.level,
        focus=body.focus,
        previous=body.previous,
    )
    if phrase is None:
        raise ValidationError(
            "Could not generate a pronunciation phrase. Try again."
        )
    return _PronunciationPhraseOut(phrase=phrase, language=body.language)


class _PronunciationJudgeBody(BaseModel):
    project_id: str
    target: str
    actual: str
    language: str = "en"


class _PronunciationJudgeOut(BaseModel):
    matches: bool
    score: float
    feedback: str
    missed_sounds: list[str]


@router.post(
    "/pronunciation/judge", response_model=_PronunciationJudgeOut
)
def judge_pronunciation(
    body: _PronunciationJudgeBody,
    db: Session = Depends(get_db),
) -> _PronunciationJudgeOut:
    """Score a pronunciation attempt + return short feedback."""
    project = db.get(LearningProject, body.project_id)
    if project is None:
        raise NotFoundError(
            f"LearningProject {body.project_id!r} not found."
        )
    if not body.target.strip() or not body.actual.strip():
        raise ValidationError("target and actual must both be non-empty.")
    ai_call = build_ai_caller(db, project.user_id, max_tokens=256)
    verdict = _pronunciation.judge_attempt(
        ai_call,
        target=body.target,
        actual=body.actual,
        language=body.language,
    )
    if verdict is None:
        raise ValidationError(
            "Could not judge the pronunciation attempt. Try again."
        )
    return _PronunciationJudgeOut(**verdict.to_dict())


@router.get("/pronunciation/eligibility/{project_id}")
def pronunciation_eligibility(
    project_id: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Tell the frontend whether this project should surface
    the Pronunciation Practice quick-start.

    Returns ``{eligible: bool}``. ``True`` when the project has
    at least one Subject under the ``languages`` ancestor.
    """
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return {"eligible": _is_language_project(db, project_id)}
