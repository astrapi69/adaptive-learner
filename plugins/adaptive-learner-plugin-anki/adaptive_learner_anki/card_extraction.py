"""Flashcard extraction service (Phase 30B / v1.17.0).

Fires the ``ai_complete`` hook with a focused JSON-emitting
prompt against either a session's transcript or an imported
conversation's text. The model returns a list of card
candidates; we parse, validate, and persist them as
``anki_card_suggestions`` rows with ``accepted=False`` so the
user must review before they reach a .apkg export.

The prompt is deliberately small (~256 token budget) so the
extraction is cheap relative to the session AI cost — one card
extraction per session is a small marginal expense.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """You are a flashcard generator. Read the following learning material and extract up to {limit} high-value flashcards.

Output STRICT JSON only — an array of objects with this shape:
[
  {{"type": "basic", "front": "Q", "back": "A", "tags": ["t1"]}},
  {{"type": "cloze", "front": "Sentence with {{{{c1::blank}}}}", "back": "extra info or empty", "tags": []}}
]

Rules:
- type is "basic" or "cloze" only.
- Cloze cards use Anki's {{{{c1::word}}}} syntax in the front field.
- Tags are short lowercase words; lists may be empty.
- Skip trivial recall (definitions everyone already knows).
- Prefer concepts the learner struggled with or asked about.
- Output the array only — no prose, no markdown fences.

Material:
{content}
"""


@dataclass
class ExtractedCard:
    """One parsed flashcard candidate from the AI response."""

    card_type: str
    front: str
    back: str
    tags: list[str]


def build_prompt(content: str, *, limit: int = 8) -> str:
    """Render the extraction prompt with the material clipped to
    a sane length (8000 chars ≈ ~2000 tokens, fits in any modern
    LLM's context with room for the response)."""
    return EXTRACTION_PROMPT.format(
        limit=limit, content=content[:8000]
    )


def parse_response(raw: str) -> list[ExtractedCard]:
    """Tolerant JSON parser for AI-emitted card arrays.

    Strips a leading ```json``` fence + trailing ``` if the model
    couldn't follow the no-markdown rule. Skips rows missing
    required keys. Returns an empty list on parse failure rather
    than raising — the caller treats that as "no cards extracted"
    so a transient AI hiccup doesn't break the session-end flow.
    """
    if not raw:
        return []
    stripped = raw.strip()
    # Trim a ```json ... ``` fence if present.
    fence_match = re.match(
        r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL
    )
    if fence_match:
        stripped = fence_match.group(1).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        logger.warning(
            "Anki card extraction: response is not JSON. "
            "Returning empty list. raw=%r",
            stripped[:200],
        )
        return []
    if not isinstance(data, list):
        return []
    out: list[ExtractedCard] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        card_type = str(row.get("type") or "basic").lower()
        if card_type not in ("basic", "cloze"):
            continue
        front = str(row.get("front") or "").strip()
        back = str(row.get("back") or "").strip()
        if not front:
            continue
        raw_tags = row.get("tags") or []
        if not isinstance(raw_tags, list):
            raw_tags = []
        tags = [
            str(t).strip().lower()
            for t in raw_tags
            if isinstance(t, (str, int, float))
        ]
        tags = [t for t in tags if t]
        out.append(
            ExtractedCard(
                card_type=card_type, front=front, back=back, tags=tags
            )
        )
    return out


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------


def _persist_cards(
    db: Session,
    *,
    cards: list[ExtractedCard],
    user_id: str,
    session_id: str | None,
    conversation_id: str | None,
    project_id: str | None,
) -> list[Any]:
    """Insert one ``anki_card_suggestions`` row per ExtractedCard."""
    from app.models import AnkiCardSuggestion

    inserted: list[Any] = []
    for card in cards:
        row = AnkiCardSuggestion(
            user_id=user_id,
            session_id=session_id,
            conversation_id=conversation_id,
            project_id=project_id,
            card_type=card.card_type,
            front=card.front,
            back=card.back,
            tags=json.dumps(card.tags, ensure_ascii=False),
            accepted=False,
            rejected=False,
        )
        db.add(row)
        inserted.append(row)
    if inserted:
        db.commit()
        for row in inserted:
            db.refresh(row)
    return inserted


# ---------------------------------------------------------------------------
# Transcript builders + entry points (caller injects ai_call)
# ---------------------------------------------------------------------------


# Type alias for the injected AI caller. The route layer resolves
# the user's active provider, decrypts the api_key, picks the
# model, and produces a callable matching this signature. The
# extractor stays test-friendly + framework-free.
AICallable = Any  # Callable[[list[dict[str, str]]], str | None]


def _session_transcript(db: Session, session_id: str) -> tuple[str, str | None, str | None]:
    """Return ``(transcript, user_id, project_id)`` for a session.

    Empty transcript when the session has no messages yet. The
    user_id is resolved via project for the AnkiCardSuggestion
    FK; project_id is carried so the export UI can group cards
    by project.
    """
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


def _conversation_transcript(
    db: Session, conversation_id: str
) -> tuple[str, str | None, str | None, dict[str, Any]]:
    """Return ``(transcript, user_id, project_id, analysis_dict)``."""
    from app.models import ImportedConversation, ImportedMessage

    conv = db.get(ImportedConversation, conversation_id)
    if conv is None:
        return "", None, None, {}
    rows = (
        db.query(ImportedMessage)
        .filter(ImportedMessage.conversation_id == conversation_id)
        .order_by(ImportedMessage.order_index.asc())
        .all()
    )
    transcript = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in rows if m.content
    )
    analysis: dict[str, Any] = {}
    if conv.analysis_result:
        try:
            parsed = json.loads(conv.analysis_result)
            if isinstance(parsed, dict):
                analysis = parsed
        except (TypeError, json.JSONDecodeError) as err:
            logger.warning(
                "Ignoring unparseable analysis_result for conversation %s: %s",
                conversation_id,
                err,
            )
    return transcript, conv.user_id, conv.project_id, analysis


