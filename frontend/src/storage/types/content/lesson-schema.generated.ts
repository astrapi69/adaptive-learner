/**
 * GENERATED from schema/lesson.schema.json via
 * scripts/generate_lesson_types.mjs (EXP-039). DO NOT EDIT.
 *
 * Source of truth is the Pydantic model
 * (adaptive_learner_content_loader.schema). Edit the model, run
 * `make sync-schema`, then `make sync-lesson-types`.
 */

/**
 * Optional relative path inside ``assets/`` for TTS-recorded pronunciation. The voice plugin already supports playback (v1.18.0).
 */
export type Audio = string | null;
/**
 * What the learner is being TAUGHT to recall. Typically the translation / definition / answer (e.g. 'Hello').
 */
export type Back = string;
/**
 * Highlighter language hint for ``code_snippet`` ('python', 'javascript', 'sql', 'excel', ...). Free string; the viewer maps unknown values to plain text.
 */
export type CodeLanguage = string | null;
/**
 * Optional code / formula the card teaches (e.g. a Python snippet or an Excel formula). Rendered as a monospace, syntax-highlighted block in the viewer.
 */
export type CodeSnippet = string | null;
/**
 * Optional 1-5 difficulty scale (1 = easiest).
 */
export type Difficulty = number | null;
/**
 * What ``code_snippet`` produces, shown in an 'Output:' block.
 */
export type ExpectedOutput = string | null;
/**
 * What the learner sees first. Typically the target-language term (e.g. 'Bonjour').
 */
export type Front = string;
/**
 * Progressive hint, revealed on request during an exercise.
 */
export type Hint = string | null;
/**
 * Slug-safe id. Unique within the parent lesson. SRS reviews this id, not the surface term.
 */
export type Id = string;
/**
 * Optional relative path inside the set's ``assets/`` directory ('assets/img/bonjour.png'). Resolved by the asset loader.
 */
export type Image = string | null;
/**
 * Card content kind: 'text' (default when null), 'code', 'formula', or 'diagram'. Drives code-aware rendering + exercise input (monospace editor for code/formula). EXP-039: a closed ``Literal`` so the generated JSON-Schema / TS types carry the exact union (was a free ``str`` gated by a runtime validator).
 */
export type MediaType = ("text" | "code" | "formula" | "diagram") | null;
/**
 * Optional Markdown footnote shown after the user answers. Pronunciation tips, etymology, false-friend warnings — anything that helps long-term retention.
 */
export type Notes = string | null;
/**
 * Slug-safe tags for SRS filtering ('greeting', 'verb-present', 'irregular').
 */
export type Tags = string[];
/**
 * Phase 52I / v1.35.0 / P-130. Optional list of ``{token, role}`` annotations on the card's ``front``. The cloze generator (52E) uses these to pick a semantically-meaningful blank when available; absent annotations fall through to a position-based heuristic so old content keeps working unchanged.
 */
export type TokenRoles = CardTokenRole[] | null;
/**
 * Grammatical role of this token in the card.
 */
export type TokenRole = "article" | "verb" | "noun" | "adjective" | "preposition" | "gender_marker" | "tense_marker";
/**
 * Verbatim slice of the card's ``front``. The generator matches this against the wrong-answer key recorded by the SRS layer.
 */
export type Token = string;
/**
 * Every card the lesson teaches.
 */
export type Cards = Card[];
/**
 * ISO-8601 timestamp the lesson was contributed.
 */
export type ContributedAt = string | null;
/**
 * Phase 64C-2 / schema 1.3 (additive). Optional author credit set when the learner opts in while sharing. Shown as a subtle viewer credit line + in the GitHub submission.
 */
export type ContributedBy = string | null;
/**
 * Optional 1-2 sentence summary.
 */
export type Description = string | null;
/**
 * Optional content domain (schema v1.3). Mirrors the parent set's ``domain`` ('language' default, or 'psychology' / 'programming' / ...). Absent on language lessons; the parent set is authoritative.
 */
