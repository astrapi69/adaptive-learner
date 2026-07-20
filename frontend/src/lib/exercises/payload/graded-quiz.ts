/**
 * ``ext:al-graded-quiz`` core (#1579, fourth adoption) - a scored question
 * set: each question carries ``points``, multi-select questions may award
 * ``partial_credit`` (proportional), and an optional ``pass_threshold``
 * (percent) decides pass/fail. Mirrors the engine example
 * ``ext:ref-graded-quiz``.
 *
 * The learning app maps the quiz onto its per-question learning model: the
 * exercise SCORE (correct/total for XP) counts correct QUESTIONS, while the
 * POINTS and pass/fail are the formal test grade shown by the renderer. This
 * module owns validation, the MC points math, and the pass/fail decision;
 * free-text grading is the renderer's job (the shared isFreeTextCorrect
 * matcher), so this stays a pure, React-free module.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-graded-quiz@<major>``. */
export const GRADED_QUIZ_EXT_TYPE = "ext:al-graded-quiz";

export interface GqOption {
    text: string;
    correct?: boolean;
}

export interface GqQuestion {
    prompt: string;
    type: string;
    options?: GqOption[];
    accept?: string[];
    points: number;
    partial_credit?: boolean;
}

export interface GradedQuizPayload {
    pass_threshold?: number;
    questions: GqQuestion[];
}

const KNOWN_QUESTION_TYPES = new Set(["multiple_choice", "free_text"]);

/** True when ``value`` is a structurally-shaped scored question. */
function isGqQuestionShape(value: unknown): value is GqQuestion {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.prompt !== "string" || typeof candidate.type !== "string") return false;
    if (typeof candidate.points !== "number") return false;
    if (candidate.options !== undefined && !Array.isArray(candidate.options)) return false;
    if (candidate.accept !== undefined && !Array.isArray(candidate.accept)) return false;
    return true;
}

/** Read the payload, or null when it is not shaped right. */
export function asGradedQuizPayload(exercise: ContentLessonExercise): GradedQuizPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (payload.pass_threshold !== undefined && typeof payload.pass_threshold !== "number") return null;
    if (!Array.isArray(payload.questions) || !payload.questions.every(isGqQuestionShape)) return null;
    return {
        pass_threshold: payload.pass_threshold as number | undefined,
        questions: payload.questions as unknown as GqQuestion[],
    };
}

/** Validate one question's type-specific payload + points. */
function gqQuestionError(question: GqQuestion): string | null {
    if (question.prompt.trim() === "") return "questions need a non-empty prompt";
    if (!KNOWN_QUESTION_TYPES.has(question.type)) return "question type must be multiple_choice or free_text";
    if (question.type === "multiple_choice") {
        const options = question.options ?? [];
        if (options.length < 2 || options.filter((option) => option.correct === true).length < 1) {
            return "multiple_choice question needs at least 2 options and 1 correct";
        }
    }
    if (question.type === "free_text") {
        if ((question.accept ?? []).filter((entry) => entry.trim() !== "").length === 0) {
            return "free_text question needs a non-empty accept list";
        }
    }
    if (!(question.points > 0)) return "questions need positive points";
    return null;
}

/** ENGINE half: validate one ``ext:al-graded-quiz`` payload. Returns
 *  human-readable messages; empty when valid. */
export function gradedQuizPayloadErrors(exercise: ContentLessonExercise): string[] {
    const payload = asGradedQuizPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with questions ([{prompt, type, points, options?/accept?, partial_credit?}]) and an optional numeric pass_threshold`,
        ];
    }
    const errors: string[] = [];
    if (payload.questions.length === 0) {
        errors.push(`'${exercise.id}' needs at least 1 question`);
    }
    if (payload.pass_threshold !== undefined && (payload.pass_threshold < 0 || payload.pass_threshold > 100)) {
        errors.push(`'${exercise.id}' pass_threshold must be a percentage in 0..100`);
    }
    for (const question of payload.questions) {
        const questionError = gqQuestionError(question);
        if (questionError) errors.push(`'${exercise.id}' ${questionError}`);
    }
    return errors;
}

/** The canonical answer(s) of a question - the correct option(s) joined, or
 *  ``accept[0]`` - for the after-check solution and the SRS element key. */
export function canonicalAnswer(question: GqQuestion): string {
    if (question.type === "multiple_choice") {
        return (question.options ?? [])
            .filter((option) => option.correct === true)
            .map((option) => option.text)
            .join(", ");
    }
    if (question.type === "free_text") {
        return question.accept?.[0] ?? "";
    }
    return "";
}

/** Grade one multiple_choice question: exact-set is full points, else 0;
 *  ``partial_credit`` awards ``max(0, correct - wrong) / total_correct``. The
 *  ``correct`` flag (for XP/SRS) is true only on a fully-correct answer. */
export function mcQuestionResult(question: GqQuestion, chosen: readonly string[]): {correct: boolean; earned: number} {
    const options = question.options ?? [];
    const correct = new Set(options.filter((option) => option.correct === true).map((option) => option.text));
    const picked = new Set(chosen);
    const exact = picked.size === correct.size && [...picked].every((text) => correct.has(text));
    if (question.partial_credit === true) {
        const correctPicked = [...picked].filter((text) => correct.has(text)).length;
        const wrongPicked = [...picked].filter((text) => !correct.has(text)).length;
        const fraction = correct.size === 0 ? 0 : Math.max(0, correctPicked - wrongPicked) / correct.size;
        return {correct: exact, earned: fraction * question.points};
    }
    return {correct: exact, earned: exact ? question.points : 0};
}

/** Sum of all question points. */
export function totalPoints(payload: GradedQuizPayload): number {
    return payload.questions.reduce((sum, question) => sum + question.points, 0);
}

/** Whether ``earned`` points clear the pass threshold (no threshold -> always
 *  passed). */
export function isPassed(payload: GradedQuizPayload, earned: number): boolean {
    if (payload.pass_threshold === undefined) return true;
    const total = totalPoints(payload);
    return total > 0 && (earned / total) * 100 >= payload.pass_threshold;
}
