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
    pieces += _metadata_lines(project)
    pieces += _profile_lines(project)
    pieces += _curriculum_lines(project)
    pieces += _vocabulary_lines(project)
    _append_session_blocks(pieces, project.get("sessions") or [])
    return _PROMPT_HEADER + "\n".join(pieces)


def _metadata_lines(project: dict[str, Any]) -> list[str]:
    """The fixed topic/goal/timeframe/daily-minutes header lines."""
    return [
        f"Topic: {project.get('topic') or 'unknown'}",
        f"Goal: {project.get('goal') or 'unknown'}",
        f"Timeframe: {project.get('timeframe') or 'unknown'}",
        f"Daily minutes: {project.get('daily_minutes') or 'unknown'}",
    ]


def _profile_lines(project: dict[str, Any]) -> list[str]:
    """Method-weight lines, or [] when no profile is present."""
    profile = project.get("profile")
    if not (isinstance(profile, dict) and profile):
        return []
    lines = ["\nLearning profile (method weights):"]
    lines += [f"  - {k}: {v}" for k, v in profile.items()]
    return lines


def _curriculum_lines(project: dict[str, Any]) -> list[str]:
    """Curriculum-chapter lines, or [] when none."""
    curriculum = project.get("curriculum") or []
    if not curriculum:
        return []
    lines = ["\nCurriculum chapters:"]
    lines += [f"  - {ch}" for ch in curriculum]
    return lines


def _vocabulary_lines(project: dict[str, Any]) -> list[str]:
    """Up to 50 vocabulary lines (to bound context), or [] when none."""
    vocab = project.get("vocabulary") or []
    if not vocab:
        return []
    lines = ["\nVocabulary entries (from analyzed conversations):"]
    for v in vocab[:50]:  # top 50 to bound context
        example = f" — {v.get('example')}" if v.get("example") else ""
        lines.append(f"  - {v.get('word', '?')} → {v.get('translation', '?')}{example}")
    return lines


def _append_session_blocks(pieces: list[str], sessions: list[dict[str, Any]]) -> None:
    """Append session transcript blocks to ``pieces`` in place, newest first,
    truncating from the oldest end once ``_MAX_CONTEXT_CHARS`` is reached."""
    if not sessions:
        return
    pieces.append("\nRecent sessions (newest first):")
    # Build session blocks; truncate from the oldest end if the running
    # total exceeds the budget.
    running = "\n".join(pieces)
    for sess in sessions:
        header = (
            f"\n=== Session {sess.get('started_at', '?')} "
            f"({sess.get('method', '?')}) ==="
        )
        body = str(sess.get("messages") or "")
        block = f"{header}\n{body}"
        if len(running) + len(block) > _MAX_CONTEXT_CHARS:
            # Truncate this block to whatever budget is left (oldest blocks
            # get progressively smaller; once the budget is exhausted we
            # stop appending).
            remaining = _MAX_CONTEXT_CHARS - len(running)
            if remaining < 200:
                break
            pieces.append(block[:remaining] + "\n[...truncated...]")
            break
        pieces.append(block)
        running += block


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
    from app.models import LearningProject

    project = db.get(LearningProject, project_id)
    if project is None:
        return None

    return {
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
        "daily_minutes": project.daily_minutes,
        "profile": _latest_profile_weights(db, project_id),
        "vocabulary": _collect_project_vocabulary(db, project.user_id),
        "sessions": _recent_session_dicts(db, project_id),
        # Curriculum chapters are derivable from LearningTopic but skipping
        # for v1 — the curriculum list isn't yet first-class on projects
        # (it's the user-scoped Curriculum model).
        "curriculum": [],
    }


def _latest_profile_weights(db, project_id: str) -> dict[str, float]:
    """Method weights from the most recent profile row, or {} when none."""
    from app.models import LearningProfile

    profile_row = (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.assessed_at.desc())
        .first()
    )
    if profile_row is None:
        return {}
    return {
        attr: float(getattr(profile_row, attr) or 0.0)
        for attr in (
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        )
    }


def _collect_project_vocabulary(db, user_id: str) -> list[dict[str, str]]:
    """Vocabulary from every analyzed conversation owned by ``user_id``.

    Walks the user's conversations (project_id-agnostic, so cross-project
    vocab is included) and flattens each one's parsed entries.
    """
    from app.models import ImportedConversation

    convs = (
        db.query(ImportedConversation)
        .filter(ImportedConversation.user_id == user_id)
        .filter(ImportedConversation.analyzed.is_(True))
        .all()
    )
    vocab: list[dict[str, str]] = []
    for conv in convs:
        vocab.extend(_vocabulary_from_conversation(conv))
    return vocab


def _vocabulary_from_conversation(conv: Any) -> list[dict[str, str]]:
    """Parse one conversation's ``analysis_result`` JSON into vocab dicts.

    Lenient: an empty/unparseable result or a malformed entry is skipped,
    not raised.
    """
    if not conv.analysis_result:
        return []
    try:
        analysis = json.loads(conv.analysis_result)
    except (TypeError, json.JSONDecodeError) as err:
        logger.warning(
            "Skipping conversation %s with unparseable analysis_result: %s",
            conv.id,
            err,
        )
        return []
    entries = (analysis or {}).get("vocabulary") if isinstance(analysis, dict) else None
    if not isinstance(entries, list):
        return []
    out: list[dict[str, str]] = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        word = str(e.get("word") or "").strip()
        tr = str(e.get("translation") or "").strip()
        if not word or not tr:
            continue
        out.append(
            {
                "word": word,
                "translation": tr,
                "example": str(e.get("example") or "").strip(),
            }
        )
    return out


def _recent_session_dicts(db, project_id: str) -> list[dict[str, Any]]:
    """Up to 10 newest completed sessions as ``{method, started_at, messages}`` dicts."""
    from app.models import LearningSession, SessionMessage

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
        body = "\n".join(f"{m.role.upper()}: {m.content}" for m in msgs if m.content)
        sessions.append(
            {
                "method": sess.method,
                "started_at": sess.started_at.isoformat() if sess.started_at else None,
                "messages": body,
            }
        )
    return sessions
