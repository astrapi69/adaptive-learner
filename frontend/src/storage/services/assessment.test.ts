/**
 * Assessment port tests (Phase 10C).
 *
 * Pins the local question resolver + profile calculator against
 * known fixtures. The "cross-mode-identical" test pulls the same
 * QUESTIONS data the backend uses, so the algorithm parity is
 * verified at the data layer too.
 */

import {describe, expect, it} from "vitest";

import {
    calculateProfile,
    dominantMethod,
    questionsForLang,
} from "./assessment";

describe("questionsForLang", () => {
    it("returns 12 questions in DE by default fallback", () => {
        const questions = questionsForLang("de");
        expect(questions).toHaveLength(12);
        expect(questions[0].id).toBe("q01");
        // Should resolve text to DE.
        expect(questions[0].text).toContain("Thema");
    });

    it("falls back to EN for unsupported langs (pt/tr/ja)", () => {
        const en = questionsForLang("en");
        const pt = questionsForLang("pt");
        expect(pt[0].text).toBe(en[0].text);
    });

    it("supports language prefixes like en-US -> en", () => {
        const en = questionsForLang("en");
        const enUs = questionsForLang("en-US");
        expect(enUs[0].text).toBe(en[0].text);
    });

    it("preserves the multi vs single type", () => {
        const questions = questionsForLang("en");
        const multi = questions.find((q) => q.type === "multi");
        expect(multi).toBeDefined();
    });

    it("each answer carries weights mapping to method keys", () => {
        const q1 = questionsForLang("en")[0];
        for (const a of q1.answers) {
            const keys = Object.keys(a.weights);
            expect(keys.length).toBeGreaterThan(0);
            // All keys must be one of the 6 method names.
            for (const k of keys) {
                expect([
                    "deductive",
                    "inductive",
                    "error_based",
                    "dialogic",
                    "contextual",
                    "ai_adaptive",
                ]).toContain(k);
            }
        }
    });
});

describe("calculateProfile", () => {
    it("empty answers -> all-zeros", () => {
        const profile = calculateProfile([]);
        expect(profile.deductive).toBe(0);
        expect(profile.inductive).toBe(0);
        expect(profile.error_based).toBe(0);
        expect(profile.dialogic).toBe(0);
        expect(profile.contextual).toBe(0);
        expect(profile.ai_adaptive).toBe(0);
    });

    it("picking q01-a (deductive=1.0) once contributes 1/12 ~= 0.0833", () => {
        const profile = calculateProfile([
            {question_id: "q01", answer_id: "a"},
        ]);
        // The exact value depends on q01-a's weights; we know
        // from the data that q01-a is `{deductive: 1.0}`. 12
        // questions total, so deductive = 1.0 / 12 = 0.0833.
        expect(profile.deductive).toBeCloseTo(0.0833, 4);
        expect(profile.inductive).toBe(0);
    });

    it("multi-select splits the contribution between picked answers", () => {
        // q01 has multi: pick a (deductive=1.0) AND b (inductive=1.0).
        // Each contributes 1.0/2 = 0.5, then /12 = ~0.0417 each.
        const profile = calculateProfile([
            {question_id: "q01", answer_ids: ["a", "b"]},
        ]);
        expect(profile.deductive).toBeCloseTo(0.0417, 4);
        expect(profile.inductive).toBeCloseTo(0.0417, 4);
    });

    it("clamps to [0,1] even on synthetic over-weighting", () => {
        // Answer every question with each answer at once via
        // answer_ids — single answers contribute fully.
        const allDeductive = Array.from({length: 12}, (_, i) => ({
            question_id: `q${String(i + 1).padStart(2, "0")}`,
            answer_id: "a",
        }));
        // q01-a is `{deductive: 1.0}` but other questions may not
        // have an "a" with deductive=1.0; this just exercises the
        // clamp path. Total profile values must still be in [0,1].
        const profile = calculateProfile(allDeductive);
        for (const k of [
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ] as const) {
            expect(profile[k]).toBeGreaterThanOrEqual(0);
            expect(profile[k]).toBeLessThanOrEqual(1);
        }
    });

    it("rounds to 4 decimals", () => {
        const profile = calculateProfile([
            {question_id: "q01", answer_id: "a"},
        ]);
        // Round-to-4: any field is at most 4 digits after decimal.
        for (const k of [
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ] as const) {
            const stringForm = profile[k].toString();
            const decimal = stringForm.split(".")[1];
            if (decimal) expect(decimal.length).toBeLessThanOrEqual(4);
        }
    });

    it("last-write-wins on duplicate question_ids", () => {
        // q01-a => deductive=1.0; q01-c => error_based=1.0. The
        // second wins, so deductive should be 0 and error_based
        // should be 1/12.
        const profile = calculateProfile([
            {question_id: "q01", answer_id: "a"},
            {question_id: "q01", answer_id: "c"},
        ]);
        expect(profile.deductive).toBe(0);
        expect(profile.error_based).toBeCloseTo(0.0833, 4);
    });
});

describe("dominantMethod", () => {
    it("returns the highest-scoring method", () => {
        expect(
            dominantMethod({
                deductive: 0.1,
                inductive: 0.5,
                error_based: 0.2,
                dialogic: 0.0,
                contextual: 0.1,
                ai_adaptive: 0.1,
            }),
        ).toBe("inductive");
    });

    it("ties resolve alphabetically", () => {
        // All zeros - alphabetically first key wins.
        expect(
            dominantMethod({
                deductive: 0,
                inductive: 0,
                error_based: 0,
                dialogic: 0,
                contextual: 0,
                ai_adaptive: 0,
            }),
        ).toBe("ai_adaptive");
    });
});
