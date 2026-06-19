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

The plugin-local request/response schemas live in ``route_schemas``,
the shared DB/dict helpers in ``route_helpers``, and the SSE
token-streaming endpoint's logic in ``streaming`` (#411); this module
keeps only the routing.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import (
    LearningProject,
    LearningSession,
    MethodSwitch,
    SessionMessage,
    SessionRating,
)
from app.schemas import (
    LearningMethod,
    LearningSessionOut,
    MessageRole,
    SessionMessageOut,
    SessionRatingOut,
)
from app.services.ai_caller import build_ai_caller

from . import pronunciation as _pronunciation
from . import streaming
from .prompts import build_prompt
from .route_helpers import (
    _analysis_context_for,
    _fire_on_session_complete,
    _get_project,
    _get_session,
    _is_language_project,
    _latest_profile,
    _learning_context_for,
    _pick_initial_method,
    _profile_to_dict,
    _project_to_dict,
)
from .route_schemas import (
    _EndBody,
    _PronunciationJudgeBody,
    _PronunciationJudgeOut,
    _PronunciationPhraseBody,
    _PronunciationPhraseOut,
    _RatingBody,
    _SessionEndOut,
    _SessionStartOut,
    _StartBody,
    _SwitchAcceptBody,
    _SwitchRecommendationOut,
)
from .session_runner import (
    MessageContext,
    _MessageBody,
    _SessionMessageExchangeOut,
    assemble_exchange,
    build_exchange_response,
    persist_user_message,
    resolve_ai_context,
    run_auto_loop,
    run_learning_call,
    run_step_evaluation,
)

router = APIRouter(prefix="/plugins/session", tags=["session"])


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

    # Phase 36 Bug 4 — resume an existing active session for the
    # same conversation instead of creating a new one. The lookup
    # short-circuits the new-session insert; the system prompt
    # already lives on the session's first message.
    if payload.imported_conversation_id:
        active = (
            db.query(LearningSession)
            .filter(
                LearningSession.imported_conversation_id == payload.imported_conversation_id,
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

    # #797 — give the AI awareness of the learner's lesson progress
    # (completed content + scores, the lesson in progress, recent
    # mistakes) so it builds on real progress instead of answering
    # generically. Empty for a learner with no lesson activity.
    learning_block = _learning_context_for(db, project, payload.lang)
    if learning_block:
        prompt = f"{prompt}\n\n{learning_block}"

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

    ai_error = run_learning_call(ctx)
    if ai_error is not None:
        return build_exchange_response(ctx, ai_error=ai_error)

    run_step_evaluation(ctx)
    run_auto_loop(ctx)

    return assemble_exchange(ctx)


# --- POST /{id}/message/stream (v1.6.0 / Phase 19) -------------------------


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

    Thin delegation: the SSE wiring (event schema, provider-stream
    fallback, post-stream step-evaluation + topic-transition, setup-error
    handling) lives in :func:`streaming.build_message_stream_response`
    (#411).
    """
    return streaming.build_message_stream_response(session_id, payload, db)


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


# --- Pronunciation Practice (v1.18.0 / Phase 31C) -------------------------


@router.post("/pronunciation/phrase", response_model=_PronunciationPhraseOut)
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
        raise NotFoundError(f"LearningProject {body.project_id!r} not found.")
    ai_call = build_ai_caller(db, project.user_id, max_tokens=256)
    phrase = _pronunciation.generate_phrase(
        ai_call,
        language=body.language,
        level=body.level,
        focus=body.focus,
        previous=body.previous,
    )
    if phrase is None:
        raise ValidationError("Could not generate a pronunciation phrase. Try again.")
    return _PronunciationPhraseOut(phrase=phrase, language=body.language)


@router.post("/pronunciation/judge", response_model=_PronunciationJudgeOut)
def judge_pronunciation(
    body: _PronunciationJudgeBody,
    db: Session = Depends(get_db),
) -> _PronunciationJudgeOut:
    """Score a pronunciation attempt + return short feedback."""
    project = db.get(LearningProject, body.project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {body.project_id!r} not found.")
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
        raise ValidationError("Could not judge the pronunciation attempt. Try again.")
    return _PronunciationJudgeOut(**verdict.to_dict())


@router.get("/pronunciation/eligibility/{project_id}")
def pronunciation_eligibility(project_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Tell the frontend whether this project should surface
    the Pronunciation Practice quick-start.

    Returns ``{eligible: bool}``. ``True`` when the project has
    at least one Subject under the ``languages`` ancestor.
    """
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return {"eligible": _is_language_project(db, project_id)}
