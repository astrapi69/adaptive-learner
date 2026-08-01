# GENERATED from schema/lesson.schema.json via scripts/generate_pydantic_models.py
# (D3b, #1528). DO NOT EDIT.
#
# Structural layer only - the semantic cross-field validators live in
# the hand-written subclasses (schema.py / models.py). Regenerate via
# `make sync-schema` after an engine re-pin refreshed the mirror.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from enum import Enum
from typing import Annotated, Any


RequiresExtension = Annotated[str, StringConstraints(pattern='^ext:[a-z0-9]+-[a-z0-9-]+@\\d+$')]


class MediaType(str, Enum):
    """
    Card content kind: 'text' (default when null), 'code', 'formula', or 'diagram'. Drives code-aware rendering + exercise input (monospace editor for code/formula). EXP-039: a closed ``Literal`` so the generated JSON-Schema / TS types carry the exact union (was a free ``str`` gated by a runtime validator).
    """

    TEXT = 'text'
    CODE = 'code'
    FORMULA = 'formula'
    DIAGRAM = 'diagram'


class ClozeBlank(BaseModel):
    """
    One blank inside a cloze exercise's ``sentence`` (Phase 52D /
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

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    accept: list[str] = Field(..., min_length=1, title='Accept')
    """
    Accepted answers for this blank. First entry is the canonical (shown after a wrong attempt). Same shape as FREE_TEXT.accept.
    """
    hint: str | None = Field(None, max_length=200, title='Hint')
    """
    Optional per-blank hint. Surfaced inline next to this specific blank, not lesson-wide.
    """
    placeholder: str | None = Field(None, max_length=40, title='Placeholder')
    """
    Optional placeholder text shown inside the input (``type`` mode) before the user starts typing.
    """


class ClozeMode(str, Enum):
    """
    CLOZE: ``type`` renders an ``<input>`` per blank, ``select`` renders a single-answer ``<select>`` per blank with options from ``distractors``, ``multiselect`` (#1195) renders a checkbox group of ``accept`` (all correct) + ``distractors`` for a 'select all that apply' question. Defaults to ``type`` when omitted on a CLOZE exercise. Phase 52D / v1.35.0.
    """

    TYPE = 'type'
    SELECT = 'select'
    MULTISELECT = 'multiselect'


class Direction(str, Enum):
    """
    EXP-018 / Phase 62 / v1.46.0: which way the card is drilled. ``target_to_source`` (default) shows the target language and asks the learner to recognise the source language (RECEPTIVE, easier). ``source_to_target`` shows the source and asks the learner to produce the target (PRODUCTIVE, harder). ``both`` / ``random`` let the renderer or the adaptive generator pick per attempt. Additive + optional; schema_version stays 1.2. Cloze ignores it (in-context).
    """

    SOURCE_TO_TARGET = 'source_to_target'
    TARGET_TO_SOURCE = 'target_to_source'
    BOTH = 'both'
    RANDOM = 'random'


class ExerciseType(str, Enum):
    """
    Closed enum of exercise types the loader knows about.

    EXP-001 + EXP-006: the four base types ship in Phase 43-45.
    Phase 52D / v1.35.0 added CLOZE (fill-in-the-blank with
    ``___`` markers) — see the schema_version bump in
    ``models.py``. Adding a sixth type (ordering, drag-image-
    pair, etc.) requires a minor schema_version bump and a new
    enum value plus its renderer.
    """

    MATCHING = 'matching'
    PICTURE_CHOICE = 'picture_choice'
    FREE_TEXT = 'free_text'
    WORD_TILES = 'word_tiles'
    CLOZE = 'cloze'
    MULTIPLE_CHOICE = 'multiple_choice'


ExtExerciseType = Annotated[str, StringConstraints(pattern='^ext:[a-z0-9]+-[a-z0-9-]+$')]
"""
    Extension exercise type in the ``ext:<vendor>-<name>`` namespace (e.g. ``ext:acme-ordering``). Structurally opaque here: an exercise carrying it must be declared in the lesson's ``requires_extensions`` and is validated by a registered extension, never by the core schema. Core content never uses this branch, so pre-1.7 content validates unchanged.
"""


class InlineExample(BaseModel):
    """
    One inline worked example on a theory step or exercise (schema v1.5).

    An inline example carries REAL content the learner reads in place —
    a sample sentence (language lessons) or a code snippet with syntax
    highlighting (programming lessons). This is DISTINCT from
    ``LessonStep.example_url`` (#139 / schema v1.4), which links OUT to an
    external illustration: ``example_url`` is the LINK variant,
    ``examples`` is the INLINE-CONTENT variant. The two are complementary
    and may coexist on the same theory step.

    When ``language`` is set, ``content`` is treated as source code in
    that language and rendered as a syntax-highlighted block (the same
    ``CodeBlock`` the theory Markdown + code cards use); when it is
    absent, ``content`` is plain text. Additive + optional, so content
    without ``examples`` validates unchanged.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    content: str = Field(..., max_length=5000, min_length=1, title='Content')
    """
    The example's content. Plain text (e.g. a sample sentence) when ``language`` is absent; source code in ``language`` when it is set.
    """
    language: str | None = Field(None, max_length=30, title='Language')
    """
    Optional highlighter language hint ('jsx', 'python', 'sql', ...). When set, ``content`` is rendered as a syntax-highlighted code block; when null, ``content`` is plain text. Free string; the viewer maps unknown values to plain text (same convention as ``Card.code_language``).
    """
    title: str | None = Field(None, max_length=200, title='Title')
    """
    Optional short heading shown above the example.
    """


class LessonResource(BaseModel):
    """
    One lesson-level supplementary-media entry (EXP-029 / MED-05).

    Mirrors a ``media.yaml`` resource minus ``domain`` (inherited
    from the parent set). Surfaced in the "Vertiefe das Thema"
    section after the lesson summary. Optional + additive, so
    pre-EXP-029 lessons load unchanged. Added to the authoritative
    schema (EXP-039) so the JSON-Schema / generated TS types cover
    it — previously this shape lived only in the frontend
    ``ContentLessonResource`` interface, and a lesson carrying
    ``resources`` was rejected by ``extra="forbid"`` here.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    author: str | None = Field(None, max_length=300, title='Author')
    description: str | None = Field(None, max_length=2000, title='Description')
    duration: str | None = Field(None, max_length=40, title='Duration')
    free: bool | None = Field(None, title='Free')
    language: str | None = Field(None, max_length=35, title='Language')
    level: str | None = Field(None, max_length=10, title='Level')
    partnership: bool | None = Field(None, title='Partnership')
    tags: list[str] | None = Field(None, max_length=20, title='Tags')
    title: str = Field(..., max_length=300, min_length=1, title='Title')
    """
    Human-readable title shown in the media list.
    """
    type: str = Field(..., max_length=40, min_length=1, title='Type')
    """
    Resource kind ('video', 'podcast', 'article', ...).
    """
    url: str = Field(..., max_length=2000, min_length=1, title='Url')
    """
    Link to the resource.
    """


class MultipleChoiceOption(BaseModel):
    """
    One answer option in a MULTIPLE_CHOICE exercise (schema v1.6).

    Correctness is a per-option flag, so the type needs no separate
    accept/distractor lists and no disjointness rule - the structure
    makes that class of authoring error impossible. Grading contract:
    with ``multiple: false`` exactly one option carries ``correct``
    and a single pick is graded; with ``multiple: true`` the learner
    must select the exact set of correct options (no partial credit,
    mirroring the cloze multiselect grading).
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    correct: bool = Field(False, title='Correct')
    """
    Set to true on the correct option(s). Exactly one with ``multiple: false``; at least one with ``multiple: true``.
    """
    text: str = Field(..., max_length=500, min_length=1, title='Text')
    """
    The option text shown to the learner. Unique within the exercise - the text IS the option, so a duplicate would be ambiguous.
    """


class Pair(BaseModel):
    """
    One left↔right pair in a MATCHING exercise.

    EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
    so the generated JSON-Schema / TS types carry the structured
    ``{left, right}`` shape instead of a loose string map. The
    ``extra="forbid"`` config + the two required fields replace the
    former per-pair key check in ``_validate_matching_fields``;
    validation semantics are unchanged (a pair must have exactly
    ``left`` and ``right``).
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    left: str = Field(..., max_length=500, min_length=1, title='Left')
    """
    The left-column item. The renderer shuffles before display.
    """
    right: str = Field(..., max_length=500, min_length=1, title='Right')
    """
    The right-column item this pairs with.
    """


Src = Annotated[str, StringConstraints(max_length=500, min_length=1)]
"""
    Image reference in one of two explicit formats (schema v1.8): a relative path inside the set's ``assets/`` directory ('assets/img/cat.png', <= 500 chars, resolved by the asset loader) OR an inline base64 data URI ('data:image/...;base64,...', its own 250000-char cap - sized for the reference consumer's 150-KiB upload compression: 153600 bytes -> 204800 base64 chars plus header). Repo content should prefer the assets/ path; the ``W-PIC-DATA-URI`` author lint flags inline data URIs.
"""


Src1 = Annotated[str, StringConstraints(max_length=250000, pattern='^data:image/[a-z0-9.+-]+;base64,')]
"""
    Image reference in one of two explicit formats (schema v1.8): a relative path inside the set's ``assets/`` directory ('assets/img/cat.png', <= 500 chars, resolved by the asset loader) OR an inline base64 data URI ('data:image/...;base64,...', its own 250000-char cap - sized for the reference consumer's 150-KiB upload compression: 153600 bytes -> 204800 base64 chars plus header). Repo content should prefer the assets/ path; the ``W-PIC-DATA-URI`` author lint flags inline data URIs.
