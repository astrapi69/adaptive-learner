/**
 * Blank-exercise factory + validation for the extension-authoring wizard
 * (#1852). Editors 1+2: ``ext:al-categorization`` + ``ext:al-error-correction``;
 * editors 3+4: ``ext:al-reading-comprehension`` + ``ext:al-graded-quiz``.
 *
 * Validation REUSES the shipped per-type payload validators (the exact rules
 * the renderers + load guard already enforce) rather than re-implementing
 * them. The blank starts are deliberately invalid so the wizard gate keeps a
 * half-filled extension exercise out of the review step until the author
 * completes it.
 *
 * @example
 * ```ts
 * const ex = createBlankExtensionExercise(CATEGORIZATION_EXT_TYPE, newExtensionExerciseId());
 * const issue = validateExtensionExercise(ex); // {valid: false, code: "prompt"}
 * if (issue.valid) onSave(normalizeExtensionExercise(ex));
 * ```
 */

import {
    CATEGORIZATION_EXT_TYPE,
    categorizationPayloadErrors,
} from "../payload/categorization";
import {
    ERROR_CORRECTION_EXT_TYPE,
    errorCorrectionPayloadErrors,
} from "../payload/error-correction";
import {
    READING_COMPREHENSION_EXT_TYPE,
    readingComprehensionPayloadErrors,
    type RcQuestion,
} from "../payload/reading-comprehension";
import {
    GRADED_QUIZ_EXT_TYPE,
    gradedQuizPayloadErrors,
    type GqQuestion,
} from "../payload/graded-quiz";
import {DICTATION_EXT_TYPE, dictationPayloadErrors} from "../payload/dictation";
import type {ContentLessonExercise} from "../../../storage/types";
import {createIdFactory} from "./id-factory";

export {
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    DICTATION_EXT_TYPE,
};

/** The extension exercise types the wizard can author (#1852, editors 1-4;
 *  #1887 added dictation, editor 5). */
export const EXTENSION_WIZARD_TYPES = [
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    DICTATION_EXT_TYPE,
] as const;

export type ExtensionWizardType = (typeof EXTENSION_WIZARD_TYPES)[number];

/** A sub-question shape shared by reading-comprehension + graded-quiz. The
 *  wizard keeps BOTH ``options`` and ``accept`` present so a type switch never
 *  loses data; normalization drops the branch the chosen type does not use. */
export interface WizardSubQuestion {
    prompt: string;
    type: "multiple_choice" | "free_text";
    options: {text: string; correct: boolean}[];
    accept: string[];
    points?: number;
    partial_credit?: boolean;
}

/**
 * Machine code identifying which rule an extension exercise draft failed.
 * App-neutral on purpose (#1862): the kit reports WHAT is wrong, the app maps
 * the code to a localized message (see ``edit-error-keys.ts``). ``prompt`` is
 * the shared pre-check; the others match the wizard extension type.
 */
export type ExtensionEditCode =
    | "prompt"
    | "categorization"
    | "error_correction"
    | "reading_comprehension"
    | "graded_quiz"
    | "dictation";

/** Result of validating an extension exercise draft: whether it is saveable
 *  and, when not, the machine {@link ExtensionEditCode} of the failed rule. */
export interface ExtensionEditIssue {
    valid: boolean;
    code: ExtensionEditCode | null;
}

const ok: ExtensionEditIssue = {valid: true, code: null};

function fail(code: ExtensionEditCode): ExtensionEditIssue {
    return {valid: false, code};
}

const wizardExtensionIds = createIdFactory("ex-ext");

/** Unique id for a wizard-authored extension exercise. Backed by a default
 *  {@link IdFactory}; inject {@link createIdFactory} for an isolated
 *  sequence (#1862). */
export function newExtensionExerciseId(): string {
    return wizardExtensionIds.next();
}

/** A deliberately-invalid blank sub-question (no correct option / no accept
 *  entry yet), optionally carrying graded-quiz points. */
