"""Active-recall question generator (Phase 32B / v1.19.0).

Fires the active ``ai_complete`` hook with a JSON-emitting
prompt against either a single session's transcript or the
project's recent sessions in aggregate. Parses the response
tolerantly (skip-on-bad-row instead of all-or-nothing) and
persists the result as ``study_questions`` rows.

Mirrors the shape of ``adaptive_learner_anki.card_extraction``:
pure-function prompt builder + parser, ``ai_call`` callable
injected by the route layer.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Type alias for the injected AI caller — same shape as in
# ``adaptive_learner_anki.card_extraction`` +
# ``adaptive_learner_session.pronunciation``.
AICallable = Callable[[list[dict[str, str]]], str | None]


# Allowed values for parser validation. Mirror the
# ``StudyQuestion`` model's ``question_type`` + ``difficulty``
# columns.
_ALLOWED_TYPES = {"open", "fill_blank", "explain", "compare"}
_ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}


PROMPT = """You are an active-recall question generator for a self-learner.

Read the following learning material and produce {limit} high-value study questions.

Output STRICT JSON only — an array of objects with this shape:
[
  {{
    "question": "What is the difference between X and Y?",
    "expected_answer": "X is ... while Y is ...",
    "type": "compare",
    "difficulty": "medium",
    "topic": "short topic tag"
  }}
]

Rules:
- ``type`` is one of: "open", "fill_blank", "explain", "compare"
- ``difficulty`` is one of: "easy", "medium", "hard" (pick per question)
- Prefer concepts the learner asked about or struggled with.
- For "fill_blank" the question MUST contain ``___`` (3 underscores).
- Keep ``expected_answer`` concise (1-3 sentences).
- Each ``topic`` is 1-3 words (e.g. "subjunctive mood", "for-loop syntax").
- Skip trivial recall.
- Output the array only — no prose, no markdown fences.