export type Domain = string | null;
/**
 * Rough wall-clock estimate. Surfaced in the Set Browser so the user can pick a lesson that fits the time they have.
 */
export type EstimatedMinutes = number;
/**
 * Slug-safe id, unique within the parent set. Convention: ``NN-slug`` (e.g. ``01-greetings``) for deterministic ordering, though the loader does not enforce ordering — it reads the set's manifest for the lesson sequence.
 */
export type Id1 = string;
/**
 * EXP-029 / MED-05 (additive). Optional lesson-specific supplementary media (videos / podcasts / articles), surfaced in the 'Vertiefe das Thema' section after the lesson summary.
 */
export type Resources = LessonResource[] | null;
export type Author = string | null;
export type Description1 = string | null;
export type Duration = string | null;
export type Free = boolean | null;
export type Language = string | null;
export type Level = string | null;
export type Partnership = boolean | null;
export type Tags1 = string[] | null;
/**
 * Human-readable title shown in the media list.
 */
export type Title = string;
/**
 * Resource kind ('video', 'podcast', 'article', ...).
 */
export type Type = string;
/**
 * Link to the resource.
 */
export type Url = string;
/**
 * Optional BCP-47 code of the language the learner already speaks (the language the card ``back`` / notes / theory are written in). Absent on pre-v1.2 lessons.
 */
export type SourceLanguage = string | null;
/**
 * THEORY: Markdown content. Rendered by the same react-markdown pipeline the help system uses.
 */
export type Body = string | null;
/**
 * Optional display text for the example link. The viewer falls back to a localized 'View example' label when empty.
 */
export type ExampleLabel = string | null;
/**
 * Optional URL to an external example that illustrates the theory (article / video / interactive visualisation). Rendered as a link button under a THEORY step's content (schema v1.4, additive). Must be an http(s) URL.
 */
export type ExampleUrl = string | null;
/**
 * FREE_TEXT: list of accepted answers. Exact-match first, Levenshtein-tolerant fallback in the renderer. The first entry is the canonical answer shown after a wrong attempt. CLOZE ``multiselect`` (#1195) reuses this field with a mode-specific meaning: EVERY entry is a correct option (not just the first), rendered as a checkbox group with ``distractors`` and graded by exact-set match; the two lists must be disjoint.
 */
export type Accept = string[] | null;
/**
 * WORD_TILES: optional list of accepted tile-index orderings (each is a permutation of [0..len-1]). If omitted, only the canonical order in ``tiles`` is accepted.
 */
export type AcceptOrderings = number[][] | null;
/**
 * CLOZE: per-marker metadata in left-to-right order. ``len(blanks) == sentence.count('___')`` enforced at validation time. Phase 52D / v1.35.0. Not used in ``multiselect`` mode (#1195).
 */
export type Blanks = ClozeBlank[] | null;
/**
 * Accepted answers for this blank. First entry is the canonical (shown after a wrong attempt). Same shape as FREE_TEXT.accept.
 */
export type Accept1 = string[];
/**
 * Optional per-blank hint. Surfaced inline next to this specific blank, not lesson-wide.
 */
export type Hint1 = string | null;
/**
 * Optional placeholder text shown inside the input (``type`` mode) before the user starts typing.
 */
export type Placeholder = string | null;
/**
 * Cards this exercise drills. SRS feedback after a wrong answer schedules these cards for review.
 */
export type CardIds = string[];
/**
 * CLOZE: ``type`` renders an ``<input>`` per blank, ``select`` renders a single-answer ``<select>`` per blank with options from ``distractors``, ``multiselect`` (#1195) renders a checkbox group of ``accept`` (all correct) + ``distractors`` for a 'select all that apply' question. Defaults to ``type`` when omitted on a CLOZE exercise. Phase 52D / v1.35.0.
 */
