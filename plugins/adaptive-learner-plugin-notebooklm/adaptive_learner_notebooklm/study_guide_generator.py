"""Study guide generator (Phase 32C / v1.19.0).

One big AI call with content-clipping. Assembles a project's
sessions + extractions + curriculum + profile into a
~10K-token prompt and asks the model to produce a comprehensive
Markdown study guide. If the assembled context exceeds the
budget, oldest sessions get truncated first (the recent ones
hold the freshest learning).

The output is the raw Markdown body — the route layer wraps it
in download headers. No persistence: the user can re-generate
anytime; storing the result would just stale-out the moment
they completed a new session.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

AICallable = Callable[[list[dict[str, str]]], str | None]

# Hard ceiling for the assembled-prompt body. ~10K tokens ≈
# ~30000 characters with English/German prose. Models can take
# more but the response budget shrinks correspondingly; the
# spec asks for "comprehensive but concise" so we stay
# conservative.
_MAX_CONTEXT_CHARS = 30_000

_PROMPT_HEADER = """You are a study guide author. Produce a comprehensive Markdown study guide for the project below.

Structure:
1. Title (H1) — the project's topic.
2. Overview (H2) — one paragraph: goal + timeframe + level.
3. Key Concepts (H2) — H3 per concept, 1-2 paragraph summary each.
4. Common Mistakes (H2) — bullet list with brief corrections.
5. Practice Exercises (H2) — 5-10 exercises across difficulty levels.
6. Vocabulary (H2) — IF the project is a language-learning one; otherwise omit. Table of word | translation | example.
7. Further Study (H2) — 3-5 next-step suggestions.

Rules:
- Output Markdown ONLY. No prose framing, no JSON, no code fences around the whole thing.
- Use short paragraphs (NotebookLM-optimised).
- Use H2 for sections, H3 for sub-concepts.
- Cite content from the project — don't invent topics that aren't there.

Project data follows:

