/**
 * Draft → lesson conversion for the Lesson Creator (Phase 65D).
 *
 * Turns the wizard's {meta, cards, exercises} into a schema-v1.2
 * ``ContentLesson`` (the SAME format every other lesson uses — no
 * special "created" shape) plus the ``SaveUserSetInput`` that
 * persists it to "My Lessons" via ``saveUserSet``. Deterministic;
 * validated against the same invariants as the analysis generator.
 */

import {slugify, validateGeneratedLesson} from "../analysis/analysis-to-lesson";
import {
    isExtensionType,
    requiredExtensionsFor,
    type GeneratorCard,
} from "../../exercises";
import {contentDomainToStamp, isKnownContentDomain} from "../content-domains";
import {LANGUAGE_OPTIONS} from "../language/language-options";
import type {LessonCardDraft, LessonMeta} from "./lesson-draft";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonStep,
    ContentLessonExercise,
    SaveUserSetInput,
    UserLessonOrigin,
} from "../../../storage/types";

/**
 * Adapt the wizard's draft cards to the generic {@link GeneratorCard}
 * shape the exercise generator consumes (#1847).
 *
 * The ``example`` sentence comes from the card's dedicated ``example``
 * field — NOT from ``notes`` — so cloze / word-tiles generation is driven
 * by an explicit, labelled input rather than silently overloading the
 * notes field. ``image`` feeds picture-choice; ``altAnswers`` feed the
 * free-text accepted answers.
 */
export function draftCardsToGeneratorCards(
    cards: LessonCardDraft[],
): GeneratorCard[] {
    return cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        example: c.example ?? "",
        image: c.image,
        altAnswers: c.altAnswers ?? [],
    }));
}

export interface DraftLessonInput {
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
}

/** Options for {@link buildLessonFromDraft} (#1740 — lesson editing).
 *  New-lesson mode passes nothing and gets the historical behaviour;
 *  edit mode overrides the lesson id (so the same lesson FILE is
 *  overwritten and progress keyed on the filename survives) and the
 *  theory steps (so a lesson's authored theory — which the wizard has
 *  no editor for — is preserved verbatim across an exercise/card
 *  edit). */
export interface BuildLessonOptions {
    /** Force the lesson id (the ``lessons/{id}.json`` filename). When
     *  absent it derives from the title, matching new-lesson save. */
    id?: string;
    /** Theory steps to use INSTEAD of the auto-generated ``theory-intro``.
     *  When absent the intro is generated from title/description. */
    theorySteps?: ContentLessonStep[];
}

function estimateMinutes(theory: number, exercises: number): number {
    // ~1 min reading per theory step + ~1.5 min per exercise.
    return Math.max(1, Math.round(theory + exercises * 1.5));
}

/** The auto-generated intro step (id ``theory-intro``) built from the
 *  title + description. Kept as a named helper so edit mode can
 *  regenerate exactly the same shape when the lesson carries our intro. */
function buildIntroStep(meta: LessonMeta): ContentLessonStep {
    const introBody =
        `# ${meta.title.trim()}` +
        (meta.description.trim() ? `\n\n${meta.description.trim()}` : "");
    return {
        id: "theory-intro",
        type: "theory",
        title: meta.title.trim(),
        body: introBody,
    };
}

/** Compute the theory portion to preserve when re-saving an EDITED
 *  lesson (#1740). The wizard has no theory editor, so a lesson's
 *  authored theory must survive an exercise/card edit:
 *   - wizard-created lineage (carries a ``theory-intro`` step, or no
 *     theory at all): regenerate the intro from the current
 *     title/description so a rename is reflected, then keep any other
 *     theory steps verbatim.
 *   - imported lineage (real authored theory, no ``theory-intro``):
 *     preserve every non-exercise step verbatim (no regeneration), so
 *     nothing the wizard can't represent is lost. */