export type ClozeMode = ("type" | "select" | "multiselect") | null;
/**
 * EXP-018 / Phase 62 / v1.46.0: which way the card is drilled. ``target_to_source`` (default) shows the target language and asks the learner to recognise the source language (RECEPTIVE, easier). ``source_to_target`` shows the source and asks the learner to produce the target (PRODUCTIVE, harder). ``both`` / ``random`` let the renderer or the adaptive generator pick per attempt. Additive + optional; schema_version stays 1.2. Cloze ignores it (in-context).
 */
export type Direction = "source_to_target" | "target_to_source" | "both" | "random";
/**
 * Content-only fallback distractors. The exercise renderer picks from this pool when no AI provider is configured (EXP-005 / P-114 dual mode). When AI is available, the AI generator may use the pool as a seed for harder distractors.
 */
export type Distractors = string[];
/**
 * Optional Markdown hint shown on demand. The viewer renders this behind a 'Need a hint?' button.
 */
export type Hint2 = string | null;
/**
 * Slug-safe id, unique within the lesson.
 */
export type Id2 = string;
/**
 * PICTURE_CHOICE: list of {src, label, is_correct?} options. Exactly one entry MUST include 'is_correct': 'true'. ``src`` is a relative path inside the set's ``assets/`` directory.
 */
export type Images = PictureImage[] | null;
/**
 * Set to the string ``'true'`` on exactly one image to mark it the correct choice. Absent on the distractor images.
 */
export type IsCorrect = string | null;
/**
 * Accessible label / alt text for the image option.
 */
export type Label = string;
/**
 * Relative path inside the set's ``assets/`` directory ('assets/img/cat.png'). Resolved by the asset loader.
 */
export type Src = string;
/**
 * MATCHING: list of {left, right} pairs to match up. The renderer shuffles before display.
 */
export type Pairs = Pair[] | null;
/**
 * The left-column item. The renderer shuffles before display.
 */
export type Left = string;
/**
 * The right-column item this pairs with.
 */
export type Right = string;
/**
 * The question text shown to the learner.
 */
export type Prompt = string;
/**
 * CLOZE: the cloze sentence with visible ``___`` markers at each blank position. The renderer splits on the markers + interleaves the per-blank input control. Phase 52D / v1.35.0. In ``multiselect`` mode (#1195) this is instead the question stem (no ``___`` markers, no ``blanks``).
 */
export type Sentence = string | null;
/**
 * WORD_TILES: ordered list of tile labels. The renderer shuffles before display. Multiple correct orderings are configured via ``accept_orderings`` below.
 */
export type Tiles = string[] | null;
/**
 * Which exercise renderer handles this step.
 */
export type ExerciseType = "matching" | "picture_choice" | "free_text" | "word_tiles" | "cloze";
/**
 * Slug-safe id, unique within the lesson.
 */
export type Id3 = string;
/**
 * Set ONLY on synthesised SRS review steps (#673). Carries the source lesson_id the reviewed element belongs to, so the review recorder can address the exact stored ElementError row. Absent on real content lessons. Modeled here (EXP-039) so the schema covers the synthesised-review shape the frontend already emits.
 */
export type ReviewLessonId = string | null;
/**
 * EXERCISE: optional explicit reference to the theory step this exercise practices, by the theory step's id (preferred) or title. The viewer's 'Re-read theory' backlink resolves it exactly, falling back to the term-overlap heuristic when absent or unresolvable (additive, #709).
 */
export type TheoryRef = string | null;
/**
 * Optional step title. Shown in the progress bar / step list (Phase 44 viewer).
 */
export type Title1 = string | null;
/**
 * THEORY or EXERCISE.
 */
export type StepType = "theory" | "exercise";
/**
 * Ordered sequence of theory + exercise steps. Must contain at least one step.
 */
