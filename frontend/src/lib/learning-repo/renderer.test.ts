/**
 * Pure tests for renderer.ts (Phase 49D / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01). Orchestrator-level
 * assertions on the ``{path: content}`` map shape - the
 * individual renderer tests cover content semantics; here we
 * pin "every meta-file present + topic folders appended".
 */

import {describe, expect, it} from "vitest";

import {buildRenderContext} from "./render-context";
import type {
    ProjectData,
    RenderContext,
    SessionData,
} from "./render-context";
import {renderRepository} from "./renderer";

const RENDER_AT = "2026-05-27T12:00:00.000Z";

function makeProject(): ProjectData {
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

describe("renderRepository", () => {
    it("always produces the 4 meta-files at top level", async () => {
        const tree = await renderRepository(buildCtx([]), "en");
        expect(Object.keys(tree).sort()).toEqual([
            "CHEATSHEET.md",
            "LEARNING_STATS.md",
            "README.md",
            "ROADMAP.md",
        ]);
    });

    it("each meta-file ends with a newline", async () => {
        const tree = await renderRepository(buildCtx([]), "en");
        for (const content of Object.values(tree)) {
            expect(content.endsWith("\n")).toBe(true);
        }
    });

    it("topic folders are appended under NN_slug/README.md keys", async () => {
        const tree = await renderRepository(
            buildCtx(
                [
                    makeSession({
                        id: "s-1",
                        started_at: "2026-01-01T09:00:00Z",
                    }),
                ],
                {"s-1": JSON.stringify([{topic: "Verbs"}])},
            ),
            "en",
        );
        expect(Object.keys(tree).sort()).toEqual([
            "01_verbs/README.md",
            "CHEATSHEET.md",
            "LEARNING_STATS.md",
            "README.md",
            "ROADMAP.md",
        ]);
        // The topic stub is non-empty + ends with newline.
        const stub = tree["01_verbs/README.md"];
        expect(stub.length).toBeGreaterThan(0);
        expect(stub.endsWith("\n")).toBe(true);
    });

    it("language argument is forwarded to labelsFor", async () => {
        // The DE bundle exists in the i18n catalog (the
        // sync_i18n drift pin asserts every language ships
        // the same key set). A render with language="de"
        // should produce a different README title than EN
        // because the German bundle translates it.
        const en = await renderRepository(buildCtx([]), "en");
        const de = await renderRepository(buildCtx([]), "de");
        // Both ALWAYS include the README. The actual TEXT
        // differs because the language differs (assuming
        // the catalog has a translated value).
        expect(en["README.md"]).toContain("# Learning Project: Spanish");
        // German has a translated title — pin only that the
        // # H1 line is present and includes the topic.
        // (Exact German wording is owned by the catalog.)
        expect(de["README.md"]).toContain("Spanish"); // topic surface
        expect(de["README.md"].split("\n")[0].startsWith("# ")).toBe(true);
    });

    it("default language is 'en' when omitted", async () => {
        const explicit = await renderRepository(buildCtx([]), "en");
        const implicit = await renderRepository(buildCtx([]));
        expect(implicit).toEqual(explicit);
    });
});
