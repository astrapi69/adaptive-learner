import {describe, expect, it} from "vitest";

import {buildAnalysisContext} from "./prompts";
import type {ConversationAnalysisResult} from "../types/domain";

const RICH: ConversationAnalysisResult = {
    topic: "Spanish past tense",
    summary: "Practised the preterite.",
    user_level: "intermediate",
    strengths: ["vocabulary recall"],
    weaknesses: ["irregular verbs"],
    error_patterns: ["confuses ser/estar"],
    vocabulary: [
        {word: "tener", translation: "to have"},
        {word: "hacer", translation: "to do"},
    ],
    suggested_curriculum: [
        {title: "Irregular preterite drill", description: "", priority: 1},
    ],
};

describe("buildAnalysisContext", () => {
    it("renders every field in German", () => {
        const out = buildAnalysisContext(RICH, "de");
        expect(out).toContain("Spanish past tense");
        expect(out).toContain("Zusammenfassung:");
        expect(out).toContain("Niveau: intermediate");
        expect(out).toContain("Stärken: vocabulary recall");
        expect(out).toContain("Schwächen: irregular verbs");
        expect(out).toContain("Fehlermuster: confuses ser/estar");
        expect(out).toContain("tener");
        expect(out).toContain("hacer");
        expect(out).toContain("Irregular preterite drill");
        expect(out).toContain("Setze die Lernsitzung fort");
    });

    it("renders every field in English", () => {
        const out = buildAnalysisContext(RICH, "en");
        expect(out).toContain('about "Spanish past tense"');
        expect(out).toContain("Weaknesses: irregular verbs");
        expect(out).toContain("Vocabulary already learned:");
        expect(out).toContain("Continue the learning session");
    });

    it("returns empty string when nothing useful is present", () => {
        expect(buildAnalysisContext(null, "de")).toBe("");
        expect(buildAnalysisContext({}, "en")).toBe("");
        expect(
            buildAnalysisContext({strengths: [], vocabulary: []}, "de"),
        ).toBe("");
    });

    it("skips missing fields but keeps the continue instruction", () => {
        const out = buildAnalysisContext({topic: "Greetings"}, "en");
        expect(out).toContain('about "Greetings"');
        expect(out).not.toContain("Summary:");
        expect(out).not.toContain("Weaknesses:");
        expect(out).toContain("Continue the learning session");
    });
});
