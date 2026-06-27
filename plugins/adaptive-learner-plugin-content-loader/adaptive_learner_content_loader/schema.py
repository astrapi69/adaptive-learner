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

# BCP-47 subset — kept in sync with ``models.py``. Used for the
# optional language-pair fields on ``Lesson`` (Phase 60 /
# v1.44.0). The set-level fields are authoritative; the lesson
# copies are optional and let an exported standalone lesson
# carry its own language pair.
_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")


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
    # --- v1.2 -> v1.3: technical / programming content (all optional,
    # backward compatible). A card whose ``media_type`` is ``"code"`` or
    # ``"formula"`` carries a ``code_snippet`` the viewer renders as a
    # syntax-highlighted block with a copy button + optional output.
    code_snippet: str | None = Field(
        default=None,
        description=(
            "Optional code / formula the card teaches (e.g. a Python "
            "snippet or an Excel formula). Rendered as a monospace, "
            "syntax-highlighted block in the viewer."
        ),
        max_length=5000,
    )
    code_language: str | None = Field(
        default=None,
        description=(
            "Highlighter language hint for ``code_snippet`` "
            "('python', 'javascript', 'sql', 'excel', ...). Free "
            "string; the viewer maps unknown values to plain text."
        ),
        max_length=30,
    )
    expected_output: str | None = Field(
        default=None,
        description="What ``code_snippet`` produces, shown in an 'Output:' block.",
        max_length=2000,
    )
    hint: str | None = Field(
        default=None,
        description="Progressive hint, revealed on request during an exercise.",
        max_length=1000,
    )
    difficulty: int | None = Field(
        default=None,
        description="Optional 1-5 difficulty scale (1 = easiest).",
        ge=1,
        le=5,
    )
    media_type: Literal["text", "code", "formula", "diagram"] | None = Field(
        default=None,
        description=(
            "Card content kind: 'text' (default when null), 'code', "
            "'formula', or 'diagram'. Drives code-aware rendering + "
            "exercise input (monospace editor for code/formula). "
            "EXP-039: a closed ``Literal`` so the generated JSON-Schema / "
            "TS types carry the exact union (was a free ``str`` gated by "
            "a runtime validator)."
        ),
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


class Pair(BaseModel):
    """One left↔right pair in a MATCHING exercise.

    EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
    so the generated JSON-Schema / TS types carry the structured
    ``{left, right}`` shape instead of a loose string map. The
    ``extra="forbid"`` config + the two required fields replace the
    former per-pair key check in ``_validate_matching_fields``;
    validation semantics are unchanged (a pair must have exactly
    ``left`` and ``right``).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    left: str = Field(
        ...,
        description="The left-column item. The renderer shuffles before display.",
        min_length=1,
        max_length=500,
    )
    right: str = Field(
        ...,
        description="The right-column item this pairs with.",
        min_length=1,
        max_length=500,
    )


class PictureImage(BaseModel):
    """One image option in a PICTURE_CHOICE exercise.

    EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
    so the generated JSON-Schema / TS types carry the structured
    ``{src, label, is_correct?}`` shape instead of a loose string
    map. ``extra="forbid"`` + the two required fields replace the
    former key-subset / src+label-present checks; the
    "exactly one correct" rule stays in ``_validate_picture_choice_fields``.

    ``is_correct`` stays a ``str`` (``"true"`` marks the answer) for
    backward compatibility with authored content, not a ``bool``.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    src: str = Field(
        ...,
        description=(
            "Relative path inside the set's ``assets/`` directory "
            "('assets/img/cat.png'). Resolved by the asset loader."
        ),
        min_length=1,
        max_length=500,
    )
    label: str = Field(
        ...,
        description="Accessible label / alt text for the image option.",
        min_length=1,
        max_length=500,
    )
    is_correct: str | None = Field(
        default=None,
        description=(
            "Set to the string ``'true'`` on exactly one image to mark "
            "it the correct choice. Absent on the distractor images."
        ),
        max_length=10,
    )


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
    direction: Literal["source_to_target", "target_to_source", "both", "random"] = Field(
        default="target_to_source",
        description=(
            "EXP-018 / Phase 62 / v1.46.0: which way the card is "
            "drilled. ``target_to_source`` (default) shows the "
            "target language and asks the learner to recognise the "
            "source language (RECEPTIVE, easier). "
            "``source_to_target`` shows the source and asks the "
            "learner to produce the target (PRODUCTIVE, harder). "
            "``both`` / ``random`` let the renderer or the adaptive "
            "generator pick per attempt. Additive + optional; "
            "schema_version stays 1.2. Cloze ignores it (in-context)."
        ),
    )

    # --- Type-specific fields. Validator below enforces
    # which fields are required per ``type``. Empty / null
    # for types that don't use them keeps the JSON files
    # consistent (no per-type field renaming).

    pairs: list[Pair] | None = Field(
        default=None,
        description=(
            "MATCHING: list of {left, right} pairs to match up. "
            "The renderer shuffles before display."
        ),
    )
    images: list[PictureImage] | None = Field(
        default=None,
        description=(
            "PICTURE_CHOICE: list of {src, label, is_correct?} "
            "options. Exactly one entry MUST include "
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
            "answer shown after a wrong attempt. CLOZE "
            "``multiselect`` (#1195) reuses this field with a "
            "mode-specific meaning: EVERY entry is a correct "
            "option (not just the first), rendered as a checkbox "
            "group with ``distractors`` and graded by exact-set "
            "match; the two lists must be disjoint."
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
            "input control. Phase 52D / v1.35.0. In "
            "``multiselect`` mode (#1195) this is instead the "
            "question stem (no ``___`` markers, no ``blanks``)."
        ),
        max_length=1000,
    )
    blanks: list[ClozeBlank] | None = Field(
        default=None,
        description=(
            "CLOZE: per-marker metadata in left-to-right order. "
            "``len(blanks) == sentence.count('___')`` enforced "
            "at validation time. Phase 52D / v1.35.0. Not used "
            "in ``multiselect`` mode (#1195)."
        ),
    )
    cloze_mode: Literal["type", "select", "multiselect"] | None = Field(
        default=None,
        description=(
            "CLOZE: ``type`` renders an ``<input>`` per blank, "
            "``select`` renders a single-answer ``<select>`` per "
            "blank with options from ``distractors``, "
            "``multiselect`` (#1195) renders a checkbox group of "
            "``accept`` (all correct) + ``distractors`` for a "
            "'select all that apply' question. Defaults to ``type`` when "
            "omitted on a CLOZE exercise. Phase 52D / v1.35.0."
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
        Dispatches to a per-type validator; types with no extra
        constraints fall through unchecked.
        """
        validators = {
            ExerciseType.MATCHING: self._validate_matching_fields,
            ExerciseType.PICTURE_CHOICE: self._validate_picture_choice_fields,
            ExerciseType.FREE_TEXT: self._validate_free_text_fields,
            ExerciseType.WORD_TILES: self._validate_word_tiles_fields,
            ExerciseType.CLOZE: self._validate_cloze_fields,
        }
        validate = validators.get(self.type)
        if validate is not None:
            validate()
        return self

    def _validate_matching_fields(self) -> None:
        """MATCHING requires non-empty 'pairs'.

        Each pair's exact ``{left, right}`` shape is enforced by the
        ``Pair`` model (required fields + ``extra="forbid"``)
        (EXP-039), so only the non-empty count is checked here.
        """
        if not self.pairs:
            raise ValueError("MATCHING exercise requires non-empty 'pairs'")

    def _validate_picture_choice_fields(self) -> None:
        """PICTURE_CHOICE requires >= 2 images, exactly one correct.

        Each image's ``{src, label, is_correct?}`` shape (required
        src+label, no extra keys) is enforced by the ``PictureImage``
        model (EXP-039); only the cross-image rules — at least two
        options and exactly one marked correct — live here.
        """
        if not self.images or len(self.images) < 2:
            raise ValueError("PICTURE_CHOICE requires at least 2 'images'")
        correct_count = sum(1 for img in self.images if img.is_correct == "true")
        if correct_count != 1:
            raise ValueError(
                "PICTURE_CHOICE must have exactly one image marked 'is_correct': 'true'"
            )

    def _validate_free_text_fields(self) -> None:
        """FREE_TEXT requires a non-empty 'accept' list."""
        if not self.accept:
            raise ValueError("FREE_TEXT exercise requires non-empty 'accept'")

    def _validate_word_tiles_fields(self) -> None:
        """WORD_TILES requires >= 2 tiles; accept_orderings must permute the tiles."""
        if not self.tiles or len(self.tiles) < 2:
            raise ValueError("WORD_TILES requires at least 2 'tiles'")
        # accept_orderings (when present) must permute the tile index range.
        if not self.accept_orderings:
            return
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
                raise ValueError("accept_orderings entries must use every tile index exactly once")

    def _validate_cloze_fields(self) -> None:
        """CLOZE (Phase 52D / P-127). The ``multiselect`` mode (#1195) is a
        whole-question 'select all that apply' shape (sentence = question,
        ``correct_answers`` + ``distractors``); the blank-based ``type`` /
        ``select`` modes require sentence + blanks with a matching '___'
        marker count, and ``select`` also needs a non-empty distractor pool."""
        if self.cloze_mode == "multiselect":
            self._validate_cloze_multiselect_fields()
            return
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
        # ``select`` mode requires a non-empty distractor pool to populate the
        # per-blank ``<select>`` options.
        if self.cloze_mode == "select" and not self.distractors:
            raise ValueError("CLOZE with cloze_mode='select' requires non-empty 'distractors'")

    def _validate_cloze_multiselect_fields(self) -> None:
        """CLOZE ``multiselect`` (#1195): a question stem + two disjoint,
        non-empty option lists. Reuses ``accept`` (EVERY entry is a correct
        option in this mode) + ``distractors`` (the wrong options). No
        blanks/markers."""
        if not self.sentence:
            raise ValueError("CLOZE multiselect requires a non-empty 'sentence' (the question)")
        if not self.accept:
            raise ValueError("CLOZE multiselect requires non-empty 'accept' (the correct options)")
        if not self.distractors:
            raise ValueError("CLOZE multiselect requires non-empty 'distractors'")
        overlap = set(self.accept) & set(self.distractors)
        if overlap:
            raise ValueError(
                "CLOZE multiselect 'accept' and 'distractors' must be "
                f"disjoint; shared option(s): {sorted(overlap)}"
            )


class LessonResource(BaseModel):
    """One lesson-level supplementary-media entry (EXP-029 / MED-05).

    Mirrors a ``media.yaml`` resource minus ``domain`` (inherited
    from the parent set). Surfaced in the "Vertiefe das Thema"
    section after the lesson summary. Optional + additive, so
    pre-EXP-029 lessons load unchanged. Added to the authoritative
    schema (EXP-039) so the JSON-Schema / generated TS types cover
    it — previously this shape lived only in the frontend
    ``ContentLessonResource`` interface, and a lesson carrying
    ``resources`` was rejected by ``extra="forbid"`` here.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    type: str = Field(
        ...,
        description="Resource kind ('video', 'podcast', 'article', ...).",
        min_length=1,
        max_length=40,
    )
    title: str = Field(
        ...,
        description="Human-readable title shown in the media list.",
        min_length=1,
        max_length=300,
    )
    url: str = Field(
        ...,
        description="Link to the resource.",
        min_length=1,
        max_length=2000,
    )
    language: str | None = Field(default=None, max_length=35)
    level: str | None = Field(default=None, max_length=10)
    duration: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=2000)
    author: str | None = Field(default=None, max_length=300)
    free: bool | None = Field(default=None)
    partnership: bool | None = Field(default=None)
    tags: list[str] | None = Field(default=None, max_length=20)


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
    example_url: str | None = Field(
        default=None,
        description=(
            "Optional URL to an external example that illustrates the "
            "theory (article / video / interactive visualisation). "
            "Rendered as a link button under a THEORY step's content "
            "(schema v1.4, additive). Must be an http(s) URL."
        ),
        max_length=2000,
    )
    example_label: str | None = Field(
        default=None,
        description=(
            "Optional display text for the example link. The viewer "
            "falls back to a localized 'View example' label when empty."
        ),
        max_length=200,
    )
    theory_ref: str | None = Field(
        default=None,
        description=(
            "EXERCISE: optional explicit reference to the theory step this "
            "exercise practices, by the theory step's id (preferred) or "
            "title. The viewer's 'Re-read theory' backlink resolves it "
            "exactly, falling back to the term-overlap heuristic when "
            "absent or unresolvable (additive, #709)."
        ),
        max_length=200,
    )
    review_lesson_id: str | None = Field(
        default=None,
        description=(
            "Set ONLY on synthesised SRS review steps (#673). Carries the "
            "source lesson_id the reviewed element belongs to, so the review "
            "recorder can address the exact stored ElementError row. Absent on "
            "real content lessons. Modeled here (EXP-039) so the schema covers "
            "the synthesised-review shape the frontend already emits."
        ),
        max_length=200,
    )

    @field_validator("example_url")
    @classmethod
    def _http_example_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("example_url must be an http(s) URL")
        return value

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
    target_language: str | None = Field(
        default=None,
        description=(
            "Optional BCP-47 code of the language taught "
            "(Phase 60 / v1.44.0). Mirrors the parent set's "
            "``target_language``; lets an exported standalone "
            "lesson carry its own pair. Absent on pre-v1.2 "
            "lessons — the parent set is authoritative."
        ),
    )
    source_language: str | None = Field(
        default=None,
        description=(
            "Optional BCP-47 code of the language the learner "
            "already speaks (the language the card ``back`` / "
            "notes / theory are written in). Absent on pre-v1.2 "
            "lessons."
        ),
    )
    domain: str | None = Field(
        default=None,
        description=(
            "Optional content domain (schema v1.3). Mirrors the "
            "parent set's ``domain`` ('language' default, or "
            "'psychology' / 'programming' / ...). Absent on "
            "language lessons; the parent set is authoritative."
        ),
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
    variation_of: str | None = Field(
        default=None,
        description=(
            "Phase 64B / schema 1.3 (additive). When set, this lesson is a "
            "community VARIATION of another lesson (same topic, different "
            "exercises or perspective); holds the original lesson's id. Absent "
            "for ordinary lessons. Modeled here (EXP-039) so a shared variation "
            "lesson is no longer rejected by ``extra='forbid'``."
        ),
        max_length=120,
    )
    variation_note: str | None = Field(
        default=None,
        description="Phase 64B. Author's short note on how this variation differs.",
        max_length=500,
    )
    contributed_by: str | None = Field(
        default=None,
        description=(
            "Phase 64C-2 / schema 1.3 (additive). Optional author credit set "
            "when the learner opts in while sharing. Shown as a subtle viewer "
            "credit line + in the GitHub submission."
        ),
        max_length=200,
    )
    contributed_at: str | None = Field(
        default=None,
        description="ISO-8601 timestamp the lesson was contributed.",
        max_length=40,
    )
    resources: list[LessonResource] | None = Field(
        default=None,
        description=(
            "EXP-029 / MED-05 (additive). Optional lesson-specific supplementary "
            "media (videos / podcasts / articles), surfaced in the 'Vertiefe das "
            "Thema' section after the lesson summary."
        ),
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("Lesson id must be slug-safe")
        return value

    @field_validator("target_language", "source_language")
    @classmethod
    def _bcp47_language(cls, value: str | None) -> str | None:
        if value is not None and not _LANGUAGE_RE.fullmatch(value):
            raise ValueError("language codes must be BCP-47 (e.g. 'fr', 'de-AT', 'zh-Hans')")
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