Material:
{content}
"""


@dataclass
class GeneratedQuestion:
    """One parsed question candidate."""

    question: str
    expected_answer: str
    question_type: str
    difficulty: str
    topic: str


def build_prompt(content: str, *, limit: int = 8) -> str:
    """Render the question-generator prompt; clip the content
    so a long transcript still fits modern LLM context windows.
    ``8000`` chars ≈ ~2000 tokens — leaves plenty of room for
    the ``limit`` questions in the response."""
    return PROMPT.format(limit=limit, content=content[:8000])


def parse_response(raw: str) -> list[GeneratedQuestion]:
    """Tolerantly parse the AI's JSON array.

    Same defensive shape as ``anki.card_extraction.parse_response``:
    strips ``json`` fences, returns ``[]`` on parse failure or
    non-array root, skips per-row on missing / out-of-range
    fields. The caller treats ``[]`` as "no questions generated"
    (non-fatal — the user can retry).
    """
    if not raw:
        return []
    stripped = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL)
    if fence:
        stripped = fence.group(1).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        logger.warning(
            "Study questions: response is not JSON. raw=%r",
            stripped[:200],
        )
        return []
    if not isinstance(data, list):
        return []
    out: list[GeneratedQuestion] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        question = str(row.get("question") or "").strip()
        if not question:
            continue
        expected = str(row.get("expected_answer") or "").strip()
        qtype = str(row.get("type") or "open").lower().strip()
        if qtype not in _ALLOWED_TYPES:
            # Don't drop the row — coerce to "open" so the user
            # still gets a usable question they can edit.
            qtype = "open"
        difficulty = str(row.get("difficulty") or "medium").lower().strip()
        if difficulty not in _ALLOWED_DIFFICULTIES:
            difficulty = "medium"
        topic = str(row.get("topic") or "").strip()[:200]
        out.append(
            GeneratedQuestion(
                question=question,
                expected_answer=expected,
                question_type=qtype,
                difficulty=difficulty,
                topic=topic,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Transcript helpers (DB-bound; lazy imports keep this file
# importable from plugin-only test contexts)
# ---------------------------------------------------------------------------


def session_transcript(db, session_id: str) -> tuple[str, str | None, str | None]:
    """``(transcript, user_id, project_id)`` from a session."""
    from app.models import LearningProject, LearningSession, SessionMessage

    sess = db.get(LearningSession, session_id)
    if sess is None:
        return "", None, None
    project = db.get(LearningProject, sess.project_id)
    if project is None:
        return "", None, None
    messages = (
        db.query(SessionMessage)
        .filter(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc())
        .all()
    )
    transcript = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in messages if m.content
    )
    return transcript, project.user_id, project.id


def project_transcript(
    db, project_id: str, *, max_sessions: int = 5
) -> tuple[str, str | None]:
    """Combined transcript across the project's N most recent
    completed sessions. Truncates oldest first if the joined
    text overruns the 8000-char prompt budget. Returns
    ``(transcript, user_id)``."""
    from app.models import LearningProject, LearningSession, SessionMessage

    project = db.get(LearningProject, project_id)
    if project is None:
        return "", None
    sessions = (
        db.query(LearningSession)
        .filter(LearningSession.project_id == project_id)
        .filter(LearningSession.status == "completed")
        .order_by(LearningSession.started_at.desc())
        .limit(max_sessions)
        .all()
    )
    if not sessions:
        return "", project.user_id
    sections: list[str] = []
    for sess in sessions:
        rows = (
            db.query(SessionMessage)
            .filter(SessionMessage.session_id == sess.id)
            .order_by(SessionMessage.created_at.asc())
            .all()
        )
        body = "\n".join(
            f"{m.role.upper()}: {m.content}" for m in rows if m.content
        )
        if not body:
            continue
        sections.append(
            f"=== Session ({sess.method}, started "
            f"{sess.started_at.isoformat() if sess.started_at else 'unknown'}) ===\n{body}"
        )
    transcript = "\n\n".join(sections)
    return transcript, project.user_id


# ---------------------------------------------------------------------------
# Persistence + entry points
# ---------------------------------------------------------------------------


def _persist(
    db,
    cards: list[GeneratedQuestion],
    *,
    user_id: str,
    project_id: str,
    session_id: str | None,
) -> list[Any]:
    """Insert one ``study_questions`` row per parsed question."""
    from app.models import StudyQuestion

    inserted: list[Any] = []
    for c in cards:
        row = StudyQuestion(
            user_id=user_id,
            project_id=project_id,
            session_id=session_id,
            question=c.question,
            expected_answer=c.expected_answer,
            question_type=c.question_type,
            difficulty=c.difficulty,
            topic=c.topic,
            edited=False,
        )
        db.add(row)
        inserted.append(row)
    if inserted:
        db.commit()
        for row in inserted:
            db.refresh(row)
    return inserted


def generate_from_session(
    db, session_id: str, ai_call: AICallable, *, limit: int = 8
) -> list[Any]:
    """Generate study questions from a session's transcript.
    Returns the inserted rows; empty on AI / parse failure."""
    transcript, user_id, project_id = session_transcript(db, session_id)
    if user_id is None or project_id is None or not transcript.strip():
        return []
    try:
        raw = ai_call(
            [{"role": "user", "content": build_prompt(transcript, limit=limit)}]
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "Study question generation failed for session %r.", session_id
        )
        return []
    cards = parse_response(raw or "")
    return _persist(
        db,
        cards,
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
    )


def generate_from_project(
    db, project_id: str, ai_call: AICallable, *, limit: int = 12
) -> list[Any]:
    """Generate study questions across the project's recent
    sessions. Larger default ``limit`` because the prompt's
    context is broader."""
    transcript, user_id = project_transcript(db, project_id)
    if user_id is None or not transcript.strip():
        return []
    try:
        raw = ai_call(
            [{"role": "user", "content": build_prompt(transcript, limit=limit)}]
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "Study question generation failed for project %r.", project_id
        )
        return []
    cards = parse_response(raw or "")
    return _persist(
        db,
        cards,
        user_id=user_id,
        project_id=project_id,
        session_id=None,
    )
