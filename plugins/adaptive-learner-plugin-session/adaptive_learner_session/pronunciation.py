"""Pronunciation practice service (Phase 31C / v1.18.0).

Two pieces:

  1. **Phrase generator**: a tiny AI call that returns a target
     phrase for the user to pronounce. Parameterised by the
     project's language and a difficulty hint (beginner /
     intermediate). Pure-function helpers + a thin ai-caller
     wrapper so the unit tests can exercise the parser
     without firing a real provider.

  2. **Judge**: compares the user's transcribed text with the
     target phrase. Same shape as the step-evaluator
     (`{matches, score, feedback, missed_sounds}`). The AI
     call is small (~150 token budget) — cheap enough to run
     on every attempt.

The route layer in ``routes.py`` resolves the user's active
provider / api_key / model and injects an ``ai_call`` callable
matching the ``[messages] -> str | None`` signature already used
by the imports + anki extractors.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Type alias for the injected AI caller. Mirrors the shape used
# by ``adaptive_learner_anki.card_extraction`` and
# ``routers.imports._build_ai_caller``: a callable that takes a
# list of ``{role, content}`` messages and returns the model's
# completion string (or ``None`` on hook miss).
AICallable = Callable[[list[dict[str, str]]], str | None]


# ---------------------------------------------------------------------------
# Prompt: phrase generator
# ---------------------------------------------------------------------------

PHRASE_PROMPT = """You are a pronunciation coach. Generate ONE short phrase in {language} for the learner to practice pronouncing aloud.

Rules:
- {level} difficulty.
- 3 to 10 words.
- Use common, conversational vocabulary that highlights {focus}.
- Output JSON ONLY: {{"phrase": "..."}} — no prose, no markdown.

{previous_clause}"""


def _level_label(level: str) -> str:
    return {
        "beginner": "Beginner",
        "intermediate": "Intermediate",
        "advanced": "Advanced",
    }.get(level.lower(), "Beginner")


def build_phrase_prompt(
    *,
    language: str,
    level: str = "beginner",
    focus: str = "common sounds",
    previous: list[str] | None = None,
) -> str:
    """Render the phrase-generator prompt.

    ``previous`` is an optional list of phrases the user just
    practised — the model is asked to avoid repeating them.
    Truncated to the last 5 entries to keep the prompt tight.
    """
    previous_clause = ""
    if previous:
        recent = previous[-5:]
        previous_clause = (
            "Avoid these phrases the learner just practised: "
            + "; ".join(recent)
        )
    return PHRASE_PROMPT.format(
        language=language,
        level=_level_label(level),
        focus=focus,
        previous_clause=previous_clause,
    )


def parse_phrase_response(raw: str) -> str | None:
    """Tolerantly parse the JSON ``{"phrase": "..."}`` shape.

    Strips ``json`` fences, falls back to ``None`` on parse
    failure (the route translates that to a 502 to the
    frontend). Empty / whitespace phrases also return ``None``.
    """
    if not raw:
        return None
    stripped = raw.strip()
    fence_match = re.match(
        r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL
    )
    if fence_match:
        stripped = fence_match.group(1).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        logger.warning(
            "Pronunciation phrase: response not JSON. raw=%r",
            stripped[:200],
        )
        return None
    if not isinstance(data, dict):
        return None
    phrase = str(data.get("phrase") or "").strip()
    return phrase or None


def generate_phrase(
    ai_call: AICallable,
    *,
    language: str,
    level: str = "beginner",
    focus: str = "common sounds",
    previous: list[str] | None = None,
) -> str | None:
    """High-level wrapper: build prompt + fire AI + parse."""
    prompt = build_phrase_prompt(
        language=language, level=level, focus=focus, previous=previous
    )
    try:
        raw = ai_call([{"role": "user", "content": prompt}])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Pronunciation phrase: AI call failed for %r.", language
        )
        return None
    return parse_phrase_response(raw or "")


# ---------------------------------------------------------------------------
# Prompt + parser: judge
# ---------------------------------------------------------------------------

JUDGE_PROMPT = """You are a pronunciation coach scoring one attempt.

Target phrase (in {language}): {target}
What the learner said (auto-transcribed; may have STT errors): {actual}

Return strict JSON only — no prose, no markdown fences:
{{
  "matches": true,        // overall correctness boolean
  "score": 0.85,          // 0.0..1.0 similarity score
  "feedback": "Short tip (1 sentence).",
  "missed_sounds": ["h", "r"]  // phonetic markers the learner stumbled on; [] if perfect
}}

Score guidance: 1.0 = identical, 0.9 = minor differences, 0.7 = recognisable, 0.5 = several errors, 0.3 = barely. matches=true iff score >= 0.7.

Be kind. The transcription may add noise — judge by ear, not by exact text."""


@dataclass
class JudgeVerdict:
    """One pronunciation-attempt verdict."""

    matches: bool
    score: float
    feedback: str
    missed_sounds: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "matches": self.matches,
            "score": self.score,
            "feedback": self.feedback,
            "missed_sounds": list(self.missed_sounds),
        }


def build_judge_prompt(*, target: str, actual: str, language: str) -> str:
    return JUDGE_PROMPT.format(
        target=target, actual=actual, language=language
    )


def parse_judge_response(raw: str) -> JudgeVerdict | None:
    """Parse the structured judge JSON. Tolerant on malformed
    output — returns ``None`` so the route can translate to a
    503 and let the frontend toast a graceful failure."""
    if not raw:
        return None
    stripped = raw.strip()
    fence_match = re.match(
        r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL
    )
    if fence_match:
        stripped = fence_match.group(1).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        logger.warning(
            "Pronunciation judge: response not JSON. raw=%r",
            stripped[:200],
        )
        return None
    if not isinstance(data, dict):
        return None

    try:
        score_raw = data.get("score", 0)
        score = float(score_raw) if score_raw is not None else 0.0
    except (TypeError, ValueError):
        score = 0.0
    score = max(0.0, min(1.0, score))

    # ``matches`` falls back to score-derived if the field is
    # missing or non-boolean (some models return "true"/"false"
    # as strings).
    matches_raw = data.get("matches")
    if isinstance(matches_raw, bool):
        matches = matches_raw
    elif isinstance(matches_raw, str):
        matches = matches_raw.strip().lower() in ("true", "yes", "1")
    else:
        matches = score >= 0.7

    feedback = str(data.get("feedback") or "").strip()

    missed_raw = data.get("missed_sounds") or []
    if not isinstance(missed_raw, list):
        missed_raw = []
    missed = [str(m).strip() for m in missed_raw if m]

    return JudgeVerdict(
        matches=matches,
        score=score,
        feedback=feedback,
        missed_sounds=missed,
    )


def judge_attempt(
    ai_call: AICallable,
    *,
    target: str,
    actual: str,
    language: str,
) -> JudgeVerdict | None:
    """High-level wrapper: build prompt + fire AI + parse."""
    if not target.strip() or not actual.strip():
        return None
    prompt = build_judge_prompt(
        target=target, actual=actual, language=language
    )
    try:
        raw = ai_call([{"role": "user", "content": prompt}])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Pronunciation judge: AI call failed (target=%r, actual=%r).",
            target,
            actual,
        )
        return None
    return parse_judge_response(raw or "")
