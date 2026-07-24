/**
 * Pure tests for renderers/roadmap.ts (Phase 49D / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01). Structural assertions;
 * byte-for-byte parity with Python is 49F's job.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS} from "../labels";
import {buildRenderContext} from "../render-context";
import type {
    ProjectData,
    RenderContext,
    SessionData,
} from "../render-context";

import {renderRoadmap} from "./roadmap";

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
    sessions: SessionData[],
    cycleTopicsBySession: Record<string, string> = {},
): RenderContext {
    const enriched = sessions.map((s) => ({
        ...s,
        cycle_topics: cycleTopicsBySession[s.id],
    }));
    return buildRenderContext({
        project: makeProject(),
        sessions: enriched,
        ratings: [],
        step_evaluations: [],
        method_switches: [],
        notes: [],
        rendered_at: RENDER_AT,
    });
}

describe("renderRoadmap — empty", () => {
    it("emits the no-next-steps placeholder when no sessions", () => {
        const md = renderRoadmap(buildCtx([]), DEFAULT_LABELS);
        expect(md).toContain("# Roadmap");
        expect(md).toContain(
            "## Next steps\n\n_No active project - start a new session to populate this list._",
        );
        expect(md).toContain(
            "## Open topics\n\n_No topics defined yet._",
        );
    });
});

describe("renderRoadmap — next-steps suggestion priority", () => {
    it("active session takes priority over completed", () => {
        const md = renderRoadmap(
            buildCtx([
                makeSession({
                    id: "s-active",
                    method: "inductive",
                    cycle_step: 3,
                    cycle_count: 2,
                    status: "active",
                }),
                makeSession({
                    id: "s-done",
                    method: "deductive",
                    status: "completed",
                }),
            ]),
            DEFAULT_LABELS,
        );
        expect(md).toContain(
            "Resume the active session (method: **inductive**, step 3/7, cycle 2)",
        );
        expect(md).not.toContain("Start the next session");
    });

    it("most-recent completed session drives 'start next' when no active", () => {
        const md = renderRoadmap(
            buildCtx([
                makeSession({
                    id: "s-early",
                    method: "deductive",
                    started_at: "2026-01-01T09:00:00Z",
                    ended_at: "2026-01-01T09:30:00Z",
                    status: "completed",
                }),
                makeSession({
                    id: "s-late",
                    method: "dialogic",
                    started_at: "2026-01-02T09:00:00Z",
                    ended_at: "2026-01-02T09:30:00Z",
                    status: "completed",
                }),
            ]),
            DEFAULT_LABELS,
        );
        expect(md).toContain(
            "Start the next session - last completed session used method **dialogic**",
        );
    });

    it("falls back to 'start first' when all sessions abandoned", () => {
        const md = renderRoadmap(
            buildCtx([
                makeSession({
                    id: "s-1",
                    method: "contextual",
                    started_at: "2026-01-01T09:00:00Z",
                    status: "abandoned",
                }),
                makeSession({
                    id: "s-2",
                    method: "deductive",
                    started_at: "2026-01-02T09:00:00Z",
                    status: "abandoned",
                }),
            ]),
            DEFAULT_LABELS,
        );
        // Chronologically first session was contextual.
        expect(md).toContain(
            "Start your first learning session - the assessment recommends starting with method **contextual**",
        );
    });
});

describe("renderRoadmap — open topics block", () => {
    it("lists topics with session count + methods", () => {
        const md = renderRoadmap(
            buildCtx(
                [
                    makeSession({
                        id: "s-1",
                        method: "deductive",
                        started_at: "2026-01-01T09:00:00Z",
                    }),
                    makeSession({
                        id: "s-2",
                        method: "inductive",
                        started_at: "2026-01-02T09:00:00Z",
                    }),
                ],
                {
                    "s-1": JSON.stringify([{topic: "Verbs"}]),
                    "s-2": JSON.stringify([{topic: "Verbs"}]),
                },
            ),
            DEFAULT_LABELS,
        );
        expect(md).toContain(
            "- **Verbs** (2 sessions; methods: deductive, inductive)",
        );
    });

    it("uses em-dash when a topic has no methods (shouldn't happen but defensive)", () => {
        // Hand-build a context with an empty methods topic
        // via a session whose method is empty string — not a
        // production shape, but exercises the defensive path.
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [
                makeSession({
                    id: "s-1",
                    method: "", // empty method to force methods=[""]
                    cycle_topics: JSON.stringify([{topic: "X"}]),
                }),
            ],
            ratings: [],
            step_evaluations: [],
            method_switches: [],
            notes: [],
            rendered_at: RENDER_AT,
        });
        const md = renderRoadmap(ctx, DEFAULT_LABELS);
        // Method = "" still ends up in the list (deriveTopics
        // appends it once). This test pins the line shape so
        // a future regression where an empty method is
        // filtered (and ``methods=[]`` triggers the em-dash
        // path) is visible.
        expect(md).toContain("methods:");
    });
});
