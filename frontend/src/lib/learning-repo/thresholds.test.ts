/**
 * Pure tests for thresholds.ts (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python pytest cases in
 * ``plugins/.../learning-repo/tests/test_thresholds.py``.
 * Article-1 § 8: Understanding ≥ 9/10 AND Transfer ≥ 8/10
 * stable over 2 consecutive cycles. Ratings store 1-5 →
 * renderer scales x2 to /10. So the per-session bar requires
 * Understanding ≥ 4.5 and method_fit ≥ 4 in the 1-5 scale —
 * effectively understanding=5 and method_fit=4.
 */

import {describe, expect, it} from "vitest";

import {buildRenderContext} from "./render-context";
import type {
    ProjectData,
    RatingData,
    RenderContext,
    SessionData,
} from "./render-context";
import {
    exitThresholdIndices,
    latestExitThresholdCycle,
    meetsPerSessionBar,
} from "./thresholds";

const RENDER_AT = "2026-05-27T12:00:00.000Z";

function makeProject(): ProjectData {
    return {
        id: "p-1",
        user_id: "u-1",
        topic: "T",
        goal: "G",
        timeframe: "1m",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
}

function makeSession(id: string, startedAt: string): SessionData {
    return {
        id,
        project_id: "p-1",
        method: "deductive",
        started_at: startedAt,
        ended_at: null,
        cycle_step: 7,
        status: "completed",
        cycle_count: 1,
    };
}

function makeRating(
    id: string,
    sessionId: string,
    understanding: number,
    methodFit: number,
): RatingData {
    return {
        id,
        session_id: sessionId,
        understanding,
        stress: 2,
        method_fit: methodFit,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
    };
}

function buildCtx(
    sessions: SessionData[],
    ratings: RatingData[],
): RenderContext {
    return buildRenderContext({
        project: makeProject(),
        sessions,
        ratings,
        step_evaluations: [],
        method_switches: [],
        notes: [],
        rendered_at: RENDER_AT,
    });
}

describe("meetsPerSessionBar", () => {
    it("false when session has no rating", () => {
        const ctx = buildCtx([makeSession("s-1", "2026-01-01T09:00:00Z")], []);
        expect(meetsPerSessionBar("s-1", ctx)).toBe(false);
    });

    it("true at the exact threshold (understanding=5, method_fit=4)", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [makeRating("r-1", "s-1", 5, 4)],
        );
        // 5*2 = 10 ≥ 9, 4*2 = 8 ≥ 8 → true.
        expect(meetsPerSessionBar("s-1", ctx)).toBe(true);
    });

    it("false when understanding is just below the bar", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [makeRating("r-1", "s-1", 4, 4)],
        );
        // 4*2 = 8 < 9 → false.
        expect(meetsPerSessionBar("s-1", ctx)).toBe(false);
    });

    it("false when transfer (method_fit) is just below the bar", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [makeRating("r-1", "s-1", 5, 3)],
        );
        // 3*2 = 6 < 8 → false.
        expect(meetsPerSessionBar("s-1", ctx)).toBe(false);
    });

    it("uses the LATEST rating when multiple exist for the session", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [
                makeRating("r-1", "s-1", 5, 4), // qualifies
                makeRating("r-2", "s-1", 2, 2), // doesn't
            ],
        );
        // ``latestRating`` returns rs[-1] = r-2 → false.
        expect(meetsPerSessionBar("s-1", ctx)).toBe(false);
    });
});

describe("exitThresholdIndices", () => {
    it("empty when no sessions", () => {
        const ctx = buildCtx([], []);
        expect(exitThresholdIndices(ctx).size).toBe(0);
    });

    it("session 0 never qualifies (no predecessor)", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [makeRating("r-1", "s-1", 5, 4)],
        );
        const indices = exitThresholdIndices(ctx);
        expect(indices.size).toBe(0);
    });

    it("pins index 1 when both s0 + s1 clear the bar", () => {
        const ctx = buildCtx(
            [
                makeSession("s-0", "2026-01-01T09:00:00Z"),
                makeSession("s-1", "2026-01-02T09:00:00Z"),
            ],
            [
                makeRating("r-0", "s-0", 5, 4),
                makeRating("r-1", "s-1", 5, 4),
            ],
        );
        expect(Array.from(exitThresholdIndices(ctx))).toEqual([1]);
    });

    it("does not pin when only the current session clears the bar", () => {
        const ctx = buildCtx(
            [
                makeSession("s-0", "2026-01-01T09:00:00Z"),
                makeSession("s-1", "2026-01-02T09:00:00Z"),
            ],
            [
                makeRating("r-0", "s-0", 3, 3), // doesn't qualify
                makeRating("r-1", "s-1", 5, 4), // qualifies
            ],
        );
        // s-1 qualifies but predecessor doesn't → no pin.
        expect(exitThresholdIndices(ctx).size).toBe(0);
    });

    it("pins multiple indices when a streak holds", () => {
        const ctx = buildCtx(
            [
                makeSession("s-0", "2026-01-01T09:00:00Z"),
                makeSession("s-1", "2026-01-02T09:00:00Z"),
                makeSession("s-2", "2026-01-03T09:00:00Z"),
                makeSession("s-3", "2026-01-04T09:00:00Z"),
            ],
            [
                makeRating("r-0", "s-0", 5, 4),
                makeRating("r-1", "s-1", 5, 4),
                makeRating("r-2", "s-2", 5, 4),
                makeRating("r-3", "s-3", 5, 4),
            ],
        );
        // Indices 1, 2, 3 all pin (each has a qualifying
        // predecessor in this all-strong streak).
        expect(Array.from(exitThresholdIndices(ctx)).sort()).toEqual([
            1, 2, 3,
        ]);
    });
});

describe("latestExitThresholdCycle", () => {
    it("returns null when no session qualifies", () => {
        const ctx = buildCtx(
            [makeSession("s-1", "2026-01-01T09:00:00Z")],
            [makeRating("r-1", "s-1", 3, 3)],
        );
        expect(latestExitThresholdCycle(ctx)).toBeNull();
    });

    it("returns 1-indexed position of the most-recent qualifying session", () => {
        const ctx = buildCtx(
            [
                makeSession("s-0", "2026-01-01T09:00:00Z"),
                makeSession("s-1", "2026-01-02T09:00:00Z"),
                makeSession("s-2", "2026-01-03T09:00:00Z"),
            ],
            [
                makeRating("r-0", "s-0", 5, 4),
                makeRating("r-1", "s-1", 5, 4),
                makeRating("r-2", "s-2", 5, 4),
            ],
        );
        // Indices 1 + 2 pin → max = 2 → 1-indexed = 3.
        expect(latestExitThresholdCycle(ctx)).toBe(3);
    });
});
