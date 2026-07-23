import {describe, expect, it} from "vitest";

import {
    GRADED_QUIZ_EXT_TYPE,
    asGradedQuizPayload,
    canonicalAnswer,
    gradedQuizPayloadErrors,
    isPassed,
    mcQuestionResult,
    totalPoints,
} from "./graded-quiz";
import type {ContentLessonExercise} from "../../../storage/types";

/**
 * Engine-half core for the adopted extension ``ext:al-graded-quiz`` (#1579,
 * fourth adoption): a scored question set - points per question, optional
 * partial credit on multi-select, optional percentage pass_threshold. Mirrors
 * the engine example ``ext:ref-graded-quiz``. Free-text grading is the
 * renderer's job (shared isFreeTextCorrect); the core owns validation, the MC
 * points math, and the pass/fail decision.
 */

const exerciseWith = (payload: unknown): ContentLessonExercise =>
    ({
        id: "ex-gq-01",
        type: GRADED_QUIZ_EXT_TYPE,
        prompt: "Beantworte alle Fragen.",
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    }) as unknown as ContentLessonExercise;

const QUIZ = {
    pass_threshold: 60,
    questions: [
        {prompt: "2+2?", type: "multiple_choice", options: [{text: "4", correct: true}, {text: "5"}], points: 2},
        {prompt: "Synonym fuer schnell?", type: "free_text", accept: ["rasch"], points: 3},
        {
            prompt: "Primzahlen?",
            type: "multiple_choice",
            options: [{text: "2", correct: true}, {text: "3", correct: true}, {text: "4"}],
            points: 4,
            partial_credit: true,
        },
    ],
};

describe("asGradedQuizPayload", () => {
    it("reads a well-formed payload", () => {
        const payload = asGradedQuizPayload(exerciseWith(QUIZ));
        expect(payload?.questions).toHaveLength(3);
        expect(payload?.pass_threshold).toBe(60);
    });

    it("returns null for malformed shapes", () => {
        expect(asGradedQuizPayload(exerciseWith(undefined))).toBeNull();
        expect(asGradedQuizPayload(exerciseWith({questions: "x"}))).toBeNull();
        expect(asGradedQuizPayload(exerciseWith({questions: [{prompt: "x", type: "free_text"}]}))).toBeNull();
        expect(asGradedQuizPayload(exerciseWith({pass_threshold: "60", questions: []}))).toBeNull();
    });
});

describe("gradedQuizPayloadErrors (engine half)", () => {
    it("accepts the well-formed payload", () => {
        expect(gradedQuizPayloadErrors(exerciseWith(QUIZ))).toEqual([]);
    });

    it("rejects a malformed shape with a single error", () => {
        const errors = gradedQuizPayloadErrors(exerciseWith({pass_threshold: 60}));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("questions");
    });

    it("enforces question, prompt, type, MC, FT and points rules", () => {
        expect(gradedQuizPayloadErrors(exerciseWith({questions: []})).join(" ")).toContain("at least 1 question");
        expect(
            gradedQuizPayloadErrors(exerciseWith({questions: [{prompt: " ", type: "free_text", accept: ["x"], points: 1}]})).join(" "),
        ).toContain("non-empty prompt");
        expect(
            gradedQuizPayloadErrors(exerciseWith({questions: [{prompt: "x", type: "essay", accept: ["x"], points: 1}]})).join(" "),
        ).toContain("multiple_choice or free_text");
        expect(
            gradedQuizPayloadErrors(exerciseWith({questions: [{prompt: "x", type: "multiple_choice", options: [{text: "a", correct: true}], points: 1}]})).join(" "),
        ).toContain("2 options");
        expect(
            gradedQuizPayloadErrors(exerciseWith({questions: [{prompt: "x", type: "free_text", accept: [], points: 1}]})).join(" "),
        ).toContain("accept");
        expect(
            gradedQuizPayloadErrors(exerciseWith({questions: [{prompt: "x", type: "free_text", accept: ["x"], points: 0}]})).join(" "),
        ).toContain("positive points");
    });

    it("rejects a pass_threshold outside 0..100", () => {
        expect(gradedQuizPayloadErrors(exerciseWith({...QUIZ, pass_threshold: 120})).join(" ")).toContain("0..100");
    });
});

describe("scoring helpers", () => {
    const payload = asGradedQuizPayload(exerciseWith(QUIZ))!;

    it("mcQuestionResult: exact set correct -> full points", () => {
        expect(mcQuestionResult(payload.questions[0]!, ["4"])).toEqual({correct: true, earned: 2});
        expect(mcQuestionResult(payload.questions[0]!, ["5"])).toEqual({correct: false, earned: 0});
    });

    it("mcQuestionResult: partial credit is proportional and penalises wrong picks", () => {
        expect(mcQuestionResult(payload.questions[2]!, ["2", "3"])).toEqual({correct: true, earned: 4});
        expect(mcQuestionResult(payload.questions[2]!, ["2"])).toEqual({correct: false, earned: 2});
        expect(mcQuestionResult(payload.questions[2]!, ["2", "4"])).toEqual({correct: false, earned: 0});
    });

    it("totalPoints sums the question points", () => {
        expect(totalPoints(payload)).toBe(9);
    });

    it("isPassed compares the percentage to the threshold (no threshold -> always passed)", () => {
        expect(isPassed(payload, 9)).toBe(true);
        expect(isPassed(payload, 5)).toBe(false); // 55.5% < 60
        expect(isPassed(payload, 6)).toBe(true); // 66.6% >= 60
        const noThreshold = asGradedQuizPayload(exerciseWith({questions: QUIZ.questions}))!;
        expect(isPassed(noThreshold, 0)).toBe(true);
    });

    it("canonicalAnswer returns the correct option(s) / accept[0]", () => {
        expect(canonicalAnswer(payload.questions[0]!)).toBe("4");
        expect(canonicalAnswer(payload.questions[1]!)).toBe("rasch");
        expect(canonicalAnswer(payload.questions[2]!)).toBe("2, 3");
    });
});