"""


class PictureImage(BaseModel):
    """
    One image option in a PICTURE_CHOICE exercise.

    EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
    so the generated JSON-Schema / TS types carry the structured
    ``{src, label, is_correct?}`` shape instead of a loose string
    map. ``extra="forbid"`` + the two required fields replace the
    former key-subset / src+label-present checks; the
    "exactly one correct" rule stays in ``_validate_picture_choice_fields``.

    ``is_correct`` stays a ``str`` (``"true"`` marks the answer) for
    backward compatibility with authored content, not a ``bool``.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    is_correct: str | None = Field(None, max_length=10, title='Is Correct')
    """
    Set to the string ``'true'`` on exactly one image to mark it the correct choice. Absent on the distractor images.
    """
    label: str = Field(..., max_length=500, min_length=1, title='Label')
    """
    Accessible label / alt text for the image option.
    """
    src: Src | Src1 = Field(..., title='Src')
    """
    Image reference in one of two explicit formats (schema v1.8): a relative path inside the set's ``assets/`` directory ('assets/img/cat.png', <= 500 chars, resolved by the asset loader) OR an inline base64 data URI ('data:image/...;base64,...', its own 250000-char cap - sized for the reference consumer's 150-KiB upload compression: 153600 bytes -> 204800 base64 chars plus header). Repo content should prefer the assets/ path; the ``W-PIC-DATA-URI`` author lint flags inline data URIs.
    """


