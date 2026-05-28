/**
 * Unit tests for the error analyzer (Phase 53A / v1.36.0 /
 * Q-113, Q-114). Cross-language parity is pinned separately in
 * ``error-analyzer.parity.test.ts``; this file covers shape +
 * edge cases that don't need a Python golden.
 */

import {describe, expect, it} from "vitest";

import type {ElementError} from "../../storage/types";

import {analyzeErrors, recencyWeight} from "./error-analyzer";

const NOW = "2026-05-28T12:00:00Z";
const NOW_DATE = new Date(NOW);

function makeError(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: overrides.id ?? "elem-1",
        user_id: "user-1",
        set_id: overrides.set_id ?? "language-fr-a1",
        lesson_id: overrides.lesson_id ?? "01-greetings.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_key: overrides.element_key ?? "bonjour",
        element_type: overrides.element_type ?? "vocabulary",
        user_answer: overrides.user_answer ?? "bonjur",
        correct_answer: overrides.correct_answer ?? "bonjour",
        error_count: overrides.error_count ?? 1,
        correct_streak: overrides.correct_streak ?? 0,
        last_error_at: overrides.last_error_at ?? NOW,
        last_attempt_at: overrides.last_attempt_at ?? NOW,
        mastered: overrides.mastered ?? false,
        mastered_at: overrides.mastered_at ?? null,
        created_at: overrides.created_at ?? NOW,
        updated_at: overrides.updated_at ?? NOW,
    };
}

describe("recencyWeight", () => {
    it("returns 1.0 for errors less than a day old", () => {
        expect(recencyWeight("2026-05-28T08:00:00Z", NOW_DATE)).toBe(1.0);
    });

    it("returns 0.8 for errors 1-2 days old", () => {
        expect(recencyWeight("2026-05-27T08:00:00Z", NOW_DATE)).toBe(0.8);
    });

    it("returns 0.5 for errors 2-7 days old", () => {
        expect(recencyWeight("2026-05-25T12:00:00Z", NOW_DATE)).toBe(0.5);
    });

    it("returns 0.3 for errors 7+ days old", () => {
        expect(recencyWeight("2026-05-10T12:00:00Z", NOW_DATE)).toBe(0.3);
    });

    it("returns 0.3 for null last_error_at (degrades gracefully)", () => {
        expect(recencyWeight(null, NOW_DATE)).toBe(0.3);
    });

    it("returns 0.3 for unparsable ISO strings", () => {
        expect(recencyWeight("not-a-date", NOW_DATE)).toBe(0.3);
    });

    it("flips to 0.8 exactly at the 1-day boundary", () => {
        const oneDayAgo = "2026-05-27T12:00:00Z";
        expect(recencyWeight(oneDayAgo, NOW_DATE)).toBe(0.8);
    });
});

describe("analyzeErrors — empty + edge cases (Q-116)", () => {
    it("returns empty analysis on empty input", () => {
        const result = analyzeErrors([], {now: NOW});
        expect(result.prioritized_elements).toEqual([]);
        expect(result.error_clusters).toEqual([]);
        expect(result.weakness_profile).toEqual({});
        expect(result.suggested_focus).toEqual([]);
        expect(result.total_errors).toBe(0);
        expect(result.active_elements).toBe(0);
    });

    it("excludes mastered elements from analysis", () => {
        const errors = [
            makeError({id: "a", element_key: "a", mastered: true, error_count: 5}),
            makeError({id: "b", element_key: "b", mastered: false, error_count: 2}),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.active_elements).toBe(1);
        expect(result.prioritized_elements[0].element_key).toBe("b");
    });

    it("excludes zero-error rows (correct first attempt)", () => {
        const errors = [
            makeError({id: "a", element_key: "a", error_count: 0}),
            makeError({id: "b", element_key: "b", error_count: 3}),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.active_elements).toBe(1);
        expect(result.prioritized_elements[0].element_key).toBe("b");
    });

    it("handles a single error", () => {
        const errors = [makeError({error_count: 1})];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.prioritized_elements).toHaveLength(1);
        expect(result.suggested_focus).toHaveLength(1);
        expect(result.error_clusters).toEqual([]);
    });
});