export type Steps = LessonStep[];
/**
 * Optional BCP-47 code of the language taught (Phase 60 / v1.44.0). Mirrors the parent set's ``target_language``; lets an exported standalone lesson carry its own pair. Absent on pre-v1.2 lessons — the parent set is authoritative.
 */
export type TargetLanguage = string | null;
/**
 * Human-readable title shown in the lesson list.
 */
export type Title2 = string;
/**
 * Phase 64B. Author's short note on how this variation differs.
 */
export type VariationNote = string | null;
/**
 * Phase 64B / schema 1.3 (additive). When set, this lesson is a community VARIATION of another lesson (same topic, different exercises or perspective); holds the original lesson's id. Absent for ordinary lessons. Modeled here (EXP-039) so a shared variation lesson is no longer rejected by ``extra='forbid'``.
 */
export type VariationOf = string | null;

/**
 * One lesson in a content set (Phase 43 / 2B-lesson).
 *
 * A lesson is the unit a user works through end-to-end —
 * typically 5-15 minutes of content. The viewer (Phase 44)
 * walks the steps in order; SRS (Phase 46) tracks the
 * cards referenced by each exercise.
 *
 * Referential integrity: every ``card_id`` referenced by
 * any exercise step MUST exist in the lesson's ``cards``
 * list. Enforced by the model validator so the viewer can
 * trust the references later.
 */
export interface Lesson {
  cards?: Cards;
  contributed_at?: ContributedAt;
  contributed_by?: ContributedBy;
  description?: Description;
  domain?: Domain;
  estimated_minutes?: EstimatedMinutes;
  id: Id1;
  resources?: Resources;
  source_language?: SourceLanguage;
  steps: Steps;
  target_language?: TargetLanguage;
  title: Title2;
  variation_note?: VariationNote;
  variation_of?: VariationOf;
}
/**
 * The smallest learnable unit (Phase 43 / 2B-lesson).
 *
 * A card carries a single term / concept / fact in a single
 * direction. SRS (Phase 46) tracks one card at a time;
 * individual exercises reference cards by id so a single
 * 'Bonjour = Hello' card can drive a matching exercise, a
 * free-text drill, and a summary review without
 * duplication.
 *
 * Convention: ``card.id`` is unique within the lesson, not
 * globally. Cross-lesson card sharing happens via a
 * separate ``shared/`` directory inside the set (P-111
 * territory — not yet implemented).
 */
export interface Card {
  audio?: Audio;
  back: Back;
  code_language?: CodeLanguage;
  code_snippet?: CodeSnippet;
  difficulty?: Difficulty;
  expected_output?: ExpectedOutput;
  front: Front;
  hint?: Hint;
  id: Id;
  image?: Image;
  media_type?: MediaType;
  notes?: Notes;
  tags?: Tags;
  token_roles?: TokenRoles;
}
/**
 * One ``token → role`` annotation on a card.
 *
 * Phase 52I / v1.35.0 / P-130. The cloze generator looks up
 * its target blank by matching ``token`` against the
 * ``ElementError.element_key`` — when a role is present, the
 * generator can pick a same-role distractor pool instead of
 * a position-based heuristic.
 *
 * The ``token`` is a verbatim slice of the card's ``front``;
 * no whitespace normalisation, so authors can annotate even
 * sub-word morphemes (an accent-bearing letter, an article
 * contraction) if a future generator needs it.
 */
export interface CardTokenRole {
  role: TokenRole;
  token: Token;
}
/**
 * One lesson-level supplementary-media entry (EXP-029 / MED-05).
 *
 * Mirrors a ``media.yaml`` resource minus ``domain`` (inherited
 * from the parent set). Surfaced in the "Vertiefe das Thema"
 * section after the lesson summary. Optional + additive, so
 * pre-EXP-029 lessons load unchanged. Added to the authoritative
 * schema (EXP-039) so the JSON-Schema / generated TS types cover
 * it — previously this shape lived only in the frontend
 * ``ContentLessonResource`` interface, and a lesson carrying
 * ``resources`` was rejected by ``extra="forbid"`` here.
 */
