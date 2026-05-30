"""AI content-validation prompt + parsing (Phase 60 / v1.44.0, C5b).

Server-side mirror of
``frontend/src/lib/content/ai-content-validator.ts``: builds the
same structured prompt and parses the same JSON result shape, so
API-mode and Dexie-mode AI reviews agree. The route in
``app.routers.content`` resolves the user's AI key server-side and
fires the ``ai_complete`` hook with these messages.
"""

from __future__ import annotations

import json
from typing import Any

from app.services.extract_json import extract_json_object


def build_validation_messages(
    *,
    target_language: str,
    source_language: str,
    level: str,
    lessons: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Build the (system, user) messages for an AI content review."""
    system = "\n".join(
        [
            "You are a meticulous language-learning content reviewer.",
            f"The learner SPEAKS {source_language} and is LEARNING "
            f"{target_language} at level {level}.",
            "Card 'front' is in the target language; card 'back' + notes "
            "+ theory are in the source language.",
            "Review the lesson(s) for:",
            "- translation accuracy (does each front/back pair match?)",
            "- distractor quality (plausible but clearly wrong, not random?)",
            "- grammar accuracy in the theory/explanations (source language)",
            "- level appropriateness (vocabulary + grammar fit the level?)",
            "- cultural sensitivity (flag anything offensive)",
            "- natural language (not word-for-word/machine-translated)",
            "",
            "Respond with ONLY a JSON object, no prose, in EXACTLY this shape:",
            "{",
            '  "overall": "pass" | "review_needed",',
            '  "translation_issues": [{"card_id": "...", "issue": "...", "suggestion": "..."}],',
            '  "distractor_issues": [{"exercise_id": "...", "issue": "...", "suggestion": "..."}],',
            '  "grammar_issues": [{"step_id": "...", "issue": "...", "correction": "..."}],',
            '  "level_issues": [{"item": "...", "issue": "...", "suggestion": "..."}],',
            '  "cultural_flags": ["..."],',
            '  "quality_score": 0.0',
            "}",
            "quality_score is 0.0-1.0. Use empty arrays when there are no issues.",
            "Write 'issue'/'suggestion'/'correction' text in the source language.",
        ]
    )

    payload = {
        "target_language": target_language,
        "source_language": source_language,
        "level": level,
        "lessons": [
            {
                "id": lesson.get("id"),
                "cards": [
                    {
                        "id": card.get("id"),
                        "front": card.get("front"),
                        "back": card.get("back"),
                        "notes": card.get("notes"),
                    }
                    for card in lesson.get("cards", [])
                ],
                "steps": [
                    {
                        "id": step.get("id"),
                        "type": step.get("type"),
                        "body": step.get("body"),
                        "exercise": (
                            {
                                "id": (step.get("exercise") or {}).get("id"),
                                "type": (step.get("exercise") or {}).get("type"),
                                "prompt": (step.get("exercise") or {}).get("prompt"),
                                "distractors": (step.get("exercise") or {}).get(
                                    "distractors"
                                ),
                            }
                            if step.get("exercise")
                            else None
                        ),
                    }
                    for step in lesson.get("steps", [])
                ],
            }
            for lesson in lessons
        ],
    }
    user = "Validate this lesson set:\n" + json.dumps(payload, ensure_ascii=False)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _issues(value: Any, keys: list[str]) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for row in value:
        if not isinstance(row, dict):
            continue
        item = {k: (row[k] if isinstance(row.get(k), str) else "") for k in keys}
        if any(item.values()):
            out.append(item)
    return out


def parse_validation_result(raw: str) -> dict[str, Any] | None:
    """Parse a raw AI response into the normalised result, or None
    when no usable JSON object is present."""
    obj = extract_json_object(raw)
    if obj is None:
        return None
    translation = _issues(obj.get("translation_issues"), ["card_id", "issue", "suggestion"])
    distractor = _issues(obj.get("distractor_issues"), ["exercise_id", "issue", "suggestion"])
    grammar = _issues(obj.get("grammar_issues"), ["step_id", "issue", "correction"])
    level = _issues(obj.get("level_issues"), ["item", "issue", "suggestion"])
    cultural = [x for x in (obj.get("cultural_flags") or []) if isinstance(x, str)]
    has_issues = bool(translation or distractor or grammar or level or cultural)
    overall = obj.get("overall")
    if overall not in ("pass", "review_needed"):
        overall = "review_needed" if has_issues else "pass"
    score = obj.get("quality_score")
    score = float(score) if isinstance(score, (int, float)) else 0.0
    score = max(0.0, min(1.0, score))
    return {
        "overall": overall,
        "translation_issues": translation,
        "distractor_issues": distractor,
        "grammar_issues": grammar,
        "level_issues": level,
        "cultural_flags": cultural,
        "quality_score": score,
    }
