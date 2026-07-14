/**
 * ``ext:al-reading-comprehension`` core (#1579, third adoption) - a shared
 * ``passage`` (stimulus) bound to N sub-questions. The flat core schema cannot
 * express this (``LessonStep.exercise`` is singular), so it is modelled as a
 * single ext exercise whose ``ext_payload`` carries the passage plus the
 * questions, mirroring the engine example ``ext:ref-reading-comprehension``
 * (engine#43, decided as an extension rather than a core-schema change).
 *
 * Sub-questions reuse the core ``multiple_choice`` / ``free_text`` shapes; the
 * renderer composes the existing grading (exact option for MC, the shared
 * ``isFreeTextCorrect`` matcher for free_text, inheriting the #1580
 * normalization). This module is the ENGINE half (payload validation) plus
 * pure helpers - no React, no matcher import.
 */

import type {ContentLessonExercise} from "../../storage/types";

/** The adopted extension type; declared as
 *  ``ext:al-reading-comprehension@<major>``. */
export const READING_COMPREHENSION_EXT_TYPE = "ext:al-reading-comprehension";

/** One answer option of a ``multiple_choice`` sub-question. */
export interface RcQuestionOption {
    text: string;
    correct?: boolean;
}

/** One sub-question: a prompt plus a core question shape. */
export interface RcQuestion {
    prompt: string;
    type: string;
    options?: RcQuestionOption[];
    accept?: string[];
}

/** The ``ext_payload`` shape ``ext:al-reading-comprehension`` expects. */
export interface ReadingComprehensionPayload {
    passage: string;
    questions: RcQuestion[];
}

const KNOWN_QUESTION_TYPES = new Set(["multiple_choice", "free_text"]);

/** True when ``value`` is a structurally-shaped sub-question. */
function isRcQuestionShape(value: unknown): value is RcQuestion {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.prompt !== "string" || typeof candidate.type !== "string") {
        return false;
    }
    if (candidate.options !== undefined && !Array.isArray(candidate.options)) return false;
    if (candidate.accept !== undefined && !Array.isArray(candidate.accept)) return false;
    return true;
}

/** Read the payload, or null when it is not shaped right. */
export function asReadingComprehensionPayload(
    exercise: ContentLessonExercise,
): ReadingComprehensionPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.passage !== "string") return null;
    if (!Array.isArray(payload.questions) || !payload.questions.every(isRcQuestionShape)) {
        return null;
    }
    return {
        passage: payload.passage,
        questions: payload.questions as RcQuestion[],
    };
}

/** Validate one sub-question's type-specific payload. Returns a single
 *  message or empty. */
function rcQuestionError(question: RcQuestion): string | null {
    if (question.prompt.trim() === "") {
        return "questions need a non-empty prompt";
    }
    if (!KNOWN_QUESTION_TYPES.has(question.type)) {
        return "question type must be multiple_choice or free_text";
    }
    if (question.type === "multiple_choice") {
        const options = question.options ?? [];
        const correctCount = options.filter((option) => option.correct === true).length;
        if (options.length < 2 || correctCount < 1) {
            return "multiple_choice question needs at least 2 options and 1 correct";
        }
    }
    if (question.type === "free_text") {
        const accept = (question.accept ?? []).filter((entry) => entry.trim() !== "");
        if (accept.length === 0) {
            return "free_text question needs a non-empty accept list";
        }
    }
    return null;
}

/** ENGINE half: validate one ``ext:al-reading-comprehension`` payload.
 *  Returns human-readable messages; empty when valid. */
export function readingComprehensionPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asReadingComprehensionPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with passage (string) and questions ([{prompt, type, options?/accept?}])`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.passage.trim() === "") {
        payloadErrors.push(`'${exercise.id}' needs a non-empty passage`);
    }
    if (payload.questions.length === 0) {
        payloadErrors.push(`'${exercise.id}' needs at least 1 question`);
    }
    for (const question of payload.questions) {
        const questionError = rcQuestionError(question);
        if (questionError) payloadErrors.push(`'${exercise.id}' ${questionError}`);
    }
    return payloadErrors;
}

/** The canonical answer of a sub-question (multiple_choice: first correct
 *  option text; free_text: ``accept[0]``). Empty string when none - used as
 *  the SRS element key and the after-wrong-attempt solution. */
export function canonicalAnswer(question: RcQuestion): string {
    if (question.type === "multiple_choice") {
        const firstCorrect = (question.options ?? []).find((option) => option.correct === true);
        return firstCorrect?.text ?? "";
    }
    if (question.type === "free_text") {
        return question.accept?.[0] ?? "";
    }
    return "";
}