export interface LessonResource {
  author?: Author;
  description?: Description1;
  duration?: Duration;
  free?: Free;
  language?: Language;
  level?: Level;
  partnership?: Partnership;
  tags?: Tags1;
  title: Title;
  type: Type;
  url: Url;
}
/**
 * One step in the lesson sequence.
 *
 * Theory steps carry a Markdown body. Exercise steps carry
 * a fully-validated ``Exercise``. The viewer renders these
 * in order; ``id`` lets deep-linking land on a specific
 * step.
 */
export interface LessonStep {
  body?: Body;
  example_label?: ExampleLabel;
  example_url?: ExampleUrl;
  /**
   * EXERCISE: the exercise payload.
   */
  exercise?: Exercise | null;
  id: Id3;
  review_lesson_id?: ReviewLessonId;
  theory_ref?: TheoryRef;
  title?: Title1;
  type: StepType;
}
/**
 * One exercise step. Type-tagged via ``type``.
 *
 * The fields are kept in a single flat shape per
 * ``type`` rather than per-type discriminated unions
 * because the JSON manifests are author-edited; flat
 * shapes are easier to read and to diff in PRs. The
 * validator enforces type-specific requirements via
 * model_validator instead.
 */
export interface Exercise {
  accept?: Accept;
  accept_orderings?: AcceptOrderings;
  blanks?: Blanks;
  card_ids?: CardIds;
  cloze_mode?: ClozeMode;
  direction?: Direction;
  distractors?: Distractors;
  hint?: Hint2;
  id: Id2;
  images?: Images;
  pairs?: Pairs;
  prompt: Prompt;
  sentence?: Sentence;
  tiles?: Tiles;
  type: ExerciseType;
}
/**
 * One blank inside a cloze exercise's ``sentence`` (Phase 52D /
 * v1.35.0 / P-127).
 *
 * Marker-based convention: the sentence carries visible ``___``
 * tokens; ``blanks[i]`` provides the metadata for the i-th
 * marker (left-to-right). The validator enforces
 * ``sentence.count("___") == len(blanks)`` so the i↔i mapping
 * is unambiguous at render time.
 *
 * ``accept`` carries the per-blank canonical + acceptable
 * variants — the renderer reuses FreeText's ``isFreeTextCorrect``
 * matcher (NFC-normalised + Levenshtein <= 1) so authors only
 * need to enumerate semantic variants (gendered article,
 * capitalisation, et cetera), not typos.
 */
export interface ClozeBlank {
  accept: Accept1;
  hint?: Hint1;
  placeholder?: Placeholder;
}
/**
 * One image option in a PICTURE_CHOICE exercise.
 *
 * EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
 * so the generated JSON-Schema / TS types carry the structured
 * ``{src, label, is_correct?}`` shape instead of a loose string
 * map. ``extra="forbid"`` + the two required fields replace the
 * former key-subset / src+label-present checks; the
 * "exactly one correct" rule stays in ``_validate_picture_choice_fields``.
 *
 * ``is_correct`` stays a ``str`` (``"true"`` marks the answer) for
 * backward compatibility with authored content, not a ``bool``.
 */
export interface PictureImage {
  is_correct?: IsCorrect;
  label: Label;
  src: Src;
}
/**
 * One left↔right pair in a MATCHING exercise.
 *
 * EXP-039: modeled explicitly (was an inline ``dict[str, str]``)
 * so the generated JSON-Schema / TS types carry the structured
 * ``{left, right}`` shape instead of a loose string map. The
 * ``extra="forbid"`` config + the two required fields replace the
 * former per-pair key check in ``_validate_matching_fields``;
 * validation semantics are unchanged (a pair must have exactly
 * ``left`` and ``right``).
 */
export interface Pair {
  left: Left;
  right: Right;
}