def extract_from_session(
    db: Session, session_id: str, ai_call: AICallable
) -> list[Any]:
    """Pull the session transcript, call the injected AI helper,
    parse, persist. Returns the inserted rows (empty on failure)."""
    transcript, user_id, project_id = _session_transcript(db, session_id)
    if not user_id or not transcript.strip():
        return []
    try:
        raw = ai_call(
            [{"role": "user", "content": build_prompt(transcript)}]
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "AI extraction failed for session %r; returning [].", session_id
        )
        return []
    cards = parse_response(raw or "")
    return _persist_cards(
        db,
        cards=cards,
        user_id=user_id,
        session_id=session_id,
        conversation_id=None,
        project_id=project_id,
    )


def extract_from_conversation(
    db: Session, conversation_id: str, ai_call: AICallable
) -> list[Any]:
    """Build cards from a conversation.

    Two paths:
      1. **Vocabulary (no AI cost):** if the conversation has a
         persisted ``analysis_result.vocabulary`` list, transform
         it into cloze cards directly via
         :func:`_cards_from_vocabulary`. This is the Phase 30D
         feature.
      2. **AI extraction:** when vocabulary was empty, fall
         through to the same prompt + parser used by sessions.

    Both paths feed the same persistence layer.
    """
    transcript, user_id, project_id, analysis = _conversation_transcript(
        db, conversation_id
    )
    if not user_id:
        return []

    cards: list[ExtractedCard] = []
    vocab = analysis.get("vocabulary")
    if isinstance(vocab, list):
        cards.extend(_cards_from_vocabulary(vocab))

    if not cards and transcript.strip():
        try:
            raw = ai_call(
                [{"role": "user", "content": build_prompt(transcript)}]
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "AI extraction failed for conversation %r.", conversation_id
            )
            raw = ""
        cards.extend(parse_response(raw or ""))

    return _persist_cards(
        db,
        cards=cards,
        user_id=user_id,
        session_id=None,
        conversation_id=conversation_id,
        project_id=project_id,
    )


# ---------------------------------------------------------------------------
# 30D vocabulary → ExtractedCard transform (no AI call)
# ---------------------------------------------------------------------------


def _cards_from_vocabulary(entries: list[Any]) -> list[ExtractedCard]:
    """Build cloze cards from the analysis ``vocabulary`` list.

    Expected shape per entry::

        {"word": "hablar", "translation": "to speak",
         "example": "Yo hablo espanol", "tags": ["verb", "present"]}

    The card shape is:
      - front:  Cloze sentence with the word blanked, or just
                the word if no example.
      - back:   translation (+ phonetic if present).
      - tags:   merged from the entry's tags + "vocabulary".

    Skips malformed entries silently — extraction is best-effort.
    """
    out: list[ExtractedCard] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        word = str(entry.get("word") or "").strip()
        translation = str(entry.get("translation") or "").strip()
        example = str(entry.get("example") or "").strip()
        phonetic = str(entry.get("phonetic") or "").strip()
        raw_tags = entry.get("tags") or []
        if not isinstance(raw_tags, list):
            raw_tags = []
        tags = [
            str(t).strip().lower()
            for t in raw_tags
            if isinstance(t, (str, int, float))
        ]
        tags = [t for t in tags if t]
        tags.append("vocabulary")

        if not word or not translation:
            continue

        if example and word.lower() in example.lower():
            # Replace the first case-insensitive occurrence with
            # the cloze deletion. Anki uses ``{{c1::...}}``.
            pattern = re.compile(re.escape(word), re.IGNORECASE)
            front = pattern.sub(f"{{{{c1::{word}}}}}", example, count=1)
            card_type = "cloze"
        else:
            # Plain front/back card.
            front = word
            card_type = "basic"

        back = translation
        if phonetic:
            back = f"{translation}\n[{phonetic}]"

        out.append(
            ExtractedCard(
                card_type=card_type, front=front, back=back, tags=tags
            )
        )
    return out