export function preservedTheorySteps(
    originalSteps: ContentLessonStep[],
    meta: LessonMeta,
): ContentLessonStep[] {
    const nonExercise = originalSteps.filter((s) => s.type !== "exercise");
    const hasIntro = nonExercise.some((s) => s.id === "theory-intro");
    if (hasIntro || nonExercise.length === 0) {
        const others = nonExercise.filter((s) => s.id !== "theory-intro");
        return [buildIntroStep(meta), ...others];
    }
    return nonExercise;
}

/** Build a valid ContentLesson from the draft. Throws (via
 *  ``validateGeneratedLesson``) on a schema violation so the caller
 *  can surface it before saving. */
export function buildLessonFromDraft(
    input: DraftLessonInput,
    opts: BuildLessonOptions = {},
): ContentLesson {
    const {meta, cards, exercises} = input;
    const lessonCards: ContentLessonCard[] = cards.map((c) => ({
        id: c.id,
        front: c.front.trim(),
        back: c.back.trim(),
        notes: c.notes.trim() || null,
        image: c.image.trim() || null,
        tags: [],
    }));

    const steps: ContentLessonStep[] = [];
    // A theory body is required; the intro guarantees a non-empty one.
    // Edit mode supplies the preserved theory instead (#1740).
    if (opts.theorySteps && opts.theorySteps.length > 0) {
        steps.push(...opts.theorySteps);
    } else {
        steps.push(buildIntroStep(meta));
    }
    exercises.forEach((ex, i) => {
        steps.push({
            id: `step-ex-${i}-${ex.id}`,
            type: "exercise",
            title: null,
            body: null,
            exercise: ex,
        });
    });

    const theoryCount = steps.filter((s) => s.type !== "exercise").length;
    // #1895 — a manually-added extension exercise (e.g. dictation via the
    // core-type picker) MUST declare its extension so the lesson is refused,
    // not silently mis-rendered, in an app without it. Only set the field when
    // there is one to declare, so a pure-core lesson never carries a spurious
    // ``requires_extensions: []``.
    const requiredExtensions = requiredExtensionsFor(exercises);
    // #1716 — stamp an explicit NON-language content domain so a knowledge
    // lesson (single content language, source == target) is recognised as
    // intentional domain content. A language lesson carries no ``domain``
    // field (the schema default), so no spurious ``domain: "language"``.
    const contentDomain = contentDomainToStamp(meta.domain);
    const lesson: ContentLesson = {
        id: opts.id ?? (slugify(meta.title) || "lesson"),
        title: meta.title.trim(),
        description: meta.description.trim() || null,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        estimated_minutes: estimateMinutes(theoryCount, exercises.length),
        cards: lessonCards,
        steps,
        ...(requiredExtensions.length > 0
            ? {requires_extensions: requiredExtensions}
            : {}),
        ...(contentDomain ? {domain: contentDomain} : {}),
        contributed_by: meta.author.trim() || null,
        contributed_at: meta.author.trim() ? new Date().toISOString() : null,
    };

    validateGeneratedLesson(lesson);
    return lesson;
}

/** Restore the invariant "``ext_payload`` present iff the exercise is an
 *  ``ext:`` extension type" on a reconstructed exercise (#1919).
 *
 *  The lesson JSON-Schema types ``ext_payload`` as object-only ("Absent on
 *  core exercises"), yet the API-mode ``GET .../lessons`` endpoint serves the
 *  lesson through ``response_model=Lesson`` with the default
 *  ``exclude_none=False``, so the Pydantic ``Exercise.ext_payload: dict | None``
 *  is emitted as ``ext_payload: null`` on every core exercise. Copied verbatim
 *  into the wizard and re-validated, that null fails ajv with
 *  ``/steps/N/exercise/ext_payload must be object``. A core exercise must carry
 *  no ``ext_payload`` at all; an extension exercise keeps its real payload. */
function reconstructExercise(ex: ContentLessonExercise): ContentLessonExercise {
    if (isExtensionType(ex.type) || !("ext_payload" in ex)) return ex;
    const {ext_payload: _dropped, ...core} = ex;
    return core as ContentLessonExercise;
}