export function blankSubQuestion(withPoints: boolean): WizardSubQuestion {
    const base: WizardSubQuestion = {
        prompt: "",
        type: "multiple_choice",
        options: [
            {text: "", correct: false},
            {text: "", correct: false},
        ],
        accept: [],
    };
    return withPoints ? {...base, points: 1, partial_credit: false} : base;
}

const BLANK_PAYLOAD: Record<ExtensionWizardType, () => unknown> = {
    [CATEGORIZATION_EXT_TYPE]: () => ({
        categories: [
            {name: "", items: []},
            {name: "", items: []},
        ],
    }),
    [ERROR_CORRECTION_EXT_TYPE]: () => ({tokens: ["", ""], error_index: 0, accept: []}),
    [READING_COMPREHENSION_EXT_TYPE]: () => ({
        passage: "",
        questions: [blankSubQuestion(false)],
    }),
    [GRADED_QUIZ_EXT_TYPE]: () => ({
        pass_threshold: 60,
        questions: [blankSubQuestion(true)],
    }),
    [DICTATION_EXT_TYPE]: () => ({audio: "", accept: []}),
};

/**
 * Build an EMPTY extension exercise of ``extType`` (deliberately invalid
 * until filled). Same ``ContentLessonExercise`` shape a real one has: the
 * type-specific data lives under ``ext_payload``.
 */
export function createBlankExtensionExercise(
    extType: ExtensionWizardType,
    id: string,
): ContentLessonExercise {
    return {
        id,
        type: extType,
        prompt: "",
        card_ids: [],
        distractors: [],
        ext_payload: BLANK_PAYLOAD[extType](),
    } as ContentLessonExercise;
}

/**
 * Validate an extension exercise draft for the inline editor. Checks the
 * common prompt, then delegates to the shipped payload validator (plus a
 * wizard-level non-empty-category-name rule for categorization). Returns the
 * first failure (as a machine {@link ExtensionEditCode}) or ``{valid: true}``.
 */
export function validateExtensionExercise(
    ex: ContentLessonExercise,
): ExtensionEditIssue {
    if (ex.prompt.trim().length < 1) return fail("prompt");
    if (ex.type === CATEGORIZATION_EXT_TYPE) {
        // The shipped payload validator does not require a non-empty category
        // name (uniqueness is enough for the load guard). The authoring wizard
        // does: an unnamed bucket renders as a blank label.
        const named = categorizationCategories(ex).every(
            (bucket) => bucket.name.trim().length > 0,
        );
        return categorizationPayloadErrors(ex).length === 0 && named
            ? ok
            : fail("categorization");
    }
    if (ex.type === ERROR_CORRECTION_EXT_TYPE) {
        return errorCorrectionPayloadErrors(ex).length === 0
            ? ok
            : fail("error_correction");
    }
    if (ex.type === READING_COMPREHENSION_EXT_TYPE) {
        return readingComprehensionPayloadErrors(ex).length === 0
            ? ok
            : fail("reading_comprehension");
    }
    if (ex.type === GRADED_QUIZ_EXT_TYPE) {
        return gradedQuizPayloadErrors(ex).length === 0
            ? ok
            : fail("graded_quiz");
    }
    if (ex.type === DICTATION_EXT_TYPE) {
        return dictationPayloadErrors(ex).length === 0 ? ok : fail("dictation");
    }
    // A type without a wizard editor is never blocked here.
    return ok;
}

