"""Server-side conversation-analysis engine (Phase 18 follow-up fix).

Mirrors the browser-direct engine in
``frontend/src/chat_import/analysis.ts``. The frontend engine is
the right home for Dexie-mode users; this server-side engine is
what API-mode users need because their cleartext API key only
lives on the backend.

The system prompt, JSON schema, and field-clamping rules are kept
byte-identical to the TypeScript engine so a conversation analysed
on the server yields the same shape the UI already renders.

Pipeline:

  1. ``chunk_messages`` splits the transcript into ~16k-char
     windows with 2-message overlap so context survives across
     boundaries.
  2. For each chunk: build a user message, call the ``ai_complete``
     hook against the user's active provider (decrypted key passed
     server-side; never exposed to the frontend), parse the JSON
     defensively via :mod:`app.services.extract_json`, project onto
     the analysis schema with strict clamping.
  3. ``merge_analyses`` folds the chunk results into one summary.
  4. ``analyze_conversation_with_ai`` orchestrates the loop and
     always returns a result — provider errors collapse to the
     deterministic fallback so the caller never sees an exception
     for an AI-level problem.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.extract_json import extract_json_object

VALID_METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)

VALID_LEVELS: tuple[str, ...] = ("beginner", "intermediate", "advanced")

# ~16000 chars ≈ 4000 input tokens, leaving room for the system
# prompt + response budget on a 16k-token-context model. The
# frontend uses the same threshold; keep them in sync.
MAX_CHUNK_CHARS = 16_000


# ISO-639-1 code → English display name for the 8 catalogues
# shipped under ``backend/config/i18n/``. Used by
# :func:`build_system_prompt` to name the user's preferred
# language to the AI; unknown codes fall back to English.
LANGUAGE_NAMES: dict[str, str] = {
    "de": "German",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "el": "Greek",
    "pt": "Portuguese",
    "tr": "Turkish",
    "ja": "Japanese",
}


_BASE_PROMPT_LINES: tuple[str, ...] = (
    "You are an analysis assistant for an adaptive learning system.",
    "The user pastes or imports a transcript of a learning-related",
    "conversation they had with an AI. Your job is to extract",
    "structured learning insights from it.",
    "",
    "OUTPUT FORMAT (MUST follow exactly):",
    "",
    "1. Your response MUST start with the character `{` and end with `}`.",
    "2. NO text before the opening `{`. No 'Here is...', no 'Sure...',",
    "   no 'I'll analyze...', no preamble of any kind.",
    "3. NO text after the closing `}`. No explanations, no offers to",
    "   provide more detail, no follow-up commentary.",
    "4. NO markdown code fences (no ``` or ```json).",
    "5. NO comments inside the JSON (// or /* */ are forbidden).",
    "6. The response must be parseable by JSON.parse() as a single object.",
    "",
    "Failure to follow these rules breaks the calling system. If you",
    "include ANY characters before `{` or after `}` the parser fails",
    "and the user sees an error instead of analysis.",
    "",
    "JSON SCHEMA:",
    "",
    "  {",
    '    "topic":               <string, the dominant subject>,',
    '    "subtopics":           [<string>, ...],',
    '    "user_level":          "beginner" | "intermediate" | "advanced",',
    '    "strengths":           [<string>, ...],',
    '    "weaknesses":          [<string>, ...],',
    '    "error_patterns":      [<string>, ...],',
    '    "recommended_method":  "deductive" | "inductive" | "error_based"',
    '                           | "dialogic" | "contextual" | "ai_adaptive",',
    '    "recommended_focus":   <string, one-sentence action>,',
    '    "suggested_curriculum": [',
    '      {"title": <string>, "description": <string>, "priority": <int 1-5>},',
    "      ...",
    "    ],",
    '    "summary":             <string, 1-2 sentences for the UI header>',
    "  }",
    "",
    "If you cannot determine a value for an optional field, OMIT the",
    "field entirely. Do NOT insert null, empty strings, or placeholder",
    "text.",
    "",
    "FIELD SEMANTICS:",
    "- 'strengths': what the user already grasps. Concrete, not",
    "  generic praise.",
    "- 'weaknesses': recurring gaps, confusions, or unfinished",
    "  threads in the conversation.",
    "- 'error_patterns': specific repeated mistakes the user made",
    "  (not the same as weaknesses - these are observable errors).",
    "- 'recommended_method': the six-method learning model:",
    "    deductive   - rule then examples",
    "    inductive   - examples then rule",
    "    error_based - fix mistakes as the path to insight",
    "    dialogic    - back-and-forth questioning",
    "    contextual  - anchor in the user's real-world situation",
    "    ai_adaptive - user steers the AI, self-directed",
    "- 'suggested_curriculum': 2-5 lesson stubs the user could",
    "  tackle next. 'priority' 1 = highest.",
    "",
    "Be specific. 'User struggled with concepts' is useless;",
    "'User confused inductive reasoning with abductive reasoning,",
    "treating any inference-from-examples as induction' is useful.",
    "",
    "If a section is genuinely empty, return an empty array - don't",
    "invent material.",
    "",
    "REMINDER: start your response with `{`. End with `}`. Nothing else.",
)


def build_system_prompt(
    lang: str = "en",
    source_language: str | None = None,
    target_language: str | None = None,
) -> str:
    """Return the analysis system prompt, localised for ``lang``.

    The prompt body is fixed (English instructions to the AI); a
    language directive is appended that tells the AI which language
    to use for the free-text string values. JSON keys and enum
    values stay English regardless of ``lang`` because the parser
    clamps against fixed identifier sets.

    ``source_language`` / ``target_language`` (v1.54.0, captured at
    import time) add a learner-context block so the AI extracts the
    right language's content. Both optional; omitted when absent.

    Unknown / unsupported language codes fall back to English so a
    misconfigured user setting never breaks analysis.
    """
    name = LANGUAGE_NAMES.get((lang or "en").lower(), "English")
    src = LANGUAGE_NAMES.get((source_language or "").lower()) if source_language else None
    tgt = LANGUAGE_NAMES.get((target_language or "").lower()) if target_language else None
    context = ""
    if src and tgt and src != tgt:
        context = (
            "LEARNER CONTEXT:\n"
            f"This transcript is a {src} speaker learning {tgt}. Extract the "
            f"{tgt} learning content (vocabulary, error patterns, weaknesses) "
            f"accordingly; the learner's own language is {src}.\n\n"
        )
    elif tgt:
        context = (
            "LEARNER CONTEXT:\n"
            f"This transcript studies {tgt}. Extract the {tgt} learning "
            "content accordingly.\n\n"
        )
    directive = (
        "LANGUAGE - IMPORTANT:\n"
        f"Write all free-text string values IN {name}. This applies to:\n"
        "- topic, subtopics\n"
        "- strengths, weaknesses, error_patterns\n"
        "- recommended_focus\n"
        "- summary\n"
        "- suggested_curriculum entries: both title and description\n"
        "\n"
        "Do NOT translate these - they MUST stay exactly as written:\n"
        "- JSON keys (the names left of `:`)\n"
        "- user_level enum values: beginner / intermediate / advanced\n"
        "- recommended_method enum values: deductive / inductive /\n"
        "  error_based / dialogic / contextual / ai_adaptive\n"
        "\n"
        "These are machine identifiers, not display text. If you\n"
        "translate them the parser breaks."
    )
    return "\n".join(_BASE_PROMPT_LINES) + "\n\n" + context + directive


# Backward-compatible English default. Existing callers that
# imported the constant continue to work; the function form is
# the canonical API going forward.
SYSTEM_PROMPT = build_system_prompt("en")


@dataclass(frozen=True)
class Message:
    """Transcript message handed to the engine. ``role`` is one of
    ``"user" | "assistant" | "system"``; the engine relabels these
    as Learner / AI in the user-content payload."""

    role: str
    content: str


def build_analysis_user_content(messages: list[Message], title: str | None = None) -> str:
    """Compose the labelled transcript that becomes the user-message
    body for one analysis call."""
    turns: list[str] = []
    for m in messages:
        if m.role == "user":
            label = "Learner"
        elif m.role == "assistant":
            label = "AI"
        else:
            label = "(system)"
        turns.append(f"{label}: {m.content}")
    transcript = "\n\n".join(turns)
    title_line = f"Title: {title}\n\n" if title else ""
    return (
        f"{title_line}--- transcript ---\n{transcript}\n--- end transcript ---\n\n"
        "Return only the JSON analysis. No surrounding prose."
    )


def chunk_messages(
    messages: list[Message], max_chars: int = MAX_CHUNK_CHARS
) -> list[list[Message]]:
    """Split the transcript into overlapping chunks. Each chunk
    carries up to ``max_chars`` characters; consecutive chunks
    share the LAST two messages of the previous chunk so the
    model sees enough context to keep the analysis coherent.
    """
    if not messages:
        return []
    chunks: list[list[Message]] = []
    buffer: list[Message] = []
    buffer_size = 0
    for msg in messages:
        msg_size = len(msg.content) + len(msg.role) + 4
        if buffer_size + msg_size > max_chars and buffer:
            chunks.append(buffer)
            overlap = buffer[-2:]
            buffer = list(overlap)
            buffer_size = sum(len(m.content) + len(m.role) + 4 for m in overlap)
        buffer.append(msg)
        buffer_size += msg_size
    if buffer:
        chunks.append(buffer)
    return chunks


def _clamp_method(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    lc = value.strip().lower().replace(" ", "_").replace("-", "_")
    return lc if lc in VALID_METHODS else None


def _clamp_level(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    lc = value.strip().lower()
    return lc if lc in VALID_LEVELS else None


def _as_string_array(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None
    out = [v.strip() for v in value if isinstance(v, str) and v.strip()]
    return out or None


def _as_lesson_array(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    out: list[dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        title = entry.get("title")
        description = entry.get("description")
        title_s = title.strip() if isinstance(title, str) else ""
        desc_s = description.strip() if isinstance(description, str) else ""
        if not title_s:
            continue
        priority = 3
        raw_p = entry.get("priority")
        if isinstance(raw_p, (int, float)) and not isinstance(raw_p, bool):
            priority = max(1, min(5, int(raw_p)))
        out.append({"title": title_s, "description": desc_s, "priority": priority})
    return out or None


def parse_analysis_response(raw: str | None) -> dict[str, Any] | None:
    """Strip fences + extract a balanced ``{...}`` block, then
    project it onto the analysis schema. Returns ``None`` on any
    structural problem."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    obj = extract_json_object(raw)
    if obj is None:
        return None
    result: dict[str, Any] = {}
    topic = obj.get("topic")
    if isinstance(topic, str) and topic.strip():
        result["topic"] = topic.strip()
    subtopics = _as_string_array(obj.get("subtopics"))
    if subtopics is not None:
        result["subtopics"] = subtopics
    level = _clamp_level(obj.get("user_level"))
    if level:
        result["user_level"] = level
    strengths = _as_string_array(obj.get("strengths"))
    if strengths is not None:
        result["strengths"] = strengths
    weaknesses = _as_string_array(obj.get("weaknesses"))
    if weaknesses is not None:
        result["weaknesses"] = weaknesses
    errors = _as_string_array(obj.get("error_patterns"))
    if errors is not None:
        result["error_patterns"] = errors
    method = _clamp_method(obj.get("recommended_method"))
    if method:
        result["recommended_method"] = method
    focus = obj.get("recommended_focus")
    if isinstance(focus, str) and focus.strip():
        result["recommended_focus"] = focus.strip()
    lessons = _as_lesson_array(obj.get("suggested_curriculum"))
    if lessons is not None:
        result["suggested_curriculum"] = lessons
    summary = obj.get("summary")
    if isinstance(summary, str) and summary.strip():
        result["summary"] = summary.strip()
    return result


