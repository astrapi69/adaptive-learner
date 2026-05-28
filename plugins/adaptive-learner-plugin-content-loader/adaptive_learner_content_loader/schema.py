"""Lesson schema v1.0 (Phase 43 / EXP-002 / 2B-lesson — P-102).

A Lesson is the unit a user works through end-to-end. Each
lesson belongs to a ContentSet and is a sequence of steps:
theory blocks (Markdown) interleaved with exercises. The
viewer (Phase 44) renders these step-by-step; the renderer
does NOT live here — these are pure data shapes the
Content-Loader validates on download.

Design choices, set explicitly so future phases can extend
the schema without churn:

- ``Lesson`` is opaque to the loader: it stores the JSON
  exactly as the content author wrote it. Validation
  happens once at download time (so corrupt content gets
  caught early); after that the cache surfaces the validated
  payload to the viewer.

- ``ExerciseType`` is a closed enum. The four Phase 44/45
  types ship now (matching / picture_choice / free_text /
  word_tiles); EXP-006 exercise types extend the enum later
  with a minor schema_version bump.

- ``Card`` is the smallest learnable unit. SRS integration
  (Phase 46) tracks cards individually; a missed exercise
  schedules the underlying card for review, not the lesson.
  Cards CAN be referenced by id from multiple exercises in
  the same lesson (so 'Bonjour' as the term-of-the-week
  shows up in the matching exercise AND the free-text drill
  AND the summary).

- Distractor pool lives on each ``Exercise`` (not on the
  ``Card``). EXP-005 / P-114 dual-mode: when AI is
  unavailable, the loader picks distractors from this pool;
  when AI is available, the AI generator may use the pool
  as a seed. The decision is made by the exercise renderer,
  not by the schema.

- Markdown is rendered by the existing react-markdown
  pipeline (same as the help system). No new dependency.

The lesson schema export is the SECOND half of P-103. The
first half (manifest + set) shipped in commit 2.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Slug-safe identifier — same shape as ContentSet.id /
# ContentSet.tags. Used for lesson_id, card_id, step ids.
_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class ExerciseType(str, Enum):
    """Closed enum of exercise types the loader knows about.

    EXP-001 + EXP-006: the four base types ship in Phase 43-45.
    Phase 52D / v1.35.0 added CLOZE (fill-in-the-blank with
    ``___`` markers) — see the schema_version bump in
    ``models.py``. Adding a sixth type (ordering, drag-image-
    pair, etc.) requires a minor schema_version bump and a new
    enum value plus its renderer.
    """

    MATCHING = "matching"
    PICTURE_CHOICE = "picture_choice"
    FREE_TEXT = "free_text"
    WORD_TILES = "word_tiles"
    CLOZE = "cloze"


class StepType(str, Enum):
    """Closed enum for top-level step kinds.

    THEORY = Markdown content step. EXERCISE = one of the
    ExerciseType variants. The viewer (Phase 44) branches
    on this; no other step kinds are valid in v1.0.
    """

    THEORY = "theory"
    EXERCISE = "exercise"


class TokenRole(str, Enum):
    """Closed enum of grammatical roles a card token can carry.

    Phase 52I / v1.35.0 / P-130. Annotates individual tokens
    inside a card's ``front`` so the v1.35.0+ cloze generator
    can pick a semantically-meaningful blank instead of a
    position-based one. Optional field on Card — old content
    without token_roles still validates and the generator
    falls back to a positional heuristic.

    Closed enum to keep author input disciplined. Adding a
    role (e.g. ``pronoun``, ``conjunction``, ``auxiliary``)
    is a minor schema_version bump — extending an open enum
    silently would let typos masquerade as valid roles and
    the generator would skip them without warning.
    """

    ARTICLE = "article"
    VERB = "verb"
    NOUN = "noun"
    ADJECTIVE = "adjective"
    PREPOSITION = "preposition"
    GENDER_MARKER = "gender_marker"
    TENSE_MARKER = "tense_marker"


class CardTokenRole(BaseModel):
    """One ``token → role`` annotation on a card.

    Phase 52I / v1.35.0 / P-130. The cloze generator looks up
    its target blank by matching ``token`` against the
    ``ElementError.element_key`` — when a role is present, the
    generator can pick a same-role distractor pool instead of
    a position-based heuristic.

    The ``token`` is a verbatim slice of the card's ``front``;
    no whitespace normalisation, so authors can annotate even
    sub-word morphemes (an accent-bearing letter, an article
    contraction) if a future generator needs it.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    token: str = Field(
        ...,
        description=(
            "Verbatim slice of the card's ``front``. The "
            "generator matches this against the wrong-answer "
            "key recorded by the SRS layer."
        ),
        min_length=1,
        max_length=120,
    )
    role: TokenRole = Field(
        ...,
        description="Grammatical role of this token in the card.",
    )