function trimmedNonEmpty(values: string[] | undefined): string[] {
    return (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

function categorizationCategories(
    ex: ContentLessonExercise,
): {name: string; items: string[]}[] {
    const payload = ex.ext_payload as
        | {categories?: {name: string; items: string[]}[]}
        | undefined;
    return payload?.categories ?? [];
}

/** Clean one sub-question: trim the prompt + drop the unused branch (mc keeps
 *  non-empty-text options, free_text keeps non-empty accepts). Points are
 *  carried through only for graded-quiz. */
function normalizeSubQuestion(
    question: WizardSubQuestion,
    withPoints: boolean,
): RcQuestion | GqQuestion {
    const prompt = question.prompt.trim();
    const common =
        question.type === "multiple_choice"
            ? {
                  options: (question.options ?? [])
                      .map((o) => ({text: o.text.trim(), correct: o.correct === true}))
                      .filter((o) => o.text.length > 0),
              }
            : {accept: trimmedNonEmpty(question.accept)};
    const base = {prompt, type: question.type, ...common};
    if (!withPoints) return base as RcQuestion;
    return {
        ...base,
        points: Number.isFinite(question.points) ? (question.points as number) : 1,
        ...(question.type === "multiple_choice" && question.partial_credit
            ? {partial_credit: true}
            : {}),
    } as GqQuestion;
}

function normalizeSubQuestions(
    ex: ContentLessonExercise,
    withPoints: boolean,
): (RcQuestion | GqQuestion)[] {
    const payload = ex.ext_payload as {questions?: WizardSubQuestion[]} | undefined;
    return (payload?.questions ?? []).map((q) => normalizeSubQuestion(q, withPoints));
}

/**
 * Normalize a validated extension draft before it is committed: trim the
 * prompt + payload strings, drop empty categories/items/accepts/options.
 * ``error_correction`` tokens are POSITIONAL (``error_index`` points into
 * them), so they are trimmed in place, never dropped.
 */
export function normalizeExtensionExercise(
    ex: ContentLessonExercise,
): ContentLessonExercise {
    const prompt = ex.prompt.trim();
    if (ex.type === CATEGORIZATION_EXT_TYPE) {
        const payload = ex.ext_payload as
            | {categories?: {name: string; items: string[]}[]}
            | undefined;
        const categories = (payload?.categories ?? [])
            .map((c) => ({name: c.name.trim(), items: trimmedNonEmpty(c.items)}))
            .filter((c) => c.name.length > 0 && c.items.length > 0);
        return {...ex, prompt, ext_payload: {categories}} as ContentLessonExercise;
    }
    if (ex.type === ERROR_CORRECTION_EXT_TYPE) {
        const payload = ex.ext_payload as
            | {tokens?: string[]; error_index?: number; accept?: string[]}
            | undefined;
        const tokens = (payload?.tokens ?? []).map((t) => t.trim());
        const rawIndex = payload?.error_index ?? 0;
        const error_index = Math.min(
            Math.max(0, Math.trunc(rawIndex)),
            Math.max(0, tokens.length - 1),
        );
        return {
            ...ex,
            prompt,
            ext_payload: {tokens, error_index, accept: trimmedNonEmpty(payload?.accept)},
        } as ContentLessonExercise;
    }
    if (ex.type === READING_COMPREHENSION_EXT_TYPE) {
        const payload = ex.ext_payload as {passage?: string} | undefined;
        return {
            ...ex,
            prompt,
            ext_payload: {
                passage: (payload?.passage ?? "").trim(),
                questions: normalizeSubQuestions(ex, false),
            },
        } as ContentLessonExercise;
    }
    if (ex.type === GRADED_QUIZ_EXT_TYPE) {
        const payload = ex.ext_payload as {pass_threshold?: number} | undefined;
        return {
            ...ex,
            prompt,
            ext_payload: {
                pass_threshold: payload?.pass_threshold,
                questions: normalizeSubQuestions(ex, true),
            },
        } as ContentLessonExercise;
    }
    if (ex.type === DICTATION_EXT_TYPE) {
        const payload = ex.ext_payload as
            | {audio?: string; accept?: string[]}
            | undefined;
        return {
            ...ex,
            prompt,
            ext_payload: {
                audio: (payload?.audio ?? "").trim(),
                accept: trimmedNonEmpty(payload?.accept),
            },
        } as ContentLessonExercise;
    }
    return {...ex, prompt};
}
