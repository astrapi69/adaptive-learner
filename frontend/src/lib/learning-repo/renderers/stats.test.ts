/**
 * Pure tests for renderers/stats.ts (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Structural assertions. Byte-for-byte parity with Python
 * output is the parity test's (49F) job.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS} from "../labels";
import {buildRenderContext} from "../render-context";
import type {
    MethodSwitchData,
    ProjectData,
    RatingData,
    RenderContext,
    SessionData,
} from "../render-context";

import {renderStats} from "./stats";

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

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
        id: "abcd1234-rest-of-id",
        project_id: "p-1",
        method: "deductive",
        started_at: "2026-01-01T09:00:00Z",
        ended_at: "2026-01-01T09:30:00Z",
        cycle_step: 7,
        status: "completed",
        cycle_count: 1,
        ...overrides,
    };
}

function makeRating(
    id: string,
    sessionId: string,
    understanding: number,
    methodFit: number,
    stress: number,
): RatingData {
    return {
        id,
        session_id: sessionId,
        understanding,
        stress,
        method_fit: methodFit,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
    };
}

function buildCtx(
    sessions: SessionData[],
    ratings: RatingData[],
    method_switches: MethodSwitchData[] = [],
): RenderContext {
    return buildRenderContext({
        project: makeProject(),
        sessions,
        ratings,
        step_evaluations: [],
        method_switches,
        notes: [],
        rendered_at: RENDER_AT,
    });
}

describe("renderStats — empty project", () => {
    it("renders title + intro + empty placeholders", () => {
        const ctx = buildCtx([], []);
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain("# Learning Statistics");
        expect(md).toContain("## Sessions\n\n_No sessions yet._");
        expect(md).toContain(
            "## Method switches\n\n_No method switches recorded._",
        );
        expect(md).toContain("## Exit thresholds");
        expect(md.endsWith("\n")).toBe(true);
        expect(md.endsWith("\n\n")).toBe(false);
    });
});

describe("renderStats — session table", () => {
    it("renders table header + dash row when sessions exist", () => {
        const ctx = buildCtx(
            [makeSession()],
            [makeRating("r-1", "abcd1234-rest-of-id", 4, 4, 2)],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain(
            "| Session | Method | Understanding | Transfer | Stress | Cycles | Status |",
        );
        expect(md).toContain("|---|---|---|---|---|---|---|");
    });

    it("emits short_id as the first 8 chars in backticks", () => {
        const ctx = buildCtx(
            [makeSession({id: "abcd1234-rest-of-id"})],
            [makeRating("r-1", "abcd1234-rest-of-id", 4, 4, 2)],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain("| `abcd1234` |");
    });

    it("scales 1-5 ratings to /10 + uses em-dash for missing", () => {
        const ctx = buildCtx(
            [makeSession({id: "s-1"}), makeSession({id: "s-2"})],
            [makeRating("r-1", "s-1", 4, 3, 2)],
            // s-2 has no rating
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        // s-1: understanding 4*2=8, transfer 3*2=6, stress 2*2=4
        expect(md).toMatch(/\| `s-1[^|]+\| deductive \| 8\/10 \| 6\/10 \| 4\/10 \|/);
        // s-2: no rating → em-dashes
        expect(md).toMatch(/\| `s-2[^|]+\| deductive \| — \| — \| — \|/);
    });

    it("pins the exit-threshold marker on qualifying rows", () => {
        const ctx = buildCtx(
            [
                makeSession({
                    id: "s-1",
                    started_at: "2026-01-01T09:00:00Z",
                }),
                makeSession({
                    id: "s-2",
                    started_at: "2026-01-02T09:00:00Z",
                }),
            ],
            [
                makeRating("r-1", "s-1", 5, 4, 1),
                makeRating("r-2", "s-2", 5, 4, 1),
            ],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        // s-2 (index 1) qualifies because s-1 (index 0) also
        // cleared the bar. The marker appears appended to
        // the status column.
        expect(md).toContain("completed ✅ exit threshold met");
    });

    it("sorts sessions by started_at ascending in the table", () => {
        const ctx = buildCtx(
            [
                // Provided out-of-order — rendering sorts.
                makeSession({
                    id: "s-late",
                    started_at: "2026-01-03T09:00:00Z",
                }),
                makeSession({
                    id: "s-early",
                    started_at: "2026-01-01T09:00:00Z",
                }),
            ],
            [],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        const earlyIdx = md.indexOf("| `s-early`");
        const lateIdx = md.indexOf("| `s-late`");
        expect(earlyIdx).toBeGreaterThan(0);
        expect(lateIdx).toBeGreaterThan(0);
        expect(earlyIdx).toBeLessThan(lateIdx);
    });
});

describe("renderStats — method-switch table", () => {
    it("renders header + sorted rows when switches exist", () => {
        const ctx = buildCtx(
            [makeSession()],
            [],
            [
                {
                    id: "sw-late",
                    project_id: "p-1",
                    from_method: "inductive",
                    to_method: "dialogic",
                    reason: "User asked.",
                    switched_at: "2026-01-03T10:00:00Z",
                },
                {
                    id: "sw-early",
                    project_id: "p-1",
                    from_method: "deductive",
                    to_method: "inductive",
                    reason: "Stagnated.",
                    switched_at: "2026-01-02T10:00:00Z",
                },
            ],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain("| From | To | Reason | When |");
        expect(md).toContain("|---|---|---|---|");
        // YYYY-MM-DD slice from the ISO timestamp.
        expect(md).toContain(
            "| deductive | inductive | Stagnated. | 2026-01-02 |",
        );
        expect(md).toContain(
            "| inductive | dialogic | User asked. | 2026-01-03 |",
        );
        // Earlier row before later row.
        const earlyIdx = md.indexOf("2026-01-02");
        const lateIdx = md.indexOf("2026-01-03");
        expect(earlyIdx).toBeLessThan(lateIdx);
    });

    it("escapes pipes in the reason column", () => {
        const ctx = buildCtx(
            [makeSession()],
            [],
            [
                {
                    id: "sw-1",
                    project_id: "p-1",
                    from_method: "deductive",
                    to_method: "inductive",
                    reason: "Reason | with pipe",
                    switched_at: "2026-01-02T10:00:00Z",
                },
            ],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain("Reason \\| with pipe");
    });

    it("flattens newlines in the reason column", () => {
        const ctx = buildCtx(
            [makeSession()],
            [],
            [
                {
                    id: "sw-1",
                    project_id: "p-1",
                    from_method: "deductive",
                    to_method: "inductive",
                    reason: "Line one\nLine two",
                    switched_at: "2026-01-02T10:00:00Z",
                },
            ],
        );
        const md = renderStats(ctx, DEFAULT_LABELS);
        expect(md).toContain("Line one Line two");
        expect(md).not.toContain("Line one\nLine two");
    });
});
