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
)
from app.schemas import (
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
from .session_runner import (
    MessageContext,
    _finalize_stream_exchange,
    _load_prior_messages,
    _MessageBody,
    _resolve_active_key,
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