"""


def build_prompt(*, project: dict[str, Any]) -> str:
    """Render the study-guide prompt with the project context
    clipped to ``_MAX_CONTEXT_CHARS``.

    ``project`` is a dict with keys:
      - ``topic``, ``goal``, ``timeframe``, ``daily_minutes``
      - ``profile``: optional dict of method weights
      - ``vocabulary``: list of ``{word, translation, example}``
        from any analyzed imported_conversations
      - ``sessions``: list of session dicts ordered newest-
        first. Each has ``method``, ``started_at``, ``messages``
        (transcript string).
      - ``curriculum``: optional list of chapter titles
    """
    pieces: list[str] = []
    pieces.append(f"Topic: {project.get('topic') or 'unknown'}")
    pieces.append(f"Goal: {project.get('goal') or 'unknown'}")
    pieces.append(f"Timeframe: {project.get('timeframe') or 'unknown'}")
    pieces.append(
        f"Daily minutes: {project.get('daily_minutes') or 'unknown'}"
    )
    profile = project.get("profile")
    if isinstance(profile, dict) and profile:
        pieces.append("\nLearning profile (method weights):")
        for k, v in profile.items():
            pieces.append(f"  - {k}: {v}")
    curriculum = project.get("curriculum") or []
    if curriculum:
        pieces.append("\nCurriculum chapters:")
        for ch in curriculum:
            pieces.append(f"  - {ch}")
    vocab = project.get("vocabulary") or []
    if vocab:
        pieces.append("\nVocabulary entries (from analyzed conversations):")
        for v in vocab[:50]:  # top 50 to bound context
            pieces.append(
                f"  - {v.get('word', '?')} → {v.get('translation', '?')}"
                + (
                    f" — {v.get('example')}" if v.get("example") else ""
                )
            )

    sessions = project.get("sessions") or []
    if sessions:
        pieces.append("\nRecent sessions (newest first):")
        # Build session blocks; truncate from the oldest end if
        # the running total exceeds the budget.
        running = "\n".join(pieces)
        for sess in sessions:
            header = (
                f"\n=== Session {sess.get('started_at', '?')} "
                f"({sess.get('method', '?')}) ==="
            )
            body = str(sess.get("messages") or "")
            block = f"{header}\n{body}"
            if len(running) + len(block) > _MAX_CONTEXT_CHARS:
                # Truncate this block to whatever budget is left
                # (oldest blocks get progressively smaller; once
                # the budget is exhausted we stop appending).
                remaining = _MAX_CONTEXT_CHARS - len(running)
                if remaining < 200:
                    break
                block = block[:remaining] + "\n[...truncated...]"
                pieces.append(block)
                break
            pieces.append(block)
            running += block

    return _PROMPT_HEADER + "\n".join(pieces)


def parse_response(raw: str) -> str:
    """The study guide is freeform Markdown — the parser just
    strips an outer ```markdown ... ``` fence if present. The
    route layer hands the resulting string straight to the
    download response."""
    if not raw:
        return ""
    stripped = raw.strip()
    # Strip an outer fence if the model wrapped its output.
    import re

    fence = re.match(
        r"^```(?:markdown|md)?\s*(.*?)\s*```$", stripped, re.DOTALL
    )
    if fence:
        return fence.group(1).strip()
    return stripped


def generate(
    ai_call: AICallable, *, project: dict[str, Any]
) -> str:
    """High-level wrapper: build prompt + fire AI + parse.

    Returns the raw Markdown body. Empty string on AI failure
    (the route translates to a 503).
    """
    prompt = build_prompt(project=project)
    try:
        raw = ai_call([{"role": "user", "content": prompt}])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Study guide AI call failed for project %r.",
            project.get("topic"),
        )
        return ""
    return parse_response(raw or "")


# ---------------------------------------------------------------------------
# Helper: assemble the project dict from DB rows.
# ---------------------------------------------------------------------------


def assemble_project_context(db, project_id: str) -> dict[str, Any] | None:
    """Pull project + recent sessions + vocabulary + profile
    into the dict shape ``build_prompt`` expects. Returns
    ``None`` when the project doesn't exist."""
    from app.models import (
        ImportedConversation,
        LearningProfile,
        LearningProject,
        LearningSession,
        SessionMessage,
    )

    project = db.get(LearningProject, project_id)
    if project is None:
        return None

    profile_row = (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.assessed_at.desc())
        .first()
    )
    profile_dict: dict[str, float] = {}
    if profile_row is not None:
        for attr in (
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ):
            profile_dict[attr] = float(getattr(profile_row, attr) or 0.0)

    # Vocabulary: walk every analyzed conversation tied to this
    # project (or to the project's user with project_id null
    # for cross-project vocab).
    vocab: list[dict[str, str]] = []
    convs = (
        db.query(ImportedConversation)
        .filter(ImportedConversation.user_id == project.user_id)
        .filter(ImportedConversation.analyzed.is_(True))
        .all()
    )
    for conv in convs:
        if not conv.analysis_result:
            continue
        try:
            analysis = json.loads(conv.analysis_result)
        except (TypeError, json.JSONDecodeError) as err:
            logger.warning(
                "Skipping conversation %s with unparseable analysis_result: %s",
                conv.id,
                err,
            )
            continue
        entries = (analysis or {}).get("vocabulary") if isinstance(analysis, dict) else None
        if not isinstance(entries, list):
            continue
        for e in entries:
            if not isinstance(e, dict):
                continue
            word = str(e.get("word") or "").strip()
            tr = str(e.get("translation") or "").strip()
            if not word or not tr:
                continue
            vocab.append(
                {
                    "word": word,
                    "translation": tr,
                    "example": str(e.get("example") or "").strip(),
                }
            )

    # Recent sessions (10 newest, completed only).
    session_rows = (
        db.query(LearningSession)
        .filter(LearningSession.project_id == project_id)
        .filter(LearningSession.status == "completed")
        .order_by(LearningSession.started_at.desc())
        .limit(10)
        .all()
    )
    sessions: list[dict[str, Any]] = []
    for sess in session_rows:
        msgs = (
            db.query(SessionMessage)
            .filter(SessionMessage.session_id == sess.id)
            .order_by(SessionMessage.created_at.asc())
            .all()
        )
        body = "\n".join(
            f"{m.role.upper()}: {m.content}" for m in msgs if m.content
        )
        sessions.append(
            {
                "method": sess.method,
                "started_at": sess.started_at.isoformat()
                if sess.started_at
                else None,
                "messages": body,
            }
        )

    return {
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
        "daily_minutes": project.daily_minutes,
        "profile": profile_dict,
        "vocabulary": vocab,
        "sessions": sessions,
        # Curriculum chapters are derivable from
        # LearningTopic but skipping for v1 — the curriculum
        # list isn't yet first-class on projects (it's the
        # user-scoped Curriculum model).
        "curriculum": [],
    }