def deterministic_fallback(title: str | None = None) -> dict[str, Any]:
    """Empty analysis with ``fallback_used: True``. The UI surfaces
    a "we couldn't parse the response" hint when this is returned
    so the user knows to retry or pick a different provider."""
    return {
        "topic": (title or "Unrecognised topic").strip() or "Unrecognised topic",
        "summary": (
            "The AI response could not be parsed into structured analysis. "
            "You can re-run the analysis, or pick a different AI provider."
        ),
        "fallback_used": True,
    }


def _merge_strings(a: list[str] | None, b: list[str] | None) -> list[str] | None:
    items = (a or []) + (b or [])
    if not items:
        return None
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.lower().strip()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _merge_lessons(
    a: list[dict[str, Any]] | None, b: list[dict[str, Any]] | None
) -> list[dict[str, Any]] | None:
    items = (a or []) + (b or [])
    if not items:
        return None
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        title = item.get("title", "")
        key = title.lower().strip() if isinstance(title, str) else ""
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out


_LEVEL_ORDER = ("beginner", "intermediate", "advanced")


def merge_analyses(base: dict[str, Any], nxt: dict[str, Any]) -> dict[str, Any]:
    """Fold two analyses field-by-field. Strings keep the first
    non-empty value; user_level keeps the highest seen; arrays
    concat + dedupe; recommended_method keeps the first seen."""
    out: dict[str, Any] = dict(base)
    if not out.get("topic") and nxt.get("topic"):
        out["topic"] = nxt["topic"]
    if not out.get("summary") and nxt.get("summary"):
        out["summary"] = nxt["summary"]
    if not out.get("recommended_focus") and nxt.get("recommended_focus"):
        out["recommended_focus"] = nxt["recommended_focus"]
    if not out.get("recommended_method") and nxt.get("recommended_method"):
        out["recommended_method"] = nxt["recommended_method"]
    nxt_level = nxt.get("user_level")
    if nxt_level in _LEVEL_ORDER:
        current_level = out.get("user_level")
        current_idx = _LEVEL_ORDER.index(current_level) if current_level in _LEVEL_ORDER else -1
        incoming_idx = _LEVEL_ORDER.index(nxt_level)
        if incoming_idx > current_idx:
            out["user_level"] = nxt_level
    out["subtopics"] = _merge_strings(out.get("subtopics"), nxt.get("subtopics"))
    out["strengths"] = _merge_strings(out.get("strengths"), nxt.get("strengths"))
    out["weaknesses"] = _merge_strings(out.get("weaknesses"), nxt.get("weaknesses"))
    out["error_patterns"] = _merge_strings(out.get("error_patterns"), nxt.get("error_patterns"))
    out["suggested_curriculum"] = _merge_lessons(
        out.get("suggested_curriculum"), nxt.get("suggested_curriculum")
    )
    # Drop merged-None entries so the wire shape stays clean.
    return {k: v for k, v in out.items() if v is not None}


