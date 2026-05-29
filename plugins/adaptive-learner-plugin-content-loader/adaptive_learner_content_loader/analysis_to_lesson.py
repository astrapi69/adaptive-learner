"""Analysis-to-lesson generator (Phase 59A / v1.42.0).

Python mirror of ``frontend/src/lib/content/analysis-to-lesson.ts`` for
API mode. Turns a chat-import analysis blob (the
``ConversationAnalysisResult`` JSON) into a validated content-loader
``Lesson``. Deterministic + offline: the same analysis always yields
the same lesson (no randomness, no clock). Building the Pydantic
``Lesson`` IS the schema validation -- a malformed mapping raises
``ValidationError`` before the lesson is returned.

The mapping is driven by what the analysis ACTUALLY contains (audited
against the frontend ``ConversationAnalysisResult`` -- the spec's
``key_concepts`` / ``rules_learned`` fields do not exist):

  Theory:   topic + summary (+ recommended_focus); suggested_curriculum;
            subtopics; strengths; weaknesses; error_patterns.
  Exercises (from ``vocabulary[]``): matching + free_text from
            word/translation; cloze + word_tiles from the example
            sentence when present.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from .schema import (
    Card,
    ClozeBlank,
    Exercise,
    ExerciseType,
    Lesson,
    LessonStep,
    StepType,
)

_TYPE_RANK = {"matching": 0, "free_text": 1, "cloze": 2, "word_tiles": 3}


@dataclass(frozen=True)
class AnalysisLessonLabels:
    """Pre-localised strings. ``{word}`` in a prompt template is
    replaced with the vocabulary word."""

    fallback_title: str = "Imported lesson"
    focus_label: str = "Focus"
    topics_title: str = "Topics"
    strengths_title: str = "What you already know"
    weaknesses_title: str = "What we'll work on"
    error_patterns_title: str = "Common mistakes"
    matching_prompt: str = "Match each word with its translation."
    free_text_prompt: str = "Translate: {word}"
    cloze_prompt: str = "Fill in the missing word."
    word_tiles_prompt: str = "Arrange the words into the sentence ({word})."


@dataclass(frozen=True)
class AnalysisLessonConfig:
    matching_group_size: int = 4
    max_exercises: int = 12
    min_vocab_for_exercises: int = 4


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def slugify(text: str) -> str:
    """Reduce arbitrary text to a slug-safe token matching the schema's
    ``^[a-z0-9]+(-[a-z0-9]+)*$``. Returns "" when nothing survives."""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")[:80]


def _clamp(text: str, max_len: int) -> str:
    return text[:max_len]


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item.strip()}" for item in items)


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if isinstance(v, str) and v.strip()]


# ---------------------------------------------------------------------------
# Vocabulary -> cards
# ---------------------------------------------------------------------------


def _valid_vocabulary(analysis: dict[str, Any]) -> list[dict[str, Any]]:
    raw = analysis.get("vocabulary")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        word = str(entry.get("word", "")).strip()
        translation = str(entry.get("translation", "")).strip()
        if word and translation:
            out.append(entry)
    return out


def _vocab_card_id(index: int) -> str:
    return f"vocab-{index}"


def _build_cards(vocabulary: list[dict[str, Any]]) -> list[Card]:
    cards: list[Card] = []
    for i, entry in enumerate(vocabulary):
        example = entry.get("example")
        tags = [
            t for t in (slugify(str(x)) for x in (entry.get("tags") or [])) if t and len(t) <= 40
        ]
        cards.append(
            Card(
                id=_vocab_card_id(i),
                front=_clamp(str(entry["word"]).strip(), 500),
                back=_clamp(str(entry["translation"]).strip(), 500),
                notes=_clamp(str(example).strip(), 2000) if example else None,
                tags=_dedupe(tags)[:20],
            )
        )
    return cards


# ---------------------------------------------------------------------------
# Theory steps
# ---------------------------------------------------------------------------


def _overview_step(
    analysis: dict[str, Any], title: str, labels: AnalysisLessonLabels
) -> LessonStep:
    parts = [f"# {title}"]
    summary = analysis.get("summary")
    if summary:
        parts.append(str(summary).strip())
    focus = analysis.get("recommended_focus")
    if focus:
        parts.append(f"**{labels.focus_label}:** {str(focus).strip()}")
    return LessonStep(
        id="theory-overview",
        type=StepType.THEORY,
        title=title,
        body="\n\n".join(parts),
    )


def _study_plan_steps(analysis: dict[str, Any]) -> list[LessonStep]:
    plan = analysis.get("suggested_curriculum")
    if not isinstance(plan, list):
        return []
    steps: list[LessonStep] = []
    for i, entry in enumerate(plan):
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title", "")).strip()
        if not title:
            continue
        description = str(entry.get("description", "")).strip()
        steps.append(
            LessonStep(
                id=f"theory-plan-{i}",
                type=StepType.THEORY,
                title=_clamp(title, 200),
                body=description or f"# {_clamp(title, 180)}",
            )
        )
    return steps


def _list_step(step_id: str, title: str, items: list[str]) -> LessonStep | None:
    if not items:
        return None
    return LessonStep(
        id=step_id,
        type=StepType.THEORY,
        title=title,
        body=f"## {title}\n\n{_bullets(items)}",
    )


def _build_theory_steps(
    analysis: dict[str, Any], title: str, labels: AnalysisLessonLabels
) -> list[LessonStep]:
    steps: list[LessonStep] = [_overview_step(analysis, title, labels)]
    steps.extend(_study_plan_steps(analysis))
    for step in (
        _list_step("theory-topics", labels.topics_title, _string_list(analysis.get("subtopics"))),
        _list_step(
            "theory-strengths", labels.strengths_title, _string_list(analysis.get("strengths"))
        ),
        _list_step(
            "theory-weaknesses", labels.weaknesses_title, _string_list(analysis.get("weaknesses"))
        ),
        _list_step(
            "theory-errors",
            labels.error_patterns_title,
            _string_list(analysis.get("error_patterns")),
        ),
    ):
        if step is not None:
            steps.append(step)
    return steps


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------


def _accept_variants(translation: str) -> list[str]:
    trimmed = translation.strip()
    return _dedupe([v for v in (trimmed, trimmed.lower()) if v])


def _matching_exercises(
    vocabulary: list[dict[str, Any]], group_size: int, prompt: str
) -> list[Exercise]:
    out: list[Exercise] = []
    for start in range(0, len(vocabulary), group_size):
        chunk = vocabulary[start : start + group_size]
        if len(chunk) < 2:
            break
        out.append(
            Exercise(
                id=f"ex-match-{len(out)}",
                type=ExerciseType.MATCHING,
                prompt=_clamp(prompt, 1000),
                card_ids=[_vocab_card_id(start + i) for i in range(len(chunk))],
                pairs=[
                    {"left": str(e["word"]).strip(), "right": str(e["translation"]).strip()}
                    for e in chunk
                ],
                distractors=[],
            )
        )
    return out


def _free_text_exercises(vocabulary: list[dict[str, Any]], prompt_template: str) -> list[Exercise]:
    out: list[Exercise] = []
    for i, entry in enumerate(vocabulary):
        word = str(entry["word"]).strip()
        out.append(
            Exercise(
                id=f"ex-free-{i}",
                type=ExerciseType.FREE_TEXT,
                prompt=_clamp(prompt_template.replace("{word}", word), 1000),
                card_ids=[_vocab_card_id(i)],
                accept=_accept_variants(str(entry["translation"])),
                distractors=[],
            )
        )
    return out


def _blank_example(example: str, word: str) -> str | None:
    trimmed = example.strip()
    target = word.strip()
    if not trimmed or not target:
        return None
    first = trimmed.find(target)
    if first == -1:
        return None
    if trimmed.find(target, first + len(target)) != -1:
        return None
    return trimmed[:first] + "___" + trimmed[first + len(target) :]


def _cloze_exercises(vocabulary: list[dict[str, Any]], prompt: str) -> list[Exercise]:
    out: list[Exercise] = []
    for i, entry in enumerate(vocabulary):
        example = entry.get("example")
        if not example:
            continue
        sentence = _blank_example(str(example), str(entry["word"]))
        if sentence is None:
            continue
        out.append(
            Exercise(
                id=f"ex-cloze-{i}",
                type=ExerciseType.CLOZE,
                prompt=prompt,
                card_ids=[_vocab_card_id(i)],
                sentence=sentence,
                blanks=[ClozeBlank(accept=_accept_variants(str(entry["word"])))],
                cloze_mode="type",
                distractors=[],
            )
        )
    return out


def _word_tiles_exercises(vocabulary: list[dict[str, Any]], prompt_template: str) -> list[Exercise]:
    out: list[Exercise] = []
    for i, entry in enumerate(vocabulary):
        example = entry.get("example")
        if not example:
            continue
        tiles = [t for t in str(example).strip().split() if t]
        if len(tiles) < 2:
            continue
        word = str(entry["word"]).strip()
        out.append(
            Exercise(
                id=f"ex-tiles-{i}",
                type=ExerciseType.WORD_TILES,
                prompt=_clamp(prompt_template.replace("{word}", word), 1000),
                card_ids=[_vocab_card_id(i)],
                tiles=tiles,
                distractors=[],
            )
        )
    return out


def _select_exercises(buckets: list[list[Exercise]], max_count: int) -> list[Exercise]:
    """Round-robin across buckets (keeps type variety under the cap),
    then order easy -> hard for a difficulty progression."""
    selected: list[Exercise] = []
    round_index = 0
    drained = False
    while len(selected) < max_count and not drained:
        drained = True
        for bucket in buckets:
            if len(selected) >= max_count:
                break
            if round_index < len(bucket):
                selected.append(bucket[round_index])
                drained = False
        round_index += 1
    selected.sort(key=lambda ex: (_TYPE_RANK.get(ex.type.value, 9), ex.id))
    return selected


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------


def _lesson_id(analysis: dict[str, Any], override: str | None) -> str:
    if override:
        slug = slugify(override)
        if slug:
            return slug
    topic_slug = slugify(str(analysis.get("topic") or ""))
    return f"analysis-{topic_slug}" if topic_slug else "analysis-lesson"


def _estimate_minutes(theory: int, exercises: int) -> int:
    return max(1, round(theory + exercises * 1.5))


def generate_lesson_from_analysis(
    analysis: dict[str, Any],
    *,
    lesson_id: str | None = None,
    labels: AnalysisLessonLabels | None = None,
    config: AnalysisLessonConfig | None = None,
) -> Lesson:
    """Generate a schema-validated offline lesson from a chat analysis.

    Deterministic: same analysis + args -> identical lesson. Returns a
    Pydantic ``Lesson`` (constructing it validates against the schema).
    """
    labels = labels or AnalysisLessonLabels()
    config = config or AnalysisLessonConfig()
    vocabulary = _valid_vocabulary(analysis)
    title = _clamp((str(analysis.get("topic") or "").strip() or labels.fallback_title), 200)

    cards = _build_cards(vocabulary)
    theory_steps = _build_theory_steps(analysis, title, labels)

    exercise_steps: list[LessonStep] = []
    if len(vocabulary) >= config.min_vocab_for_exercises:
        buckets = [
            _matching_exercises(vocabulary, config.matching_group_size, labels.matching_prompt),
            _free_text_exercises(vocabulary, labels.free_text_prompt),
            _cloze_exercises(vocabulary, labels.cloze_prompt),
            _word_tiles_exercises(vocabulary, labels.word_tiles_prompt),
        ]
        for i, exercise in enumerate(_select_exercises(buckets, config.max_exercises)):
            exercise_steps.append(
                LessonStep(
                    id=f"step-ex-{i}-{exercise.id}",
                    type=StepType.EXERCISE,
                    exercise=exercise,
                )
            )

    steps = [*theory_steps, *exercise_steps]
    summary = analysis.get("summary")
    focus = analysis.get("recommended_focus")
    description = None
    if summary:
        description = _clamp(str(summary).strip(), 500)
    elif focus:
        description = _clamp(str(focus).strip(), 500)

    return Lesson(
        id=_lesson_id(analysis, lesson_id),
        title=title,
        description=description,
        estimated_minutes=_estimate_minutes(len(theory_steps), len(exercise_steps)),
        cards=cards,
        steps=steps,
    )


def summarize_generated_lesson(lesson: Lesson) -> dict[str, Any]:
    """Counts for a preview UI / parity assertions."""
    type_counts: dict[str, int] = {}
    exercises = 0
    theory = 0
    for step in lesson.steps:
        if step.type is StepType.THEORY:
            theory += 1
        elif step.exercise is not None:
            exercises += 1
            key = step.exercise.type.value
            type_counts[key] = type_counts.get(key, 0) + 1
    return {
        "theory_steps": theory,
        "exercises": exercises,
        "exercise_type_counts": type_counts,
        "estimated_minutes": lesson.estimated_minutes,
        "vocabulary_count": len(lesson.cards),
        "theory_only": exercises == 0,
    }