class StepType(str, Enum):
    """
    Closed enum for top-level step kinds.

    THEORY = Markdown content step. EXERCISE = one of the
    ExerciseType variants. The viewer (Phase 44) branches
    on this; no other step kinds are valid in v1.0.
    """

    THEORY = 'theory'
    EXERCISE = 'exercise'


class TokenRole(str, Enum):
    """
    Closed enum of grammatical roles a card token can carry.

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

    ARTICLE = 'article'
    VERB = 'verb'
    NOUN = 'noun'
    ADJECTIVE = 'adjective'
    PREPOSITION = 'preposition'
    GENDER_MARKER = 'gender_marker'
    TENSE_MARKER = 'tense_marker'


class CardTokenRole(BaseModel):
    """
    One ``token → role`` annotation on a card.

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

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    role: TokenRole
    """
    Grammatical role of this token in the card.
    """
    token: str = Field(..., max_length=120, min_length=1, title='Token')
    """
    Verbatim slice of the card's ``front``. The generator matches this against the wrong-answer key recorded by the SRS layer.
    """


class Exercise(BaseModel):
    """
    One exercise step. Type-tagged via ``type``.

    The fields are kept in a single flat shape per
    ``type`` rather than per-type discriminated unions
    because the JSON manifests are author-edited; flat
    shapes are easier to read and to diff in PRs. The
    validator enforces type-specific requirements via
    model_validator instead.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    accept: list[str] | None = Field(None, title='Accept')
    """
    FREE_TEXT: list of accepted answers. Exact-match first, Levenshtein-tolerant fallback in the renderer. The first entry is the canonical answer shown after a wrong attempt. CLOZE ``multiselect`` (#1195) reuses this field with a mode-specific meaning: EVERY entry is a correct option (not just the first), rendered as a checkbox group with ``distractors`` and graded by exact-set match; the two lists must be disjoint.
    """
    accept_orderings: list[list[int]] | None = Field(None, title='Accept Orderings')
    """
    WORD_TILES: optional list of accepted tile-index orderings (each is a permutation of [0..len-1]). If omitted, only the canonical order in ``tiles`` is accepted.
    """
    blanks: list[ClozeBlank] | None = Field(None, title='Blanks')
    """
    CLOZE: per-marker metadata in left-to-right order. ``len(blanks) == sentence.count('___')`` enforced at validation time. Phase 52D / v1.35.0. Not used in ``multiselect`` mode (#1195).
    """
    card_ids: list[str] = Field([], max_length=50, title='Card Ids')
    """
    Cards this exercise drills. SRS feedback after a wrong answer schedules these cards for review.
    """
    cloze_mode: ClozeMode | None = Field(None, title='Cloze Mode')
    """
    CLOZE: ``type`` renders an ``<input>`` per blank, ``select`` renders a single-answer ``<select>`` per blank with options from ``distractors``, ``multiselect`` (#1195) renders a checkbox group of ``accept`` (all correct) + ``distractors`` for a 'select all that apply' question. Defaults to ``type`` when omitted on a CLOZE exercise. Phase 52D / v1.35.0.
    """
    direction: Direction = Field(Direction.TARGET_TO_SOURCE, title='Direction')
    """
    EXP-018 / Phase 62 / v1.46.0: which way the card is drilled. ``target_to_source`` (default) shows the target language and asks the learner to recognise the source language (RECEPTIVE, easier). ``source_to_target`` shows the source and asks the learner to produce the target (PRODUCTIVE, harder). ``both`` / ``random`` let the renderer or the adaptive generator pick per attempt. Additive + optional; schema_version stays 1.2. Cloze ignores it (in-context).
    """
    distractors: list[str] = Field([], max_length=20, title='Distractors')
    """
    Content-only fallback distractors. The exercise renderer picks from this pool when no AI provider is configured (EXP-005 / P-114 dual mode). When AI is available, the AI generator may use the pool as a seed for harder distractors.
    """
    examples: list[InlineExample] | None = Field(None, max_length=20, title='Examples')
    """
    Optional inline worked examples shown BEFORE the answer controls, to help the learner understand the task (schema v1.5, additive). Each is plain text or a syntax-highlighted code snippet (see ``InlineExample.language``). Author responsibility not to spoil the answer. Independent of the per-type fields; absent on exercises that need no example.
    """
    ext_payload: dict[str, Any] | None = None
    """
    Opaque per-exercise payload for an ``ext:`` extension type. The core engine does not interpret it; the registered extension validator does. Absent on core exercises.
    """
    from_cards: bool = Field(False, title='From Cards')
    """
    MATCHING: when true, the exercise derives its ``pairs`` from the referenced cards (left = card ``front``, right = card ``back``) instead of listing them explicitly, so a definition lives in one place. Requires non-empty ``card_ids`` and forbids an explicit ``pairs`` list. The engine resolves it to concrete ``pairs`` at parse time. Additive + optional; schema_version stays 1.5.
    """
    hint: str | None = Field(None, max_length=1000, title='Hint')
    """
    Optional Markdown hint shown on demand. The viewer renders this behind a 'Need a hint?' button.
    """
    id: str = Field(..., max_length=120, min_length=1, title='Id')
    """
    Slug-safe id, unique within the lesson.
    """
    stable_id: str | None = Field(
        None, pattern='^[a-z0-9][a-z0-9_-]{7,63}$', title='Stable Id'
    )
    """
    engine#90 - schema 1.9 (additive). Author-owned, version-stable identity for progress/SRS joins: once published it NEVER changes, set-wide unique (cross-lesson uniqueness is checked by the repo gate via collectStableIds; the schema sees one document). Opaque mint-once value (lowercase slug, 8-64 chars), NOT derived from content, so answer-text fixes do not move it. Optional: pre-1.9 content validates unchanged. SCOPE: this closes orphaning by slug rename or position shift on the exercise/card level; it does NOT close the element-level case (an answer correction inside a surviving exercise still moves the content-derived element key, engine#91).
    """
    images: list[PictureImage] | None = Field(None, title='Images')
    """
    PICTURE_CHOICE: list of {src, label, is_correct?} options. Exactly one entry MUST include 'is_correct': 'true'. ``src`` is a relative path inside the set's ``assets/`` directory.
    """
    multiple: bool = Field(False, title='Multiple')
    """
    MULTIPLE_CHOICE: when false (default) exactly one option is correct (single choice); when true the learner selects ALL correct options ('select all that apply', graded by exact-set match). Ignored by the other exercise types.
    """
    options: list[MultipleChoiceOption] | None = Field(None, max_length=20, title='Options')
    """
    MULTIPLE_CHOICE: list of {text, correct?} answer options (schema v1.6). At least two options; ``multiple`` controls whether exactly one or at least one must be marked correct. Correctness is a per-option flag, so no separate accept/distractor lists (and no disjointness rule) are needed. The renderer shuffles before display.
    """
    pairs: list[Pair] | None = Field(None, title='Pairs')
    """
    MATCHING: list of {left, right} pairs to match up. The renderer shuffles before display.
    """
    prompt: str = Field(..., max_length=1000, min_length=1, title='Prompt')
    """
    The question text shown to the learner.
    """
    sentence: str | None = Field(None, max_length=1000, title='Sentence')
    """
    CLOZE: the cloze sentence with visible ``___`` markers at each blank position. The renderer splits on the markers + interleaves the per-blank input control. Phase 52D / v1.35.0. In ``multiselect`` mode (#1195) this is instead the question stem (no ``___`` markers, no ``blanks``).
    """
    tiles: list[str] | None = Field(None, title='Tiles')
    """
    WORD_TILES: ordered list of tile labels. The renderer shuffles before display. Multiple correct orderings are configured via ``accept_orderings`` below.
    """
    type: ExerciseType | ExtExerciseType
    """
    Which exercise renderer handles this step. A core ExerciseType value, or an ``ext:<vendor>-<name>`` extension type (ExtExerciseType) that the lesson declares in ``requires_extensions``.
    """


class LessonStep(BaseModel):
    """
    One step in the lesson sequence.

    Theory steps carry a Markdown body. Exercise steps carry
    a fully-validated ``Exercise``. The viewer renders these
    in order; ``id`` lets deep-linking land on a specific
    step.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    body: str | None = Field(None, title='Body')
    """
    THEORY: Markdown content. Rendered by the same react-markdown pipeline the help system uses.
    """
    example_label: str | None = Field(None, max_length=200, title='Example Label')
    """
    Optional display text for the example link. The viewer falls back to a localized 'View example' label when empty.
    """
    example_url: str | None = Field(None, max_length=2000, title='Example Url')
    """
    Optional URL to an external example that illustrates the theory (article / video / interactive visualisation). Rendered as a link button under a THEORY step's content (schema v1.4, additive). Must be an http(s) URL.
    """
    examples: list[InlineExample] | None = Field(None, max_length=20, title='Examples')
    """
    THEORY: optional inline worked examples rendered under the step body (schema v1.5, additive). DISTINCT from ``example_url``: that links OUT to an external illustration, ``examples`` carries the example content INLINE (a sample sentence, or a syntax-highlighted code snippet — see ``InlineExample.language``). The two may coexist on one step. Additive + optional; steps without ``examples`` validate unchanged.
    """
    exercise: Exercise | None = None
    """
    EXERCISE: the exercise payload.
    """
    id: str = Field(..., max_length=120, min_length=1, title='Id')
    """
    Slug-safe id, unique within the lesson.
    """
    review_lesson_id: str | None = Field(None, max_length=200, title='Review Lesson Id')
    """
    Set ONLY on synthesised SRS review steps (#673). Carries the source lesson_id the reviewed element belongs to, so the review recorder can address the exact stored ElementError row. Absent on real content lessons. Modeled here (EXP-039) so the schema covers the synthesised-review shape the frontend already emits.
    """
    theory_ref: str | None = Field(None, max_length=200, title='Theory Ref')
    """
    EXERCISE: optional explicit reference to the theory step this exercise practices, by the theory step's id (preferred) or title. The viewer's 'Re-read theory' backlink resolves it exactly, falling back to the term-overlap heuristic when absent or unresolvable (additive, #709).
    """
    title: str | None = Field(None, max_length=200, title='Title')
    """
    Optional step title. Shown in the progress bar / step list (Phase 44 viewer).
    """
    type: StepType
    """
    THEORY or EXERCISE.
    """


class Card(BaseModel):
    """
    The smallest learnable unit (Phase 43 / 2B-lesson).

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

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    audio: str | None = Field(None, title='Audio')
    """
    Optional relative path inside ``assets/`` for TTS-recorded pronunciation. The voice plugin already supports playback (v1.18.0).
    """
    back: str = Field(..., max_length=500, min_length=1, title='Back')
    """
    What the learner is being TAUGHT to recall. Typically the translation / definition / answer (e.g. 'Hello').
    """
    code_language: str | None = Field(None, max_length=30, title='Code Language')
    """
    Highlighter language hint for ``code_snippet`` ('python', 'javascript', 'sql', 'excel', ...). Free string; the viewer maps unknown values to plain text.
    """
    code_snippet: str | None = Field(None, max_length=5000, title='Code Snippet')
    """
    Optional code / formula the card teaches (e.g. a Python snippet or an Excel formula). Rendered as a monospace, syntax-highlighted block in the viewer.
    """
    difficulty: int | None = Field(None, ge=1, le=5, title='Difficulty')
    """
    Optional 1-5 difficulty scale (1 = easiest).
    """
    expected_output: str | None = Field(None, max_length=2000, title='Expected Output')
    """
    What ``code_snippet`` produces, shown in an 'Output:' block.
    """
    front: str = Field(..., max_length=500, min_length=1, title='Front')
    """
    What the learner sees first. Typically the target-language term (e.g. 'Bonjour').
    """
    hint: str | None = Field(None, max_length=1000, title='Hint')
    """
    Progressive hint, revealed on request during an exercise.
    """
    id: str = Field(..., max_length=120, min_length=1, title='Id')
    """
    Slug-safe id. Unique within the parent lesson. SRS reviews this id, not the surface term.
    """
    stable_id: str | None = Field(
        None, pattern='^[a-z0-9][a-z0-9_-]{7,63}$', title='Stable Id'
    )
    """
    engine#90 - schema 1.9 (additive). Author-owned, version-stable identity for progress/SRS joins: once published it NEVER changes, set-wide unique (cross-lesson uniqueness is checked by the repo gate via collectStableIds; the schema sees one document). Opaque mint-once value (lowercase slug, 8-64 chars), NOT derived from content, so answer-text fixes do not move it. Optional: pre-1.9 content validates unchanged. SCOPE: this closes orphaning by slug rename or position shift on the exercise/card level; it does NOT close the element-level case (an answer correction inside a surviving exercise still moves the content-derived element key, engine#91).
    """
    image: str | None = Field(None, title='Image')
    """
    Optional relative path inside the set's ``assets/`` directory ('assets/img/bonjour.png'). Resolved by the asset loader.
    """
    media_type: MediaType | None = Field(None, title='Media Type')
    """
    Card content kind: 'text' (default when null), 'code', 'formula', or 'diagram'. Drives code-aware rendering + exercise input (monospace editor for code/formula). EXP-039: a closed ``Literal`` so the generated JSON-Schema / TS types carry the exact union (was a free ``str`` gated by a runtime validator).
    """
    notes: str | None = Field(None, max_length=2000, title='Notes')
    """
    Optional Markdown footnote shown after the user answers. Pronunciation tips, etymology, false-friend warnings — anything that helps long-term retention.
    """
    tags: list[str] = Field([], max_length=20, title='Tags')
    """
    Slug-safe tags for SRS filtering ('greeting', 'verb-present', 'irregular').
    """
    token_roles: list[CardTokenRole] | None = Field(None, max_length=10, title='Token Roles')
    """
    Phase 52I / v1.35.0 / P-130. Optional list of ``{token, role}`` annotations on the card's ``front``. The cloze generator (52E) uses these to pick a semantically-meaningful blank when available; absent annotations fall through to a position-based heuristic so old content keeps working unchanged.
    """


class Lesson(BaseModel):
    """
    One lesson in a content set (Phase 43 / 2B-lesson).

    A lesson is the unit a user works through end-to-end —
    typically 5-15 minutes of content. The viewer (Phase 44)
    walks the steps in order; SRS (Phase 46) tracks the
    cards referenced by each exercise.

    Referential integrity: every ``card_id`` referenced by
    any exercise step MUST exist in the lesson's ``cards``
    list. Enforced by the model validator so the viewer can
    trust the references later.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    cards: list[Card] = Field([], title='Cards', validate_default=True)
    """
    Every card the lesson teaches.
    """
    contributed_at: str | None = Field(None, max_length=40, title='Contributed At')
    """
    ISO-8601 timestamp the lesson was contributed.
    """
    contributed_by: str | None = Field(None, max_length=200, title='Contributed By')
    """
    Phase 64C-2 / schema 1.3 (additive). Optional author credit set when the learner opts in while sharing. Shown as a subtle viewer credit line + in the GitHub submission.
    """
    description: str | None = Field(None, max_length=500, title='Description')
    """
    Optional 1-2 sentence summary.
    """
    domain: str | None = Field(None, title='Domain')
    """
    Optional content domain (schema v1.3). Mirrors the parent set's ``domain`` ('language' default, or 'psychology' / 'programming' / ...). Absent on language lessons; the parent set is authoritative.
    """
    estimated_minutes: int = Field(10, ge=1, le=240, title='Estimated Minutes')
    """
    Rough wall-clock estimate. Surfaced in the Set Browser so the user can pick a lesson that fits the time they have.
    """
    id: str = Field(..., max_length=120, min_length=1, title='Id')
    """
    Slug-safe id, unique within the parent set. Convention: ``NN-slug`` (e.g. ``01-greetings``) for deterministic ordering, though the loader does not enforce ordering — it reads the set's manifest for the lesson sequence.
    """
    requires_extensions: list[RequiresExtension] | None = Field(
        None, title='Requires Extensions'
    )
    """
    Extensions this lesson needs, each ``ext:<vendor>-<name>@<major>`` (e.g. ``ext:acme-ordering@1``). A consumer that has not registered a declared extension refuses the lesson loudly (E-EXT-UNSUPPORTED) rather than mis-rendering. Absent / empty on core lessons; additive, so pre-1.7 content validates unchanged.
    """
    resources: list[LessonResource] | None = Field(None, title='Resources')
    """
    EXP-029 / MED-05 (additive). Optional lesson-specific supplementary media (videos / podcasts / articles), surfaced in the 'Vertiefe das Thema' section after the lesson summary.
    """
    source_language: str | None = Field(None, title='Source Language')
    """
    Optional BCP-47 code of the language the learner already speaks (the language the card ``back`` / notes / theory are written in). Absent on pre-v1.2 lessons.
    """
    steps: list[LessonStep] = Field(..., min_length=1, title='Steps')
    """
    Ordered sequence of theory + exercise steps. Must contain at least one step.
    """
    target_language: str | None = Field(None, title='Target Language')
    """
    Optional BCP-47 code of the language taught (Phase 60 / v1.44.0). Mirrors the parent set's ``target_language``; lets an exported standalone lesson carry its own pair. Absent on pre-v1.2 lessons — the parent set is authoritative.
    """
    title: str = Field(..., max_length=200, min_length=1, title='Title')
    """
    Human-readable title shown in the lesson list.
    """
    variation_note: str | None = Field(None, max_length=500, title='Variation Note')
    """
    Phase 64B. Author's short note on how this variation differs.
    """
    variation_of: str | None = Field(None, max_length=120, title='Variation Of')
    """
    Phase 64B / schema 1.3 (additive). When set, this lesson is a community VARIATION of another lesson (same topic, different exercises or perspective); holds the original lesson's id. Absent for ordinary lessons. Modeled here (EXP-039) so a shared variation lesson is no longer rejected by ``extra='forbid'``.
    """
