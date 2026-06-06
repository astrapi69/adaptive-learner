import {afterEach, describe, expect, it} from "vitest";

import {
    clearAssessmentProgress,
    hasIncompleteAssessment,
    readAssessmentProgress,
    writeAssessmentProgress,
    type AssessmentProgress,
} from "./assessmentProgress";

const PROJECT = "proj-1";
const sample: AssessmentProgress = {
    currentQuestion: 5,
    answers: {q1: ["a"], q2: ["b", "c"]},
    startedAt: "2026-06-06T10:00:00.000Z",
};

afterEach(() => {
    try {
        localStorage.clear();
    } catch {
        /* no-op */
    }
});

describe("assessment progress persistence", () => {
    it("returns null when nothing is saved", () => {
        expect(readAssessmentProgress(PROJECT)).toBeNull();
        expect(hasIncompleteAssessment(PROJECT)).toBe(false);
    });

    it("round-trips saved progress", () => {
        writeAssessmentProgress(PROJECT, sample);
        expect(readAssessmentProgress(PROJECT)).toEqual(sample);
        expect(hasIncompleteAssessment(PROJECT)).toBe(true);
    });

    it("scopes progress per project", () => {
        writeAssessmentProgress(PROJECT, sample);
        expect(readAssessmentProgress("other")).toBeNull();
    });

    it("clears progress", () => {
        writeAssessmentProgress(PROJECT, sample);
        clearAssessmentProgress(PROJECT);
        expect(readAssessmentProgress(PROJECT)).toBeNull();
        expect(hasIncompleteAssessment(PROJECT)).toBe(false);
    });

    it("treats a no-answers progress as not started", () => {
        writeAssessmentProgress(PROJECT, {...sample, answers: {}});
        expect(hasIncompleteAssessment(PROJECT)).toBe(false);
    });

    it("is null-safe on a missing project id", () => {
        expect(readAssessmentProgress(null)).toBeNull();
        expect(hasIncompleteAssessment(null)).toBe(false);
        expect(() => writeAssessmentProgress(null, sample)).not.toThrow();
        expect(() => clearAssessmentProgress(null)).not.toThrow();
    });

    it("ignores corrupt stored data", () => {
        localStorage.setItem(
            "adaptive-learner.assessment.progress.proj-1",
            "{not json",
        );
        expect(readAssessmentProgress(PROJECT)).toBeNull();
    });
});
