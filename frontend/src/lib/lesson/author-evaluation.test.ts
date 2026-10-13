import { describe, expect, it } from "vitest";

import { resolveAuthorEvaluation } from "./author-evaluation";

const GRADES = {
    scheme: "grades" as const,
    grades: [
        { min_percent: 0, label: "F" },
        { min_percent: 60, label: "D" },
        { min_percent: 86, label: "B", label_native: "gut" },
        { min_percent: 90, label: "A" },
    ],
};

describe("resolveAuthorEvaluation (#3736)", () => {
    it.each([
        ["no block", null],
        ["undefined block", undefined],
    ])("returns null without an evaluation block (%s)", (_name, evaluation) => {
        expect(resolveAuthorEvaluation(evaluation, 7, 10)).toBeNull();
    });

    it("returns null for an empty run, which has no percent", () => {
        expect(resolveAuthorEvaluation({ scheme: "pass_fail", pass_percent: 60 }, 0, 0)).toBeNull();
    });

    it("returns null for a score the run cannot have, instead of throwing", () => {
        expect(resolveAuthorEvaluation({ scheme: "pass_fail", pass_percent: 60 }, 11, 10)).toBeNull();
    });

    it.each([
        ["just below the mark", 5, false],
        ["at the mark (inclusive)", 6, true],
        ["above the mark", 7, true],
    ])("pass_fail at 60%%: %s", (_name, correct, passed) => {
        const result = resolveAuthorEvaluation({ scheme: "pass_fail", pass_percent: 60 }, correct, 10);
        expect(result?.outcome).toEqual({ scheme: "pass_fail", passed });
        expect(result?.passPercent).toBe(60);
    });

    it.each([
        ["86.25% between rows earns the row it reached", 69, 80, "B"],
        ["85.6% stays below 86 (no rounding before the lookup)", 107, 125, "D"],
        ["100% earns the top row", 10, 10, "A"],
        ["0% earns the bottom row", 0, 10, "F"],
    ])("grades: %s", (_name, correct, total, label) => {
        expect(resolveAuthorEvaluation(GRADES, correct, total)?.outcome.grade?.label).toBe(label);
    });

    it("carries title, report and the unrounded percent", () => {
        const result = resolveAuthorEvaluation(
            { scheme: "pass_fail", pass_percent: 60, title: "Pilotprüfung", report: "detailed" },
            2,
            3,
        );
        expect(result?.title).toBe("Pilotprüfung");
        expect(result?.report).toBe("detailed");
        expect(result?.percent).toBeCloseTo(66.6667, 3);
    });

    it("defaults to the percent scheme, compact report and no title", () => {
        const result = resolveAuthorEvaluation({ pass_percent: 70 }, 7, 10);
        expect(result?.outcome).toEqual({ scheme: "percent", passed: true });
        expect(result?.report).toBe("compact");
        expect(result?.title).toBeNull();
    });

    it("has no pass mark when the block names none", () => {
        const result = resolveAuthorEvaluation({ scheme: "percent" }, 7, 10);
        expect(result?.passPercent).toBeNull();
        expect(result?.outcome.passed).toBeUndefined();
    });
});
