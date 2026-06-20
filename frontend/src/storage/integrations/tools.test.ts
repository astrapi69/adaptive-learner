/**
 * Tools + spaced-recommendation tests (Phase 10E).
 *
 * Pins the catalogue ranking + the five-band spaced policy
 * against the backend's logic.
 */

import {describe, expect, it} from "vitest";

import {
    buildSpacedRecommendations,
    rankTools,
    recencyFromCommits,
} from "./tools";

describe("rankTools", () => {
    it("empty profile keeps the authored order", () => {
        const ranked = rankTools({}, "en");
        expect(ranked.map((r) => r.name)).toEqual([
            "Anki",
            "NotebookLM",
            "Adaptive AI Prompt",
            "Excalidraw",
            "Obsidian",
        ]);
        for (const r of ranked) expect(r.score).toBe(0);
    });

    it("scores by summing profile weights across the tool's weight_keys", () => {
        // Anki = deductive(0.5) + error_based(0.5) = 1.0
        // Obsidian = deductive(0.5) + inductive(0.2) = 0.7
        // NotebookLM / Excalidraw = inductive(0.2) + contextual(0.2) = 0.4 (tied)
        const ranked = rankTools(
            {
                deductive: 0.5,
                error_based: 0.5,
                inductive: 0.2,
                contextual: 0.2,
            },
            "en",
        );
        expect(ranked[0].name).toBe("Anki");
        expect(ranked[0].score).toBe(1);
        expect(ranked[1].name).toBe("Obsidian");
        expect(ranked[1].score).toBeCloseTo(0.7, 4);
        // NotebookLM appears before Excalidraw on stable-sort tie-break
        // (NotebookLM precedes Excalidraw in the catalogue).
        expect(ranked[2].name).toBe("NotebookLM");
        expect(ranked[3].name).toBe("Excalidraw");
    });

    it("respects the lang switch (de/en)", () => {
        const en = rankTools({}, "en");
        const de = rankTools({}, "de");
        expect(en[0].why).toMatch(/Spaced-repetition/);
        expect(de[0].why).toMatch(/Spaced-Repetition/);
    });

    it("limit caps the output", () => {
        const ranked = rankTools({}, "en", 2);
        expect(ranked).toHaveLength(2);
    });
});

describe("buildSpacedRecommendations bands", () => {
    const profile = {
        deductive: 0.3,
        inductive: 0.3,
        error_based: 0.3,
        dialogic: 0.3,
        contextual: 0.3,
        ai_adaptive: 0.3,
    };

    it("never-practised method -> 'first' band, interval 1", () => {
        const cards = buildSpacedRecommendations(
            profile,
            {deductive: null},
            "en",
            6,
        );
        const ded = cards.find((c) => c.method === "deductive");
        expect(ded?.interval_days).toBe(1);
        expect(ded?.id).toBe("sr-deductive-first");
        expect(ded?.title).toContain("First practice");
    });

    it("> 14 days -> 'refresh' band", () => {
        const cards = buildSpacedRecommendations(
            profile,
            {deductive: 20},
            "en",
            6,
        );
        const ded = cards.find((c) => c.method === "deductive");
        expect(ded?.id).toBe("sr-deductive-refresh");
        expect(ded?.interval_days).toBe(1);
    });

    it("7-14 days -> 'review' band", () => {
        const cards = buildSpacedRecommendations(
            profile,
            {deductive: 10},
            "en",
            6,
        );
        const ded = cards.find((c) => c.method === "deductive");
        expect(ded?.id).toBe("sr-deductive-review");
        expect(ded?.interval_days).toBe(3);
    });

    it("3-7 days -> 'practice'; <3 days -> 'maintain'", () => {
        const cards = buildSpacedRecommendations(
            profile,
            {deductive: 5, inductive: 1},
            "en",
            6,
        );
        const ded = cards.find((c) => c.method === "deductive");
        const ind = cards.find((c) => c.method === "inductive");
        expect(ded?.id).toBe("sr-deductive-practice");
        expect(ind?.id).toBe("sr-inductive-maintain");
    });

    it("skips zero-weight methods", () => {
        const cards = buildSpacedRecommendations(
            {deductive: 0, inductive: 0.5},
            {inductive: null},
            "en",
            6,
        );
        expect(cards.map((c) => c.method)).toEqual(["inductive"]);
    });

    it("sorts by urgency (lower = higher priority)", () => {
        const cards = buildSpacedRecommendations(
            {deductive: 0.9, inductive: 0.1},
            {deductive: null, inductive: 5}, // ded: first (1), ind: practice (7)
            "en",
            6,
        );
        // urgency: deductive = 1 - 0.9 = 0.1, inductive = 7 - 0.1 = 6.9
        expect(cards[0].method).toBe("deductive");
    });
});

describe("recencyFromCommits", () => {
    it("returns null for untouched methods", () => {
        const r = recencyFromCommits([]);
        for (const m of [
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ] as const) {
            expect(r[m]).toBeNull();
        }
    });

    it("computes days-since-most-recent commit per method", () => {
        // ``today`` resolves to 2026-05-20T00:00Z. A commit at
        // 2026-05-10T00:00Z is exactly 10 days back.
        const r = recencyFromCommits(
            [
                {method: "deductive", committed_at: "2026-05-09T00:00:00.000Z"},
                {method: "deductive", committed_at: "2026-05-19T00:00:00.000Z"},
                {method: "inductive", committed_at: "2026-05-10T00:00:00.000Z"},
            ],
            "2026-05-20",
        );
        expect(r.deductive).toBeCloseTo(1, 1);
        expect(r.inductive).toBeCloseTo(10, 1);
        expect(r.contextual).toBeNull();
    });
});
