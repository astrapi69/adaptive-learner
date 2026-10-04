import {describe, expect, it} from "vitest";

import {resumeStepIndex, resumeStepNumber} from "./resume-step";
import type {ResumeProgressRow} from "./resume-step";
import type {LessonStepEventStored} from "../../../storage/types";

const IDS = ["intro", "formality", "ex-match", "merci", "ex-cloze"];
const row = (over: Partial<ResumeProgressRow>): ResumeProgressRow => ({
    status: "in_progress",
    step_results: {},
    current_step: 0,
    ...over,
});
const event = (
    kind: LessonStepEventStored["kind"],
    stepIndex: number,
    stepId: string | null,
): LessonStepEventStored => ({at: "2026-10-03T10:00:00Z", kind, step_index: stepIndex, step_id: stepId});

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

describe("resumeStepIndex by the last step entry (#3365)", () => {
    it("lands on the step the learner was last on, also behind a graded result", () => {
        const recent = [event("step", 2, "ex-match"), event("answer", 2, "ex-match"), event("step", 1, "formality")];
        expect(
            resumeStepIndex(IDS, row({step_results: {"ex-match": {}}, current_step: 1, recent_steps: recent})),
        ).toBe(1);
    });

    it("finds the step by id when the lesson was reordered since", () => {
        const recent = [event("step", 1, "merci")];
        expect(resumeStepIndex(IDS, row({current_step: 1, recent_steps: recent}))).toBe(3);
    });

    it("skips answers, pauses and exits logged after the step", () => {
        const recent = [event("step", 1, "formality"), event("pause", 1, "formality"), event("exit", 1, "formality")];
        expect(resumeStepIndex(IDS, row({status: "paused", current_step: 4, recent_steps: recent}))).toBe(1);
    });

    it.each([
        {name: "step id no longer in the lesson", recent: [event("step", 3, "gone")], expected: 4},
        {name: "only steps before a restart", recent: [event("step", 3, "merci"), event("restart", 3, "merci")], expected: 4},
        {name: "only steps before a completion", recent: [event("step", 4, "ex-cloze"), event("complete", 5, null)], expected: 4},
        {name: "no step entry at all", recent: [event("answer", 2, "ex-match")], expected: 4},
        {name: "pre-#3365 row without the list", recent: undefined, expected: 4},
    ])("falls back to the position rule: $name", ({recent, expected}) => {
        expect(resumeStepIndex(IDS, row({current_step: 4, recent_steps: recent}))).toBe(expected);
    });

    it.each([
        {status: "completed", expected: 5},
        {status: "abandoned", expected: 0},
    ])("ignores the entries of a $status row", ({status, expected}) => {
        const recent = [event("step", 3, "merci")];
        expect(resumeStepIndex(IDS, row({status, current_step: 0, recent_steps: recent}))).toBe(expected);
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
