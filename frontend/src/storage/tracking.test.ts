/**
 * Tracking aggregator + commit-builder tests (Phase 10E).
 *
 * Pins the algorithm parity against the backend's
 * ``adaptive_learner_tracking.summary.aggregate`` and
 * ``commits.build_commit_kwargs``. Streak math is exercised
 * with an injected ``today`` for determinism.
 */

import {describe, expect, it} from "vitest";

import {
    aggregateProgress,
    buildCommitFromSession,
} from "./tracking";
import type {LearningSessionRow, ProgressCommitRow, SessionRatingRow} from "./db";

function commit(
    overrides: Partial<ProgressCommitRow> = {},
): ProgressCommitRow {
    return {
        id: "c-default",
        project_id: "p1",
        session_id: "s1",
        method: "deductive",
        understanding: 0.8,
        stress: 0.4,
        error_rate: 0,
        duration_minutes: 15,
        committed_at: "2026-05-19T10:00:00.000Z",
        ...overrides,
    };
}

describe("aggregateProgress", () => {
    it("empty commits -> all-zeros", () => {
        const r = aggregateProgress([]);
        expect(r.total_sessions).toBe(0);
        expect(r.total_minutes).toBe(0);
        expect(r.streak_days).toBe(0);
        expect(r.mean_understanding).toBe(0);
        expect(r.method_distribution).toHaveLength(6);
        for (const e of r.method_distribution) {
            expect(e.count).toBe(0);
            expect(e.percentage).toBe(0);
        }
    });

    it("counts sessions per method correctly", () => {
        const r = aggregateProgress([
            commit({id: "1", method: "deductive"}),
            commit({id: "2", method: "deductive"}),
            commit({id: "3", method: "inductive"}),
        ]);
        expect(r.total_sessions).toBe(3);
        expect(r.sessions_per_method.deductive).toBe(2);
        expect(r.sessions_per_method.inductive).toBe(1);
        const distribution = r.method_distribution;
        expect(distribution[0]).toEqual({
            method: "deductive",
            count: 2,
            percentage: 67,
        });
    });

    it("computes mean and recent trends from the tail", () => {
        const c = [
            commit({id: "1", understanding: 0.1, stress: 0.9}),
            commit({id: "2", understanding: 0.2, stress: 0.8}),
            commit({id: "3", understanding: 0.3, stress: 0.7}),
            commit({id: "4", understanding: 0.4, stress: 0.6}),
            commit({id: "5", understanding: 0.5, stress: 0.5}),
            commit({id: "6", understanding: 0.6, stress: 0.4}),
        ];
        const r = aggregateProgress(c);
        expect(r.recent_understanding).toEqual([0.2, 0.3, 0.4, 0.5, 0.6]);
        expect(r.recent_stress).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
        expect(r.mean_understanding).toBeCloseTo(0.35, 4);
    });

    it("streak_days counts consecutive days from today walking back", () => {
        const r = aggregateProgress(
            [
                commit({id: "1", committed_at: "2026-05-17T10:00:00.000Z"}),
                commit({id: "2", committed_at: "2026-05-18T10:00:00.000Z"}),
                commit({id: "3", committed_at: "2026-05-19T10:00:00.000Z"}),
            ],
            "2026-05-19",
        );
        expect(r.streak_days).toBe(3);
    });

    it("streak resets to 0 when today has no commit", () => {
        const r = aggregateProgress(
            [
                commit({id: "1", committed_at: "2026-05-17T10:00:00.000Z"}),
                commit({id: "2", committed_at: "2026-05-18T10:00:00.000Z"}),
            ],
            "2026-05-19",
        );
        expect(r.streak_days).toBe(0);
    });

    it("recent_sessions returns newest first, capped at 5", () => {
        const c = Array.from({length: 7}, (_, i) =>
            commit({
                id: `c${i}`,
                committed_at: `2026-05-${(10 + i).toString().padStart(2, "0")}T10:00:00.000Z`,
            }),
        );
        const r = aggregateProgress(c);
        expect(r.recent_sessions).toHaveLength(5);
        expect(r.recent_sessions[0].id).toBe("c6");
        expect(r.recent_sessions[4].id).toBe("c2");
    });

    it("total_minutes sums duration", () => {
        const r = aggregateProgress([
            commit({duration_minutes: 10}),
            commit({duration_minutes: 20}),
            commit({duration_minutes: 30}),
        ]);
        expect(r.total_minutes).toBe(60);
    });
});

describe("buildCommitFromSession", () => {
    const baseSession: LearningSessionRow = {
        id: "s1",
        project_id: "p1",
        method: "deductive",
        started_at: "2026-05-19T10:00:00.000Z",
        ended_at: "2026-05-19T10:15:00.000Z",
        cycle_step: 7,
        status: "completed",
        imported_conversation_id: null,
    };
    const baseRating: SessionRatingRow = {
        id: "r1",
        session_id: "s1",
        understanding: 4,
        stress: 2,
        method_fit: 5,
        notes: null,
        created_at: "2026-05-19T10:14:00.000Z",
    };

    it("normalises ratings to [0,1] and computes 15-minute duration", () => {
        const c = buildCommitFromSession(baseSession, baseRating);
        expect(c).not.toBeNull();
        expect(c!.understanding).toBe(0.8);
        expect(c!.stress).toBe(0.4);
        expect(c!.duration_minutes).toBe(15);
        expect(c!.error_rate).toBe(0);
    });

    it("returns null without a rating", () => {
        expect(buildCommitFromSession(baseSession, null)).toBeNull();
    });

    it("returns null when session is missing ended_at -> duration 0 but row still builds", () => {
        const open: LearningSessionRow = {...baseSession, ended_at: null};
        const c = buildCommitFromSession(open, baseRating);
        expect(c).not.toBeNull();
        expect(c!.duration_minutes).toBe(0);
    });
});