describe("analyzeErrors — priority scoring (Q-114)", () => {
    it("sorts by error_count * recency_weight desc", () => {
        const errors = [
            makeError({
                id: "low",
                element_key: "low",
                error_count: 1,
                last_error_at: NOW,
            }),
            makeError({
                id: "high",
                element_key: "high",
                error_count: 5,
                last_error_at: NOW,
            }),
            makeError({
                id: "old",
                element_key: "old",
                error_count: 5,
                last_error_at: "2026-05-10T00:00:00Z",
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.prioritized_elements.map((e) => e.element_key)).toEqual([
            "high",
            "old",
            "low",
        ]);
        expect(result.prioritized_elements[0].priority_score).toBe(5);
        expect(result.prioritized_elements[1].priority_score).toBe(1.5);
        expect(result.prioritized_elements[2].priority_score).toBe(1);
    });

    it("tie-breaks by last_attempt_at desc then element_key asc", () => {
        const errors = [
            makeError({
                id: "a",
                element_key: "alpha",
                error_count: 2,
                last_attempt_at: "2026-05-27T10:00:00Z",
            }),
            makeError({
                id: "b",
                element_key: "beta",
                error_count: 2,
                last_attempt_at: "2026-05-27T11:00:00Z",
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.prioritized_elements[0].element_key).toBe("beta");
    });

    it("limits suggested_focus to focusCount (default 3)", () => {
        const errors = Array.from({length: 6}, (_, i) =>
            makeError({
                id: `e${i}`,
                element_key: `key-${i}`,
                error_count: i + 1,
            }),
        );
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.suggested_focus).toHaveLength(3);
    });

    it("respects custom focusCount", () => {
        const errors = Array.from({length: 6}, (_, i) =>
            makeError({
                id: `e${i}`,
                element_key: `key-${i}`,
                error_count: i + 1,
            }),
        );
        const result = analyzeErrors(errors, {now: NOW, focusCount: 5});
        expect(result.suggested_focus).toHaveLength(5);
    });
});

describe("analyzeErrors — cluster detection (Q-114)", () => {
    it("detects element_type cluster when 3+ errors share a type", () => {
        const errors = [
            makeError({id: "a", element_key: "a", element_type: "grammar_rule"}),
            makeError({id: "b", element_key: "b", element_type: "grammar_rule"}),
            makeError({id: "c", element_key: "c", element_type: "grammar_rule"}),
            makeError({id: "d", element_key: "d", element_type: "vocabulary"}),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        const grammarCluster = result.error_clusters.find(
            (c) => c.key === "grammar_rule",
        );
        expect(grammarCluster).toBeDefined();
        expect(grammarCluster?.cluster_type).toBe("element_type");
        expect(grammarCluster?.element_keys).toEqual(["a", "b", "c"]);
    });

    it("does NOT cluster when only 2 errors share a type", () => {
        const errors = [
            makeError({id: "a", element_key: "a", element_type: "grammar_rule"}),
            makeError({id: "b", element_key: "b", element_type: "grammar_rule"}),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.error_clusters).toEqual([]);
    });

    it("detects lesson cluster when 3+ errors share a lesson", () => {
        const errors = [
            makeError({id: "a", element_key: "a", lesson_id: "01-greetings.json"}),
            makeError({id: "b", element_key: "b", lesson_id: "01-greetings.json"}),
            makeError({id: "c", element_key: "c", lesson_id: "01-greetings.json"}),
            makeError({id: "d", element_key: "d", lesson_id: "02-numbers.json"}),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        const lessonCluster = result.error_clusters.find(
            (c) => c.cluster_type === "lesson",
        );
        expect(lessonCluster?.key).toBe("01-greetings.json");
    });

    it("sorts clusters by error_count_total desc", () => {
        const errors = [
            makeError({id: "a", element_key: "a", lesson_id: "L1", error_count: 1}),
            makeError({id: "b", element_key: "b", lesson_id: "L1", error_count: 1}),
            makeError({id: "c", element_key: "c", lesson_id: "L1", error_count: 1}),
            makeError({
                id: "d",
                element_key: "d",
                lesson_id: "L1",
                element_type: "grammar_rule",
                error_count: 10,
            }),
            makeError({
                id: "e",
                element_key: "e",
                lesson_id: "L2",
                element_type: "grammar_rule",
                error_count: 10,
            }),
            makeError({
                id: "f",
                element_key: "f",
                lesson_id: "L3",
                element_type: "grammar_rule",
                error_count: 10,
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.error_clusters[0].error_count_total).toBeGreaterThanOrEqual(
            result.error_clusters[result.error_clusters.length - 1]
                .error_count_total,
        );
    });
});

describe("analyzeErrors — weakness profile", () => {
    it("computes element_type shares summing to ~1.0", () => {
        const errors = [
            makeError({
                id: "a",
                element_key: "a",
                element_type: "grammar_rule",
                error_count: 8,
            }),
            makeError({
                id: "b",
                element_key: "b",
                element_type: "vocabulary",
                error_count: 2,
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.weakness_profile).toEqual({
            grammar_rule: 0.8,
            vocabulary: 0.2,
        });
        const sum = Object.values(result.weakness_profile).reduce(
            (s, v) => s + v,
            0,
        );
        expect(sum).toBeCloseTo(1.0, 2);
    });

    it("returns empty profile on empty input", () => {
        expect(analyzeErrors([], {now: NOW}).weakness_profile).toEqual({});
    });

    it("rounds to 3 decimals (parity-safe floats)", () => {
        const errors = [
            makeError({
                id: "a",
                element_key: "a",
                element_type: "grammar_rule",
                error_count: 1,
            }),
            makeError({
                id: "b",
                element_key: "b",
                element_type: "vocabulary",
                error_count: 1,
            }),
            makeError({
                id: "c",
                element_key: "c",
                element_type: "concept",
                error_count: 1,
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.weakness_profile.grammar_rule).toBe(0.333);
        expect(result.weakness_profile.vocabulary).toBe(0.333);
        expect(result.weakness_profile.concept).toBe(0.333);
    });
});

describe("analyzeErrors — total counts", () => {
    it("sums error_count across active rows only", () => {
        const errors = [
            makeError({id: "a", element_key: "a", error_count: 3}),
            makeError({id: "b", element_key: "b", error_count: 7}),
            makeError({
                id: "c",
                element_key: "c",
                error_count: 99,
                mastered: true,
            }),
        ];
        const result = analyzeErrors(errors, {now: NOW});
        expect(result.total_errors).toBe(10);
        expect(result.active_elements).toBe(2);
    });
});
