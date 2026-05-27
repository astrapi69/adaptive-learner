/**
 * Pure tests for topic-folders.ts (Phase 49D / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01). Structural assertions;
 * byte-for-byte parity with Python is 49F's job.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS} from "./labels";
import {buildRenderContext} from "./render-context";
import type {
    ProjectData,
    RenderContext,
    SessionData,
} from "./render-context";
import {renderTopicFolders} from "./topic-folders";

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

describe("renderTopicFolders", () => {
    it("returns an empty map when no topics", () => {
        const folders = renderTopicFolders(buildCtx([]), DEFAULT_LABELS);
        expect(folders).toEqual({});
    });

    it("produces a stub per topic at the expected path", () => {
        const ctx = buildCtx(
            [
                makeSession({
                    id: "s-1",
                    started_at: "2026-01-01T09:00:00Z",
                }),
            ],
            {
                "s-1": JSON.stringify([
                    {topic: "Verbs"},
                    {topic: "Tenses"},
                ]),
            },
        );
        const folders = renderTopicFolders(ctx, DEFAULT_LABELS);
        expect(Object.keys(folders).sort()).toEqual([
            "01_verbs/README.md",
            "02_tenses/README.md",
        ]);
    });

    it("stub README includes title + parent link + sessions + methods", () => {
        const ctx = buildCtx(
            [
                makeSession({
                    id: "abcd1234-rest-of-id",
                    method: "deductive",
                    started_at: "2026-01-01T09:00:00Z",
                }),
                makeSession({
                    id: "zzzz9999-other-id",
                    method: "inductive",
                    started_at: "2026-01-02T09:00:00Z",
                }),
            ],
            {
                "abcd1234-rest-of-id": JSON.stringify([{topic: "Verbs"}]),
                "zzzz9999-other-id": JSON.stringify([{topic: "Verbs"}]),
            },
        );
        const folders = renderTopicFolders(ctx, DEFAULT_LABELS);
        const md = folders["01_verbs/README.md"];
        expect(md).toContain("# Topic: Verbs");
        expect(md).toContain("← [Project root](../README.md)");
        expect(md).toContain("## Sessions on this topic");
        // Sessions emitted as 8-char short_id in backticks.
        expect(md).toContain("- `abcd1234`");
        expect(md).toContain("- `zzzz9999`");
        expect(md).toContain("## Methods used");
        expect(md).toContain("- deductive");
        expect(md).toContain("- inductive");
        // Trailing newline contract.
        expect(md.endsWith("\n")).toBe(true);
        expect(md.endsWith("\n\n")).toBe(false);
    });
});
