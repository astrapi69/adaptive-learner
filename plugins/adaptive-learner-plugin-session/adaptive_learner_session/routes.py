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
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import (
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

from . import ai_orchestration
from .prompts import MAX_STEP, METHODS, MIN_STEP, build_prompt
from .topic_transition import (
    TRANSITION_DEFAULT_MAX_TOKENS,
    TopicTransition,
    evaluate_topic_transition,
)
from .step_evaluator import (
    EVALUATION_DEFAULT_MAX_TOKENS,
    StepEvaluation,
    evaluate_step,
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


@router.post(
    "/start",
    response_model=_SessionStartOut,
    status_code=status.HTTP_201_CREATED,
)
def start_session(payload: _StartBody, db: Session = Depends(get_db)) -> _SessionStartOut:
    project = _get_project(db, payload.project_id)
    profile = _latest_profile(db, project.id)
    method_key = payload.method.value if payload.method else _pick_initial_method(profile)

    sess = LearningSession(
        project_id=project.id,
        method=method_key,
        cycle_step=payload.cycle_step,
        status="active",
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


def _resolve_active_key(
    db: Session, user_id: str
) -> tuple[str | None, str | None, str | None]:
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

    settings = settings_service.get_or_create_settings(db, user_id)
    provider_key = settings.active_provider
    try:
        provider_enum = AIProvider(provider_key)
    except ValueError:
        return None, None, None
    api_key = settings_service.get_decrypted_api_key(db, user_id, provider_enum)
    override_attr = f"model_override_{provider_key}"
    override = getattr(settings, override_attr, None)
    return provider_key, api_key, override


@router.post(
    "/{session_id}/message",
    response_model=_SessionMessageExchangeOut,
    status_code=status.HTTP_201_CREATED,
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
    user_msg = SessionMessage(
        session_id=sess.id,
        role=payload.role.value,
        content=payload.content,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Helper closure: every exit point of this handler returns
    # the same composite shape, so the frontend's typed contract
    # stays consistent. v0.4.0: the response now also carries the
    # full LearningSession row so the frontend can read the
    # current cycle_step without a separate fetch.
    def _build_response(
        assistant: SessionMessage | None = None,
        ai_error: str | None = None,
        step_evaluation: _StepEvaluationOut | None = None,
        topic_transition: _TopicTransitionOut | None = None,
    ) -> _SessionMessageExchangeOut:
        return _SessionMessageExchangeOut(
            user_message=SessionMessageOut.model_validate(user_msg),
            assistant_message=(
                SessionMessageOut.model_validate(assistant) if assistant is not None else None
            ),
            ai_error=ai_error,
            session=LearningSessionOut.model_validate(sess),
            step_evaluation=step_evaluation,
            topic_transition=topic_transition,
        )

    if payload.role != MessageRole.USER:
        # No AI step for assistant / system writes; no cycle-step
        # advance either (the advance only fires on a real
        # learner-AI round-trip).
        return _build_response()

    # Look up the project owner -> active provider -> API key.
    project = db.get(LearningProject, sess.project_id)
    if project is None:
        return _build_response(ai_error="session has no project; AI reply skipped.")
    provider_key, api_key, model_override = _resolve_active_key(db, project.user_id)
    if provider_key is None:
        return _build_response(ai_error="No active AI provider configured.")
    if not api_key:
        return _build_response(ai_error=f"No API key stored for provider {provider_key!r}.")

    model = ai_orchestration.resolve_model(provider_key, override=model_override)
    if model is None:
        return _build_response(
            ai_error=f"Provider {provider_key!r} has no default model registered."
        )

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

        assistant_text = ai_orchestration.call_ai_complete(
            pm=manager._pm,
            messages=history,
            model=model,
            api_key=api_key,
        )
    except Exception as exc:  # noqa: BLE001
        return _build_response(ai_error=f"AI provider error: {exc}")

    if not assistant_text:
        return _build_response(
            ai_error=(
                f"No registered provider returned a reply for model {model!r}. "
                f"Is the {provider_key!r} provider plugin enabled?"
            )
        )

    assistant_msg = SessionMessage(
        session_id=sess.id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant_msg)
    db.flush()  # assign assistant_msg.id without committing the txn yet

    # --- v0.5.0 (Phase 8B): dual-prompt cycle-step transition --------------
    #
    # The v0.4.x deterministic +1 advance is now config-gated. When
    # step_evaluation is enabled (the default), the route fires a
    # SECOND ai_complete call against the same provider with a short
    # max_tokens cap; the AI returns a JSON verdict
    # (advance/confidence/reason/suggested_step) and the route
    # applies the suggestion iff:
    #   - real evaluation: advance ∧ confidence >= threshold, OR
    #   - fallback path:   advance (the deterministic-+1 fallback
    #                       IS the v0.4.x compat path; threshold
    #                       does not gate it).
    # When step_evaluation is disabled, the route keeps the v0.4.x
    # deterministic +1 behaviour verbatim.
    from_step = int(sess.cycle_step)
    step_eval_enabled, threshold, eval_max_tokens = _read_step_evaluation_config()
    step_eval_out: _StepEvaluationOut | None = None

    if step_eval_enabled:
        # Look up the learner's UI language so the evaluator's
        # ``reason`` field renders naturally if the frontend surfaces
        # it as a tooltip. Phase 8 Q3 — English prompt + localised
        # reason via output_language steer.
        owner = db.get(User, project.user_id)
        eval_lang = owner.language if owner else "en"

        # The evaluator judges the FULL exchange including the AI's
        # just-produced answer — that's the signal-rich payload.
        # ``history`` at this point already contains the user message
        # we just saved (loaded via _load_prior_messages above) but
        # not the assistant reply we haven't committed yet, so append
        # it explicitly.
        full_history = history + [
            {"role": "assistant", "content": assistant_text}
        ]
        evaluation: StepEvaluation = evaluate_step(
            pm=manager._pm,
            method=sess.method,
            current_step=from_step,
            history=full_history,
            model=model,
            api_key=api_key,
            output_language=eval_lang,
            max_tokens=eval_max_tokens,
        )
        if evaluation.fallback_used:
            # Fallback IS the deterministic advance: apply per
            # evaluation.advance (which is +1 below step 7, False
            # at step 7 to cap the cycle).
            applied = evaluation.advance
        else:
            applied = evaluation.advance and (
                evaluation.confidence >= threshold
            )
        if applied:
            sess.cycle_step = evaluation.suggested_step
        # v0.5.0 / 8D — persist the evaluation row for the
        # tracking plugin's aggregates (avg confidence, repeat
        # count, time-per-step). ``to_step`` records where the
        # session ACTUALLY went (= from_step if not applied,
        # = suggested_step if applied), not just what the AI
        # suggested. ``reason`` is stored verbatim regardless of
        # fallback_used so a future audit can see whether the AI
        # was outputting useful text or producing parse-fail
        # garbage.
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
        # v0.4.x compat: deterministic +1 advance, capped at 7.
        if sess.cycle_step < MAX_STEP:
            sess.cycle_step += 1

    # v1.4.0 — auto-loop after step 7. When the step evaluator just
    # ADVANCED the session INTO step 7 with advance=true, ask the
    # AI whether the topic was integrated + what to learn next. If
    # cycle_complete AND continue_recommended AND cycle_count <
    # max_cycles, reset to step 1 and increment cycle_count.
    topic_transition_out: _TopicTransitionOut | None = None
    auto_loop_enabled, max_cycles, tt_max_tokens = _read_auto_loop_config()
    just_hit_step_7 = (
        step_eval_out is not None
        and step_eval_out.applied
        and step_eval_out.suggested_step == MAX_STEP
        and step_eval_out.advance
    )
    if auto_loop_enabled and just_hit_step_7:
        owner = db.get(User, project.user_id)
        loop_lang = owner.language if owner else "en"
        full_history = history + [
            {"role": "assistant", "content": assistant_text}
        ]
        transition: TopicTransition = evaluate_topic_transition(
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
        looped = (
            not transition.fallback_used
            and transition.cycle_complete
            and transition.continue_recommended
            and transition.next_topic is not None
            and sess.cycle_count < max_cycles
        )
        if looped:
            # Persist the completed cycle's summary BEFORE
            # resetting so the export tells the full multi-cycle
            # story.
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

    return _build_response(
        assistant=assistant_msg,
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
