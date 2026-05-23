/**
 * Tests for the help-glossary loader (Phase 38B).
 *
 * Pins:
 * - ``getGlossaryEntry`` returns the correct entry per
 *   language with the canonical shape.
 * - ``getGlossaryEntry`` falls back to EN for unsupported
 *   languages (lingua-franca contract).
 * - Region codes (``de-DE``) resolve to their base (``de``).
 * - Missing keys return ``null`` (no throw).
 * - ``listGlossaryEntries`` returns entries in stable order
 *   (concepts -> methods -> steps -> features).
 * - Category filter narrows the list.
 */

import {describe, expect, it} from "vitest";

import {
    getGlossaryEntry,
    listGlossaryEntries,
} from "./help-glossary";

describe("getGlossaryEntry", () => {
    it("returns the German entry for a known key + lang", () => {
        const entry = getGlossaryEntry("curriculum", "de");
        expect(entry).not.toBeNull();
        expect(entry!.key).toBe("curriculum");
        expect(entry!.title).toBe("Curriculum");
        expect(entry!.short).toMatch(/strukturierter Lernplan/);
        expect(entry!.long).toContain("## ");
        expect(entry!.category).toBe("concepts");
    });

    it("returns the English entry for lang=en", () => {
        const entry = getGlossaryEntry("learning_session", "en");
        expect(entry).not.toBeNull();
        expect(entry!.title).toBe("Learning Session");
    });

    it("falls back to EN for unsupported language codes", () => {
        const entry = getGlossaryEntry("curriculum", "xx");
        expect(entry).not.toBeNull();
        expect(entry!.title).toBe("Curriculum");
        // English-language content marker.
        expect(entry!.short).toMatch(/structured learning plan/);
    });

    it("resolves region codes to their base language", () => {
        const entry = getGlossaryEntry("curriculum", "de-DE");
        expect(entry).not.toBeNull();
        // German-language content marker.
        expect(entry!.short).toMatch(/strukturierter Lernplan/);
    });

    it("returns null for missing keys", () => {
        expect(getGlossaryEntry("does-not-exist", "en")).toBeNull();
    });

    it("returns the canonical entry for every method key", () => {
        const methodKeys = [
            "method_deductive",
            "method_inductive",
            "method_error_based",
            "method_dialogic",
            "method_contextual",
            "method_ai_adaptive",
        ];
        for (const key of methodKeys) {
            const entry = getGlossaryEntry(key, "en");
            expect(entry, `${key} missing in EN`).not.toBeNull();
            expect(entry!.category).toBe("methods");
        }
    });

    it("returns the canonical entry for every step key", () => {
        const stepKeys = [
            "step_input",
            "step_attempt",
            "step_error",
            "step_feedback",
            "step_adapt",
            "step_repeat",
            "step_integrate",
        ];
        for (const key of stepKeys) {
            const entry = getGlossaryEntry(key, "de");
            expect(entry, `${key} missing in DE`).not.toBeNull();
            expect(entry!.category).toBe("steps");
        }
    });
});

describe("listGlossaryEntries", () => {
    it("returns all 22 entries when called with no category filter", () => {
        const entries = listGlossaryEntries("en");
        expect(entries.length).toBe(22);
    });

    it("returns entries in stable category order", () => {
        const entries = listGlossaryEntries("en");
        const categoryOrder: string[] = [];
        let lastCategory = "";
        for (const entry of entries) {
            if (entry.category !== lastCategory) {
                categoryOrder.push(entry.category);
                lastCategory = entry.category;
            }
        }
        expect(categoryOrder).toEqual([
            "concepts",
            "methods",
            "steps",
            "features",
        ]);
    });

    it("respects the category filter", () => {
        const concepts = listGlossaryEntries("en", {category: "concepts"});
        expect(concepts.length).toBe(4);
        expect(concepts.every((e) => e.category === "concepts")).toBe(true);
    });

    it("returns each key exactly once across categories", () => {
        const entries = listGlossaryEntries("de");
        const keys = entries.map((e) => e.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
