import {describe, expect, it} from "vitest";

import {
    AI_PROVIDERS,
    CYCLE_STEPS,
    LEARNING_METHODS,
    METHOD_COLORS,
    MODEL_SUGGESTIONS,
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

describe("AI_PROVIDERS", () => {
    it("orders providers anthropic-first, NOT alphabetically", () => {
        // Load-bearing: every Settings dropdown, the API-keys
        // section, and the model-overrides section drives its
        // rendering off this constant. Anthropic is the user's
        // preferred provider and the app's recommended default;
        // a future "looks alphabetical, let me tidy it" refactor
        // would silently put Anthropic, Gemini, OpenAI — wrong.
        expect(AI_PROVIDERS).toEqual(["anthropic", "openai", "gemini", "perplexity"]);
        expect(AI_PROVIDERS[0]).toBe("anthropic");
    });

    it("MODEL_SUGGESTIONS has an entry for every provider", () => {
        for (const provider of AI_PROVIDERS) {
            expect(MODEL_SUGGESTIONS[provider]).toBeDefined();
            expect(MODEL_SUGGESTIONS[provider].length).toBeGreaterThan(0);
        }
    });
});
