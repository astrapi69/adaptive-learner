"""Message-handler orchestration for the session plugin.

Extracted from ``routes.py`` so the route module stays a thin shell of
FastAPI handlers (architecture rule: business logic lives in its own
module, not in ``routes.py``). Houses the ``MessageContext`` carrier, the
per-phase functions the ``POST /{id}/message`` handler is composed of
(``persist_user_message`` / ``resolve_ai_context`` / ``run_learning_call``
/ ``run_step_evaluation`` / ``run_auto_loop`` / ``assemble_exchange`` +
``build_exchange_response``), the streaming finalisation
(``_finalize_stream_exchange``), and the request/response contracts +
config readers they share.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.models import LearningProject, LearningSession, SessionMessage, User
from app.models import StepEvaluation as StepEvaluationRow
from app.schemas import AIProvider, LearningSessionOut, MessageRole, SessionMessageOut

from . import ai_orchestration
from .prompts import MAX_STEP, MIN_STEP
from .route_helpers import _latest_profile, compose_system_prompt
from .step_evaluator import EVALUATION_DEFAULT_MAX_TOKENS, StepEvaluation, evaluate_step
from .topic_transition import TopicTransition, evaluate_topic_transition


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


def build_outgoing_history(db: Session, sess: LearningSession) -> list[dict[str, Any]]:
    """Build the chronological AI message payload for one session turn.

    Rebuild-on-Resume (#1122): for a session linked to an imported
    conversation, the ``role=system`` message is REBUILT fresh from the
    conversation FK on every turn (via :func:`compose_system_prompt`) instead
    of replaying the frozen persisted copy. This makes later context
    improvements take effect for existing imported sessions and keeps the
    imported context current — the persisted seed (written at ``/start``) is
    filtered out and replaced. For a normal (non-imported) session the
    persisted chronological history is returned verbatim.

    Mirrors the Dexie-mode ``buildOutgoingHistory`` in
    ``frontend/src/storage/ai/session-flow.ts``.

    Args:
        db: SQLAlchemy session.
        sess: The active LearningSession the turn belongs to.

    Returns:
        The ordered ``[{role, content}, ...]`` list for the AI provider.
    """
    history = _load_prior_messages(db, sess.id)
    if not sess.imported_conversation_id:
        return history

    project = db.get(LearningProject, sess.project_id)
    if project is None:
        # Orphaned session: nothing to rebuild against, replay as-is.
        return history
    profile = _latest_profile(db, project.id)
    owner = db.get(User, project.user_id)
    lang = owner.language if owner else "en"
    fresh_system = compose_system_prompt(
        db,
        project=project,
        profile=profile,
        method=sess.method,
        step=int(sess.cycle_step),
        lang=lang,
        imported_conversation_id=sess.imported_conversation_id,
    )
    non_system = [m for m in history if m["role"] != "system"]
    return [{"role": "system", "content": fresh_system}, *non_system]


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
    from app.repositories.settings_repo import SqlAlchemySettingsRepository
    from app.services import settings as settings_service

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
    request_start_ts: float
    # None on the streaming finalisation path, which reuses the phase
    # functions but has no inbound _MessageBody to persist.
    payload: _MessageBody | None = None
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
    assert ctx.payload is not None  # only the /message path persists a turn
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


def run_step_evaluation(ctx: MessageContext, *, allow_parallel: bool = True) -> None:
    """Phase 8B — dual-prompt step evaluation + cycle-step advance.

    When step evaluation is enabled, fires a second AI call returning a
    JSON verdict and applies the suggested step iff ``advance`` and
    ``confidence >= threshold`` (or simply ``advance`` on the
    deterministic fallback path). Persists a ``StepEvaluationRow`` and
    sets ``ctx.step_eval_out``. When disabled, keeps the v0.4.x
    deterministic +1 advance. At the step 6 -> 7 boundary the async path
    also precomputes the topic transition onto ``ctx`` for
    :func:`run_auto_loop`.

    ``allow_parallel`` is ``False`` on the streaming finalisation path,
    where the reply is already complete (so the Phase 18C precompute is
    pointless) and ``asyncio.run`` cannot be called inside the live event
    loop.
    """
    from app.main import manager

    sess = ctx.session
    db = ctx.db
    from_step = int(sess.cycle_step)
    step_eval_enabled, threshold, eval_max_tokens = _read_step_evaluation_config()
    auto_loop_enabled, _max_cycles, tt_max_tokens = _read_auto_loop_config()
    async_eval_enabled = _read_async_evaluation_enabled()

    precomputed_eval = (
        _maybe_parallel_precompute(
            ctx,
            async_eval_enabled=async_eval_enabled,
            step_eval_enabled=step_eval_enabled,
            auto_loop_enabled=auto_loop_enabled,
            eval_max_tokens=eval_max_tokens,
            tt_max_tokens=tt_max_tokens,
        )
        if allow_parallel
        else None
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


def run_learning_call(ctx: MessageContext) -> str | None:
    """Fire the ai_complete hook for the learner turn and persist the
    assistant reply.

    Loads the full prior history, fires the firstresult ``ai_complete``
    hook (a provider exception is wrapped as an inline ``ai_error`` rather
    than a 5xx so the learner turn is never lost), flushes the assistant
    message, and records ``history`` / ``assistant_text`` / ``assistant_msg``
    on the context. Returns ``None`` on success, or a non-fatal
    ``ai_error`` string (provider error / no reply).
    """
    from app.main import manager  # lazy: app.* not on sys.path in plugin's own test dir

    assert ctx.model is not None and ctx.api_key is not None and ctx.provider_key is not None
    db = ctx.db
    sess = ctx.session
    # Load EVERY prior message INCLUDING the user turn just saved, so the
    # AI sees exactly what is persisted (chronological order). For an
    # imported session the system message is rebuilt fresh from the
    # conversation FK (Rebuild-on-Resume, #1122) instead of replaying the
    # frozen persisted copy.
    history = build_outgoing_history(db, sess)
    try:
        learning_start = time.monotonic()
        assistant_text = ai_orchestration.call_ai_complete(
            pm=manager._pm,
            messages=history,
            model=ctx.model,
            api_key=ctx.api_key,
        )
        ctx.learning_ms = int((time.monotonic() - learning_start) * 1000)
    except Exception as exc:  # noqa: BLE001
        return f"AI provider error: {exc}"

    if not assistant_text:
        return (
            f"No registered provider returned a reply for model {ctx.model!r}. "
            f"Is the {ctx.provider_key!r} provider plugin enabled?"
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
    return None
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

    Reuses the shared /message phase functions (:func:`run_step_evaluation`
    + :func:`run_auto_loop`) in their SEQUENTIAL mode: the streaming reply
    is already complete here, so the Phase 18C parallel precompute is
    disabled (``allow_parallel=False``) - it would fire a pointless extra
    concurrent call and call ``asyncio.run`` inside the live event loop.
    The eval / transition latencies land on the context and are bridged
    back to the caller's holders.
    """
    ctx = MessageContext(db=db, session=sess, request_start_ts=time.monotonic())
    ctx.project = project
    ctx.model = model
    ctx.api_key = api_key
    ctx.history = history
    ctx.assistant_text = assistant_text

    assistant_msg = SessionMessage(
        session_id=sess.id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant_msg)
    db.flush()
    ctx.assistant_msg = assistant_msg

    run_step_evaluation(ctx, allow_parallel=False)
    run_auto_loop(ctx)

    db.commit()
    db.refresh(assistant_msg)
    db.refresh(sess)
    eval_ms_holder["value"] = ctx.evaluation_ms
    transition_ms_holder["value"] = ctx.topic_transition_ms
    return _StreamExchangeResult(
        message=assistant_msg,
        step_evaluation=ctx.step_eval_out,
        topic_transition=ctx.topic_transition_out,
    )
