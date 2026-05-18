import {describe, expect, it} from "vitest";

import {
    CYCLE_STEPS,
    LEARNING_METHODS,
    METHOD_COLORS,
    cycleStepForIndex,
    isLearningMethod,
} from "./constants";

describe("LEARNING_METHODS + METHOD_COLORS", () => {
    it("exposes the six canonical method keys", () => {
        expect(LEARNING_METHODS).toEqual([
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ]);
    });

    it("pins the project-reference §3.1 hex palette", () => {
        expect(METHOD_COLORS).toEqual({
            deductive: "#3B82F6",
            inductive: "#8B5CF6",
            error_based: "#EF4444",
            dialogic: "#10B981",
            contextual: "#F59E0B",
            ai_adaptive: "#6366F1",
        });
    });

    it("isLearningMethod narrows known strings", () => {
        expect(isLearningMethod("deductive")).toBe(true);
        expect(isLearningMethod("error_based")).toBe(true);
        expect(isLearningMethod("nonsense")).toBe(false);
    });
});

describe("CYCLE_STEPS", () => {
    it("returns the canonical 7-step list in order", () => {
        expect(CYCLE_STEPS).toEqual([
            "input",
            "attempt",
            "error",
            "feedback",
            "adapt",
            "repeat",
            "integrate",
        ]);
    });

    it("cycleStepForIndex maps 1..7 to the step key", () => {
        expect(cycleStepForIndex(1)).toBe("input");
        expect(cycleStepForIndex(4)).toBe("feedback");
        expect(cycleStepForIndex(7)).toBe("integrate");
    });

    it("cycleStepForIndex throws on out-of-range input", () => {
        expect(() => cycleStepForIndex(0)).toThrow(/out of range/);
        expect(() => cycleStepForIndex(8)).toThrow(/out of range/);
        expect(() => cycleStepForIndex(-1)).toThrow(/out of range/);
    });
});