/** Reverse of {@link buildLessonFromDraft}: turn an existing
 *  ``ContentLesson`` (plus its set entry, for level/title_native) back
 *  into the wizard's ``{meta, cards, exercises}`` so the Lesson Creator
 *  can open pre-filled for editing (#1740). Cards come straight off the
 *  lesson; exercises are sanitized so a core exercise never carries a
 *  serialization-introduced ``ext_payload`` (#1919). Theory-only structure
 *  is carried separately by the caller (see {@link preservedTheorySteps}). */
export function lessonToDraftInput(
    lesson: ContentLesson,
    entry?: {level?: string | null; title_native?: string | null},
): DraftLessonInput {
    const cards: LessonCardDraft[] = lesson.cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        notes: c.notes ?? "",
        image: c.image ?? "",
    }));
    const exercises: ContentLessonExercise[] = lesson.steps
        .filter((s) => s.type === "exercise" && s.exercise)
        .map((s) => reconstructExercise(s.exercise as ContentLessonExercise));
    const meta: LessonMeta = {
        title: lesson.title,
        titleNative: entry?.title_native ?? "",
        sourceLanguage: lesson.source_language ?? "en",
        targetLanguage: lesson.target_language ?? "en",
        level: entry?.level ?? "A1",
        description: lesson.description ?? "",
        author: lesson.contributed_by ?? "",
        // #1716 — carry an explicit NON-language content domain back into the
        // wizard so editing a knowledge lesson keeps its domain (and its
        // single-content-language / level-less shape). An unknown or absent
        // domain normalises to the default ``"language"``.
        domain:
            lesson.domain && isKnownContentDomain(lesson.domain)
                ? lesson.domain
                : "language",
    };
    return {meta, cards, exercises};
}

/** Stable slug-safe set id for a user-created lesson. Re-saving with
 *  the same title overwrites (matches ``saveUserSet`` semantics). */
export function draftSetId(meta: LessonMeta): string {
    return `created-${slugify(meta.title) || "lesson"}`;
}

/** Options for {@link buildUserSetInput} (#1740 — lesson editing).
 *  New-lesson mode passes nothing (id derives from the title, origin
 *  ``"imported"``); edit mode overrides the set id so the SAME set is
 *  overwritten even after a title change, and carries the original
 *  origin so an edited analysis/adaptive set keeps its badge. */
export interface BuildUserSetOptions {
    /** Force the set id (overwrite target). Absent = derive from title. */
    setId?: string;
    /** Preserve the existing set's origin. Absent = ``"imported"``. */
    origin?: UserLessonOrigin;
}

/** Wrap a built lesson in the ``SaveUserSetInput`` that persists it to
 *  "My Lessons" via ``saveUserSet`` (origin ``"imported"``, since a
 *  hand-authored lesson has no analysis/adaptive origin in the enum). */
export function buildUserSetInput(
    input: DraftLessonInput,
    lesson: ContentLesson,
    opts: BuildUserSetOptions = {},
): SaveUserSetInput {
    const {meta} = input;
    return {
        set_id: opts.setId ?? draftSetId(meta),
        title: meta.title.trim(),
        title_native: meta.titleNative.trim() || meta.title.trim(),
        language: meta.targetLanguage,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        level: meta.level,
        // No "manual" origin in the enum; a hand-authored lesson is
        // closest to "imported" (authored outside an analysis/adaptive
        // flow). The viewer + sharing treat all user sets identically.
        origin: opts.origin ?? "imported",
        description: meta.description.trim() || null,
        lessons: [lesson],
    };
}

/** The set of supported BCP-47 language codes offered by the authoring
 *  surfaces ({@link LANGUAGE_OPTIONS}). */
const SUPPORTED_LANGUAGE_CODES: ReadonlySet<string> = new Set(
    LANGUAGE_OPTIONS.map((o) => o.code),
);

