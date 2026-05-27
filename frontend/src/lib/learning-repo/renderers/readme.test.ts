/**
 * Pure tests for renderers/readme.ts (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Structural assertions — full byte-for-byte parity with the
 * Python output is the parity test (49F)'s job. Here we pin
 * the section order, the placeholders that get substituted,
 * and the empty-state branches the Python tests cover.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS} from "../labels";
import {buildRenderContext} from "../render-context";
import type {
    ProjectData,
    RenderContext,
    SessionData,
} from "../render-context";

import {renderReadme} from "./readme";

const RENDER_AT = "2026-05-27T12:00:00.000Z";

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
        id: "p-1",
        user_id: "u-1",
        topic: "Spanish",
        goal: "Conversational fluency",
        timeframe: "3 months",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
        id: "s-1",
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

function buildCtx(
    project: ProjectData,
    sessions: SessionData[],
    cycleTopicsBySession: Record<string, string> = {},
): RenderContext {
    const enrichedSessions = sessions.map((s) => ({
        ...s,
        cycle_topics: cycleTopicsBySession[s.id],
    }));
    return buildRenderContext({
        project,
        sessions: enrichedSessions,
        ratings: [],
        step_evaluations: [],
        method_switches: [],
        notes: [],
        rendered_at: RENDER_AT,
    });
}

describe("renderReadme — minimal project", () => {
    it("emits title, goal, status, progress, see-also for an empty project", () => {
        const ctx = buildCtx(makeProject(), []);
        const md = renderReadme(ctx, DEFAULT_LABELS);

        // Title substitutes {topic}.
        expect(md).toContain("# Learning Project: Spanish");
        // Goal heading + body.
        expect(md).toContain("## Goal\n\nConversational fluency");
        // Status: active.
        expect(md).toContain("## Status\n\nactive");
        // Progress: 0 sessions, 0 cycles.
        expect(md).toContain("- Sessions: 0");
        expect(md).toContain("- Cycles: 0");
        // No method-distribution block (empty).
        expect(md).not.toContain("## Method distribution");
        // Topics heading + empty placeholder.
        expect(md).toContain("## Topics\n\n_No topics traversed yet._");
        // See-also block always rendered.
        expect(md).toContain("## See also");
        expect(md).toContain("LEARNING_STATS.md");
        expect(md).toContain("CHEATSHEET.md");
        expect(md).toContain("ROADMAP.md");
        // Ends with exactly one newline.
        expect(md.endsWith("\n")).toBe(true);
        expect(md.endsWith("\n\n")).toBe(false);
    });
});

describe("renderReadme — status branch", () => {
    it("shows 'archived' when project.active is false", () => {
        const ctx = buildCtx(makeProject({active: false}), []);
        const md = renderReadme(ctx, DEFAULT_LABELS);
        expect(md).toContain("## Status\n\narchived");
        expect(md).not.toContain("\n\nactive\n");
    });
});

describe("renderReadme — sessions + cycle sum", () => {
    it("sums cycle_count across sessions (defaults missing to 1)", () => {
        const ctx = buildCtx(makeProject(), [
            makeSession({id: "s-1", cycle_count: 3}),
            makeSession({id: "s-2", cycle_count: 2}),
            makeSession({id: "s-3"}), // cycle_count undefined → defaults to 1
        ]);
        const md = renderReadme(ctx, DEFAULT_LABELS);
        expect(md).toContain("- Sessions: 3");
        expect(md).toContain("- Cycles: 6"); // 3 + 2 + 1
    });
});

describe("renderReadme — method-distribution block", () => {
    it("renders only when there is at least one session", () => {
        const ctx = buildCtx(makeProject(), [
            makeSession({id: "s-1", method: "deductive"}),
            makeSession({id: "s-2", method: "inductive"}),
            makeSession({id: "s-3", method: "deductive"}),
        ]);
        const md = renderReadme(ctx, DEFAULT_LABELS);
        expect(md).toContain("## Method distribution");
        // Sort by count desc, then alphabetical.
        const deductiveIdx = md.indexOf("- **deductive**: 2");
        const inductiveIdx = md.indexOf("- **inductive**: 1");
        expect(deductiveIdx).toBeGreaterThan(0);
        expect(inductiveIdx).toBeGreaterThan(0);
        expect(deductiveIdx).toBeLessThan(inductiveIdx);
    });

    it("alphabetical tiebreaker when counts are equal", () => {
        const ctx = buildCtx(makeProject(), [
            makeSession({id: "s-1", method: "inductive"}),
            makeSession({id: "s-2", method: "deductive"}),
        ]);
        const md = renderReadme(ctx, DEFAULT_LABELS);
        // Both count = 1 → alphabetical: deductive before
        // inductive.
        const deductiveIdx = md.indexOf("- **deductive**: 1");
        const inductiveIdx = md.indexOf("- **inductive**: 1");
        expect(deductiveIdx).toBeLessThan(inductiveIdx);
    });
});

describe("renderReadme — topics block", () => {
    it("links each topic to its folder README", () => {
        const ctx = buildCtx(
            makeProject(),
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
            {
                "s-1": JSON.stringify([{topic: "Verbs"}]),
                "s-2": JSON.stringify([
                    {topic: "Verbs"},
                    {topic: "Tenses"},
                ]),
            },
        );
        const md = renderReadme(ctx, DEFAULT_LABELS);
        expect(md).toContain("## Topics");
        expect(md).toContain("- [Verbs](01_verbs/README.md)");
        expect(md).toContain("- [Tenses](02_tenses/README.md)");
        expect(md).not.toContain("_No topics traversed yet._");
    });
});
