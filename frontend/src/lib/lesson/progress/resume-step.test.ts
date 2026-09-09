import {describe, expect, it} from "vitest";

import {resumeStepIndex, resumeStepNumber} from "./resume-step";

const IDS = ["intro", "formality", "ex-match", "merci", "ex-cloze"];
const row = (over: Partial<{status: string; step_results: Record<string, unknown>; current_step: number | null}>) => ({
    status: "in_progress",
    step_results: {},
    current_step: 0,
    ...over,
});

describe("resumeStepIndex (#41, #3076)", () => {
    it("starts at 0 without a row or with an untouched row", () => {
        expect(resumeStepIndex(IDS, null)).toBe(0);
        expect(resumeStepIndex(IDS, row({}))).toBe(0);
    });

    it("resumes after the furthest graded exercise", () => {
        expect(resumeStepIndex(IDS, row({step_results: {"ex-match": {}}}))).toBe(3);
    });

    it("prefers the persisted position when it is further (theory steps write no result)", () => {
        expect(resumeStepIndex(IDS, row({step_results: {"ex-match": {}}, current_step: 3}))).toBe(3);
        expect(resumeStepIndex(IDS, row({current_step: 1}))).toBe(1);
    });

    it("never falls behind a graded result because of a stale position", () => {
        expect(resumeStepIndex(IDS, row({step_results: {"ex-match": {}}, current_step: 2}))).toBe(3);
    });

    it("lands on the summary for a completed run and clamps beyond the lesson", () => {
        expect(resumeStepIndex(IDS, row({status: "completed", current_step: 1}))).toBe(5);
        expect(resumeStepIndex(IDS, row({current_step: 42}))).toBe(5);
    });

    it("tolerates a pre-#41 row without current_step", () => {
        expect(resumeStepIndex(IDS, row({step_results: {intro: {}}, current_step: null}))).toBe(1);
    });
});

describe("resumeStepNumber (#3076)", () => {
    it("is the 1-based resume step", () => {
        expect(resumeStepNumber(IDS, row({current_step: 3}))).toBe(4);
        expect(resumeStepNumber(IDS, null)).toBe(1);
    });

    it("reads N/N on the summary and 0 for a lesson without steps", () => {
        expect(resumeStepNumber(IDS, row({current_step: 5}))).toBe(5);
        expect(resumeStepNumber([], row({}))).toBe(0);
    });
});