/**
 * True iff both sides of a language pair are supported codes (#1929).
 *
 * "Valid" means "both are real, supported languages", NOT "the two
 * differ". A same-language pair (e.g. ``de -> de``) is a legitimate
 * knowledge-domain lesson (#1715), so it is a VALID pair — the removed
 * ``source !== target`` gate was the bug, not this check. An empty or
 * unknown code (a stale draft, a hand-edited import) is the failure case.
 */
export function isValidLanguagePair(
    source: string,
    target: string,
): boolean {
    return (
        SUPPORTED_LANGUAGE_CODES.has(source) &&
        SUPPORTED_LANGUAGE_CODES.has(target)
    );
}

export interface DraftValidationChecks {
    hasTitle: boolean;
    /** Both source and target are supported language codes (#1929).
     *  A same-language pair is VALID (knowledge-domain lessons, #1715);
     *  an empty or unknown code fails. */
    languagePair: boolean;
    enoughCards: boolean;
    enoughExercises: boolean;
    enoughTypes: boolean;
    schemaValid: boolean;
    /** The structural validator's reason when ``schemaValid`` is false
     *  (#1722 — e.g. ``/cards/0/back must NOT have fewer than 1
     *  characters``); ``null`` when the structure is valid. Detail for
     *  the checklist + console, NOT part of the boolean aggregate. */
    schemaError: string | null;
}

/** The boolean check keys {@link allChecksPass} aggregates (everything
 *  except the ``schemaError`` detail field). */
const BOOLEAN_CHECK_KEYS = [
    "hasTitle",
    "languagePair",
    "enoughCards",
    "enoughExercises",
    "enoughTypes",
    "schemaValid",
] as const;

export const MIN_CARDS_FOR_SAVE = 4;
export const MIN_EXERCISES_FOR_SAVE = 5;
export const MIN_TYPES_FOR_SAVE = 2;

/** The engine schema's ``Card.front``/``Card.back`` ``maxLength`` (#1722).
 *  The card inputs cap at this so a hand-typed side can never fail the
 *  ajv structure check on length. */
export const CARD_SIDE_MAX_LENGTH = 500;

/** Run the save-readiness checks for the Step-4 checklist. */
export function checkDraft(input: DraftLessonInput): DraftValidationChecks {
    const {meta, cards, exercises} = input;
    const types = new Set(exercises.map((e) => e.type));
    let schemaValid: boolean;
    let schemaError: string | null = null;
    try {
        buildLessonFromDraft(input);
        schemaValid = true;
    } catch (err) {
        schemaValid = false;
        schemaError = err instanceof Error ? err.message : String(err);
        // #1722 — a bare ✗ is not actionable; keep the precise validator
        // reason available in the dev console alongside the checklist.
        // The pristine empty draft fails the schema by construction and is
        // the page's normal initial state — that one stays silent.
        const pristine =
            meta.title.trim().length === 0 &&
            cards.length === 0 &&
            exercises.length === 0;
        if (!pristine) {
            console.error("create-lesson: draft structure invalid:", schemaError);
        }
    }
    return {
        hasTitle: meta.title.trim().length > 0,
        // #1929 — "language pair is valid" = both sides are SUPPORTED codes.
        // #1715 — a same-language pair (de -> de) stays VALID: it is a
        // legitimate knowledge-domain lesson, surfaced as a neutral hint in
        // Step 1, never the removed ``source !== target`` gate. Only an empty
        // or unknown code (stale draft / hand-edited import) fails here.
        languagePair: isValidLanguagePair(
            meta.sourceLanguage,
            meta.targetLanguage,
        ),
        enoughCards: cards.length >= MIN_CARDS_FOR_SAVE,
        enoughExercises: exercises.length >= MIN_EXERCISES_FOR_SAVE,
        enoughTypes: types.size >= MIN_TYPES_FOR_SAVE,
        schemaValid,
        schemaError,
    };
}

/** True iff every save-readiness check passed (the draft is saveable). */
export function allChecksPass(checks: DraftValidationChecks): boolean {
    return BOOLEAN_CHECK_KEYS.every((key) => checks[key]);
}