def analyze_conversation_with_ai(
    messages: list[Message],
    *,
    ai_complete_call: Any,
    title: str | None = None,
    max_chunk_chars: int = MAX_CHUNK_CHARS,
    max_tokens: int = 1500,  # noqa: ARG001 — reserved for callers that wrap the hook directly
    lang: str = "en",
    source_language: str | None = None,
    target_language: str | None = None,
) -> dict[str, Any]:
    """End-to-end analysis. Splits the transcript if necessary,
    fires one ``ai_complete_call`` per chunk, merges the results.

    ``ai_complete_call`` is a callable
    ``(messages: list[dict]) -> str | None`` so the engine doesn't
    care whether the caller fires the hook directly, wraps it in
    an async-to-sync bridge, or stubs it for tests. ``None`` (or
    any provider exception bubbled up) collapses the chunk to the
    deterministic fallback so callers never see a half-broken
    result.

    ``lang`` is the user's preferred display language (ISO-639-1).
    The system prompt's free-text directive is localised to that
    language; the JSON schema and enum identifiers stay English.
    """
    system_prompt = build_system_prompt(lang, source_language, target_language)
    chunks = chunk_messages(messages, max_chunk_chars)
    if not chunks:
        return deterministic_fallback(title)
    chunk_results: list[dict[str, Any]] = []
    for chunk in chunks:
        user_content = build_analysis_user_content(chunk, title)
        try:
            raw = ai_complete_call(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ]
            )
        except Exception as exc:  # noqa: BLE001 — provider errors must not crash analyze
            fb = deterministic_fallback(title)
            fb["summary"] = f"{fb['summary']} (provider: {exc})"
            chunk_results.append(fb)
            continue
        parsed = parse_analysis_response(raw) if isinstance(raw, str) else None
        chunk_results.append(parsed if parsed is not None else deterministic_fallback(title))
    merged = chunk_results[0]
    for nxt in chunk_results[1:]:
        merged = merge_analyses(merged, nxt)
    if len(chunks) > 1:
        merged["chunk_summaries"] = [
            (f"Chunk {idx + 1}: {r['summary']}" if r.get("summary") else f"Chunk {idx + 1}")
            for idx, r in enumerate(chunk_results)
        ]
    return merged


__all__ = [
    "LANGUAGE_NAMES",
    "MAX_CHUNK_CHARS",
    "Message",
    "SYSTEM_PROMPT",
    "VALID_LEVELS",
    "VALID_METHODS",
    "analyze_conversation_with_ai",
    "build_analysis_user_content",
    "build_system_prompt",
    "chunk_messages",
    "deterministic_fallback",
    "merge_analyses",
    "parse_analysis_response",
]
