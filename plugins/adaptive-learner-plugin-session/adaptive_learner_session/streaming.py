"""SSE token-streaming for POST /{id}/message/stream (#411).

Extracted from ``routes.py`` so the route module stays thin: the endpoint there
is a one-line delegation to :func:`build_message_stream_response`. Behaviour is
verbatim from the original inline endpoint (v1.6.0 / Phase 19) — same SSE event
schema, same fallback to the non-stream provider call, same post-stream
step-evaluation + topic-transition, same setup-error handling.
"""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.models import LearningProject, SessionMessage
from app.schemas import LearningSessionOut, MessageRole, SessionMessageOut

from . import ai_orchestration
from .route_helpers import _get_session
from .session_runner import (
    _finalize_stream_exchange,
    _MessageBody,
    _resolve_active_key,
    build_outgoing_history,
)


def _sse_event(event: str, data: dict[str, Any]) -> bytes:
    """Format one Server-Sent-Events frame.

    SSE wire format: ``event: <name>\\ndata: <json>\\n\\n``. We
    always JSON-encode the data block so the client parser doesn't
    have to branch on event type.
    """
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n".encode()


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
    sess: Any,
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


def build_message_stream_response(
    session_id: str,
    payload: _MessageBody,
    db: Session,
) -> StreamingResponse:
    """v1.6.0 / Phase 19 - token-streaming variant of /message.

    Mirrors the non-streaming /message orchestration but streams the
    assistant reply back via SSE ``chunk`` events, then emits a final
    ``done`` event carrying ``session``, ``user_message``,
    ``assistant_message``, ``step_evaluation``, ``topic_transition``,
    and ``timings`` — the same payload the non-stream /message returns
    in one shot. On a provider error the route emits ``ai_error`` on the
    final ``done`` event; the user message is still persisted.

    SSE event schema:
      - ``start``: ``{user_message: SessionMessageOut}``
      - ``chunk``: ``{delta: str}``
      - ``done``:  ``{session, user_message, assistant_message?, ai_error?,
                       step_evaluation?, topic_transition?, timings}``
      - ``error``: ``{detail: str}`` (only on auth/setup failures where the
                    route bails before opening the stream proper; provider
                    errors land in ``done.ai_error``).
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

    # Rebuild-on-Resume for imported sessions (#1122); persisted history
    # otherwise. Same contract as the non-stream /message path.
    history = build_outgoing_history(db, sess)
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