class ClozeBlank(BaseModel):
    """One blank inside a cloze exercise's ``sentence`` (Phase 52D /
    v1.35.0 / P-127).

    Marker-based convention: the sentence carries visible ``___``
    tokens; ``blanks[i]`` provides the metadata for the i-th
    marker (left-to-right). The validator enforces
    ``sentence.count("___") == len(blanks)`` so the i↔i mapping
    is unambiguous at render time.

    ``accept`` carries the per-blank canonical + acceptable
    variants — the renderer reuses FreeText's ``isFreeTextCorrect``
    matcher (NFC-normalised + Levenshtein <= 1) so authors only
    need to enumerate semantic variants (gendered article,
    capitalisation, et cetera), not typos.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    accept: list[str] = Field(
        ...,
        description=(
            "Accepted answers for this blank. First entry is the "
            "canonical (shown after a wrong attempt). Same shape "
            "as FREE_TEXT.accept."
        ),
        min_length=1,
    )
    hint: str | None = Field(
        default=None,
        description=(
            "Optional per-blank hint. Surfaced inline next to this specific blank, not lesson-wide."
        ),
        max_length=200,
    )
    placeholder: str | None = Field(
        default=None,
        description=(
            "Optional placeholder text shown inside the input "
            "(``type`` mode) before the user starts typing."
        ),
        max_length=40,
    )


class Card(BaseModel):
    """The smallest learnable unit (Phase 43 / 2B-lesson).

    A card carries a single term / concept / fact in a single
    direction. SRS (Phase 46) tracks one card at a time;
    individual exercises reference cards by id so a single
    'Bonjour = Hello' card can drive a matching exercise, a
    free-text drill, and a summary review without
    duplication.

    Convention: ``card.id`` is unique within the lesson, not
    globally. Cross-lesson card sharing happens via a
    separate ``shared/`` directory inside the set (P-111
    territory — not yet implemented).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(
        ...,
        description=(
            "Slug-safe id. Unique within the parent lesson. "
            "SRS reviews this id, not the surface term."
        ),
        min_length=1,
        max_length=120,
    )
    front: str = Field(
        ...,
        description=(
            "What the learner sees first. Typically the target-language term (e.g. 'Bonjour')."
        ),
        min_length=1,
        max_length=500,
    )
    back: str = Field(
        ...,
        description=(
            "What the learner is being TAUGHT to recall. "
            "Typically the translation / definition / answer "
            "(e.g. 'Hello')."
        ),
        min_length=1,
        max_length=500,
    )
    notes: str | None = Field(
        default=None,
        description=(
            "Optional Markdown footnote shown after the user "
            "answers. Pronunciation tips, etymology, false-"
            "friend warnings — anything that helps long-term "
            "retention."
        ),
        max_length=2000,
    )
    image: str | None = Field(
        default=None,
        description=(
            "Optional relative path inside the set's "
            "``assets/`` directory ('assets/img/bonjour.png'). "
            "Resolved by the asset loader."
        ),
    )
    audio: str | None = Field(
        default=None,
        description=(
            "Optional relative path inside ``assets/`` for "
            "TTS-recorded pronunciation. The voice plugin "
            "already supports playback (v1.18.0)."
        ),
    )
    tags: list[str] = Field(
        default_factory=list,
        description=("Slug-safe tags for SRS filtering ('greeting', 'verb-present', 'irregular')."),
        max_length=20,
    )
    token_roles: list[CardTokenRole] | None = Field(
        default=None,
        description=(
            "Phase 52I / v1.35.0 / P-130. Optional list of "
            "``{token, role}`` annotations on the card's "
            "``front``. The cloze generator (52E) uses these to "
            "pick a semantically-meaningful blank when "
            "available; absent annotations fall through to a "
            "position-based heuristic so old content keeps "
            "working unchanged."
        ),
        max_length=10,
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError(
                "Card id must be slug-safe "
                "(lowercase letters / digits / hyphens, "
                "no leading/trailing hyphen)"
            )
        return value

    @field_validator("tags")
    @classmethod
    def _slug_tags(cls, value: list[str]) -> list[str]:
        for tag in value:
            if not _SLUG_RE.fullmatch(tag):
                raise ValueError(f"tag '{tag}' must be slug-safe")
        return value


class Exercise(BaseModel):
    """One exercise step. Type-tagged via ``type``.

    The fields are kept in a single flat shape per
    ``type`` rather than per-type discriminated unions
    because the JSON manifests are author-edited; flat
    shapes are easier to read and to diff in PRs. The
    validator enforces type-specific requirements via
    model_validator instead.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(
        ...,
        description="Slug-safe id, unique within the lesson.",
        min_length=1,
        max_length=120,
    )
    type: ExerciseType = Field(
        ...,
        description="Which exercise renderer handles this step.",
    )
    prompt: str = Field(
        ...,
        description="The question text shown to the learner.",
        min_length=1,
        max_length=1000,
    )
    card_ids: list[str] = Field(
        default_factory=list,
        description=(
            "Cards this exercise drills. SRS feedback after a "
            "wrong answer schedules these cards for review."
        ),
        max_length=50,
    )

    # --- Type-specific fields. Validator below enforces
    # which fields are required per ``type``. Empty / null
    # for types that don't use them keeps the JSON files
    # consistent (no per-type field renaming).

    pairs: list[dict[str, str]] | None = Field(
        default=None,
        description=(
            "MATCHING: list of {left, right} dicts to pair up. "
            "Each dict has exactly two keys: 'left' and "
            "'right'. The renderer shuffles before display."
        ),
    )
    images: list[dict[str, str]] | None = Field(
        default=None,
        description=(
            "PICTURE_CHOICE: list of {src, label} dicts. "
            "Exactly one entry MUST also include "
            "'is_correct': 'true'. ``src`` is a relative path "
            "inside the set's ``assets/`` directory."
        ),
    )
    accept: list[str] | None = Field(
        default=None,
        description=(
            "FREE_TEXT: list of accepted answers. Exact-match "
            "first, Levenshtein-tolerant fallback in the "
            "renderer. The first entry is the canonical "
            "answer shown after a wrong attempt."
        ),
    )
    tiles: list[str] | None = Field(
        default=None,
        description=(
            "WORD_TILES: ordered list of tile labels. The "
            "renderer shuffles before display. Multiple "
            "correct orderings are configured via "
            "``accept_orderings`` below."
        ),
    )
    accept_orderings: list[list[int]] | None = Field(
        default=None,
        description=(
            "WORD_TILES: optional list of accepted tile-index "
            "orderings (each is a permutation of [0..len-1]). "
            "If omitted, only the canonical order in ``tiles`` "
            "is accepted."
        ),
    )
    distractors: list[str] = Field(
        default_factory=list,
        description=(
            "Content-only fallback distractors. The exercise "
            "renderer picks from this pool when no AI provider "
            "is configured (EXP-005 / P-114 dual mode). When "
            "AI is available, the AI generator may use the "
            "pool as a seed for harder distractors."
        ),
        max_length=20,
    )
    hint: str | None = Field(
        default=None,
        description=(
            "Optional Markdown hint shown on demand. The "
            "viewer renders this behind a 'Need a hint?' "
            "button."
        ),
        max_length=1000,
    )
    sentence: str | None = Field(
        default=None,
        description=(
            "CLOZE: the cloze sentence with visible ``___`` "
            "markers at each blank position. The renderer "
            "splits on the markers + interleaves the per-blank "
            "input control. Phase 52D / v1.35.0."
        ),
        max_length=1000,
    )
    blanks: list[ClozeBlank] | None = Field(
        default=None,
        description=(
            "CLOZE: per-marker metadata in left-to-right order. "
            "``len(blanks) == sentence.count('___')`` enforced "
            "at validation time. Phase 52D / v1.35.0."
        ),
    )
    cloze_mode: Literal["type", "select"] | None = Field(
        default=None,
        description=(
            "CLOZE: ``type`` renders an ``<input>`` per blank, "
            "``select`` renders a ``<select>`` per blank with "
            "options from ``distractors``. Defaults to "
            "``type`` when omitted on a CLOZE exercise. "
            "Phase 52D / v1.35.0."
        ),
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("Exercise id must be slug-safe")
        return value

    @field_validator("card_ids")
    @classmethod
    def _slug_card_ids(cls, value: list[str]) -> list[str]:
        for cid in value:
            if not _SLUG_RE.fullmatch(cid):
                raise ValueError(f"card_id '{cid}' must be slug-safe")
        return value

    @model_validator(mode="after")
    def _enforce_type_specific_fields(self) -> Exercise:
        """Each ExerciseType requires a specific field set.

        Wrong-field-for-type combos (e.g. a MATCHING exercise
        without ``pairs``) are rejected at schema validation
        time so the viewer can trust the data shape later.
        """
        type_ = self.type

        if type_ is ExerciseType.MATCHING:
            if not self.pairs:
                raise ValueError("MATCHING exercise requires non-empty 'pairs'")
            for pair in self.pairs:
                if set(pair.keys()) != {"left", "right"}:
                    raise ValueError("MATCHING pair must have exactly 'left' and 'right' keys")

        elif type_ is ExerciseType.PICTURE_CHOICE:
            if not self.images or len(self.images) < 2:
                raise ValueError("PICTURE_CHOICE requires at least 2 'images'")
            correct_count = sum(1 for img in self.images if img.get("is_correct") == "true")
            if correct_count != 1:
                raise ValueError(
                    "PICTURE_CHOICE must have exactly one image marked 'is_correct': 'true'"
                )
            for img in self.images:
                allowed = {"src", "label", "is_correct"}
                if not set(img.keys()) <= allowed:
                    raise ValueError(
                        "PICTURE_CHOICE image keys must be a subset of {src, label, is_correct}"
                    )
                if "src" not in img or "label" not in img:
                    raise ValueError("PICTURE_CHOICE image requires 'src' and 'label'")

        elif type_ is ExerciseType.FREE_TEXT:
            if not self.accept:
                raise ValueError("FREE_TEXT exercise requires non-empty 'accept'")

        elif type_ is ExerciseType.WORD_TILES:
            if not self.tiles or len(self.tiles) < 2:
                raise ValueError("WORD_TILES requires at least 2 'tiles'")
            # accept_orderings (when present) must permute
            # the tile index range.
            if self.accept_orderings:
                tile_count = len(self.tiles)
                valid_indices = set(range(tile_count))
                for ordering in self.accept_orderings:
                    if sorted(ordering) != list(range(tile_count)):
                        raise ValueError(
                            f"accept_orderings entry "
                            f"{ordering} must be a "
                            f"permutation of [0..{tile_count - 1}]"
                        )
                    if set(ordering) != valid_indices:
                        raise ValueError(
                            "accept_orderings entries must use every tile index exactly once"
                        )

        elif type_ is ExerciseType.CLOZE:
            # Phase 52D / v1.35.0 / P-127 — marker-based blanks.
            if not self.sentence:
                raise ValueError("CLOZE exercise requires non-empty 'sentence'")
            if not self.blanks:
                raise ValueError("CLOZE exercise requires non-empty 'blanks'")
            marker_count = self.sentence.count("___")
            if marker_count != len(self.blanks):
                raise ValueError(
                    f"CLOZE marker count mismatch: sentence has "
                    f"{marker_count} '___' markers but blanks has "
                    f"{len(self.blanks)} entries"
                )
            # ``select`` mode requires a non-empty distractor pool
            # to populate the per-blank ``<select>`` options.
            if self.cloze_mode == "select" and not self.distractors:
                raise ValueError("CLOZE with cloze_mode='select' requires non-empty 'distractors'")

        return self


class LessonStep(BaseModel):
    """One step in the lesson sequence.

    Theory steps carry a Markdown body. Exercise steps carry
    a fully-validated ``Exercise``. The viewer renders these
    in order; ``id`` lets deep-linking land on a specific
    step.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(
        ...,
        description="Slug-safe id, unique within the lesson.",
        min_length=1,
        max_length=120,
    )
    type: StepType = Field(
        ...,
        description="THEORY or EXERCISE.",
    )
    title: str | None = Field(
        default=None,
        description=(
            "Optional step title. Shown in the progress bar / step list (Phase 44 viewer)."
        ),
        max_length=200,
    )
    body: str | None = Field(
        default=None,
        description=(
            "THEORY: Markdown content. Rendered by the same "
            "react-markdown pipeline the help system uses."
        ),
    )
    exercise: Exercise | None = Field(
        default=None,
        description="EXERCISE: the exercise payload.",
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("LessonStep id must be slug-safe")
        return value

    @model_validator(mode="after")
    def _enforce_type_payload(self) -> LessonStep:
        if self.type is StepType.THEORY:
            if not self.body:
                raise ValueError("THEORY step requires non-empty 'body'")
            if self.exercise is not None:
                raise ValueError("THEORY step must not carry 'exercise'")
        else:  # EXERCISE
            if self.exercise is None:
                raise ValueError("EXERCISE step requires 'exercise' payload")
            if self.body is not None:
                raise ValueError(
                    "EXERCISE step must not carry 'body' (use the exercise's prompt instead)"
                )
        return self


class Lesson(BaseModel):
    """One lesson in a content set (Phase 43 / 2B-lesson).

    A lesson is the unit a user works through end-to-end —
    typically 5-15 minutes of content. The viewer (Phase 44)
    walks the steps in order; SRS (Phase 46) tracks the
    cards referenced by each exercise.

    Referential integrity: every ``card_id`` referenced by
    any exercise step MUST exist in the lesson's ``cards``
    list. Enforced by the model validator so the viewer can
    trust the references later.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(
        ...,
        description=(
            "Slug-safe id, unique within the parent set. "
            "Convention: ``NN-slug`` (e.g. ``01-greetings``) "
            "for deterministic ordering, though the loader "
            "does not enforce ordering — it reads the set's "
            "manifest for the lesson sequence."
        ),
        min_length=1,
        max_length=120,
    )
    title: str = Field(
        ...,
        description="Human-readable title shown in the lesson list.",
        min_length=1,
        max_length=200,
    )
    description: str | None = Field(
        default=None,
        description="Optional 1-2 sentence summary.",
        max_length=500,
    )
    estimated_minutes: int = Field(
        default=10,
        description=(
            "Rough wall-clock estimate. Surfaced in the "
            "Set Browser so the user can pick a lesson that "
            "fits the time they have."
        ),
        ge=1,
        le=240,
    )
    cards: list[Card] = Field(
        default_factory=list,
        description="Every card the lesson teaches.",
    )
    steps: list[LessonStep] = Field(
        ...,
        description=(
            "Ordered sequence of theory + exercise steps. Must contain at least one step."
        ),
        min_length=1,
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("Lesson id must be slug-safe")
        return value

    @field_validator("cards")
    @classmethod
    def _unique_card_ids(cls, value: list[Card]) -> list[Card]:
        seen: set[str] = set()
        for card in value:
            if card.id in seen:
                raise ValueError(f"duplicate card id '{card.id}' in lesson")
            seen.add(card.id)
        return value

    @field_validator("steps")
    @classmethod
    def _unique_step_ids(cls, value: list[LessonStep]) -> list[LessonStep]:
        seen: set[str] = set()
        for step in value:
            if step.id in seen:
                raise ValueError(f"duplicate step id '{step.id}' in lesson")
            seen.add(step.id)
        return value

    @model_validator(mode="after")
    def _referential_integrity(self) -> Lesson:
        """Every exercise.card_ids reference must resolve."""
        known_card_ids = {c.id for c in self.cards}
        for step in self.steps:
            if step.exercise is None:
                continue
            for card_id in step.exercise.card_ids:
                if card_id not in known_card_ids:
                    raise ValueError(
                        f"exercise '{step.exercise.id}' "
                        f"references unknown card '{card_id}' "
                        f"(known: {sorted(known_card_ids) or 'none'})"
                    )
        return self

    def get_step(self, step_id: str) -> LessonStep | None:
        """Look up a step by id. Used by the viewer for
        deep-linking (``/lesson/{id}#{step_id}``)."""
        for step in self.steps:
            if step.id == step_id:
                return step
        return None

    def get_card(self, card_id: str) -> Card | None:
        """Look up a card by id. Used by the SRS layer when
        scheduling reviews after a wrong answer."""
        for card in self.cards:
            if card.id == card_id:
                return card
        return None


def lesson_to_dict(lesson: Lesson) -> dict[str, Any]:
    """Serialise a Lesson for transport (REST API / Dexie)."""
    return lesson.model_dump(mode="json")


def dict_to_lesson(payload: dict[str, Any]) -> Lesson:
    """Parse a Lesson dict back, running ALL validators."""
    return Lesson.model_validate(payload)
