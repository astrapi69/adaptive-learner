/**
 * Pure tests for renderers/cheatsheet.ts (Phase 49D / v1.32.0
 * / PHASE-42-STORAGE-ABSTRACTION-01). Structural assertions;
 * byte-for-byte parity with Python output is 49F's job.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS} from "../labels";
import {buildRenderContext} from "../render-context";
import type {
    ProjectData,
    RenderContext,
    SessionNoteData,
} from "../render-context";

import {renderCheatsheet} from "./cheatsheet";

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

function makeNote(overrides: Partial<SessionNoteData> = {}): SessionNoteData {
    return {
        id: "n-1",
        session_id: "s-1",
        content: "A note",
        kind: "note",
        created_at: "2026-01-01T09:00:00Z",
        ...overrides,
    };
}

function buildCtx(notes: SessionNoteData[]): RenderContext {
    return buildRenderContext({
        project: makeProject(),
        sessions: [],
        ratings: [],
        step_evaluations: [],
        method_switches: [],
        notes,
        rendered_at: "2026-05-27T12:00:00.000Z",
    });
}

describe("renderCheatsheet — empty", () => {
    it("renders title + intro + empty placeholders for both sections", () => {
        const md = renderCheatsheet(buildCtx([]), DEFAULT_LABELS);
        expect(md).toContain("# Cheatsheet");
        expect(md).toContain("## Notes\n\n_No notes yet._");
        expect(md).toContain(
            "## Meta-Learning Insights\n\n_No meta-learning insights yet.",
        );
    });
});

describe("renderCheatsheet — notes section", () => {
    it("includes notes with kind='note' in the Notes section", () => {
        const md = renderCheatsheet(
            buildCtx([makeNote({content: "Verbs are tricky."})]),
            DEFAULT_LABELS,
        );
        expect(md).toContain("- Verbs are tricky.");
    });

    it("skips notes with kind='meta_learning' from the Notes section", () => {
        const md = renderCheatsheet(
            buildCtx([
                makeNote({
                    id: "n-1",
                    content: "Regular note",
                    kind: "note",
                }),
                makeNote({
                    id: "n-2",
                    content: "Meta insight",
                    kind: "meta_learning",
                }),
            ]),
            DEFAULT_LABELS,
        );
        // Both surfaces appear, but in different sections.
        const notesIdx = md.indexOf("## Notes");
        const metaIdx = md.indexOf("## Meta-Learning Insights");
        const regularIdx = md.indexOf("- Regular note");
        const insightIdx = md.indexOf("- Meta insight");
        expect(regularIdx).toBeGreaterThan(notesIdx);
        expect(regularIdx).toBeLessThan(metaIdx);
        expect(insightIdx).toBeGreaterThan(metaIdx);
    });

    it("dedupes by case-insensitive trimmed content", () => {
        const md = renderCheatsheet(
            buildCtx([
                makeNote({
                    id: "n-1",
                    content: "Same Insight",
                    created_at: "2026-01-01T09:00:00Z",
                }),
                makeNote({
                    id: "n-2",
                    content: "  same insight  ",
                    created_at: "2026-01-02T09:00:00Z",
                }),
                makeNote({
                    id: "n-3",
                    content: "SAME INSIGHT",
                    created_at: "2026-01-03T09:00:00Z",
                }),
            ]),
            DEFAULT_LABELS,
        );
        // Only the FIRST occurrence (after trim) survives.
        // Match the trimmed form.
        expect(
            md.match(/- Same Insight\b/g)?.length ?? 0,
        ).toBe(1);
        expect(md).not.toContain("- same insight");
        expect(md).not.toContain("- SAME INSIGHT");
    });

    it("sorts notes by created_at ascending before dedupe", () => {
        const md = renderCheatsheet(
            buildCtx([
                makeNote({
                    id: "n-2",
                    content: "B note",
                    created_at: "2026-01-02T09:00:00Z",
                }),
                makeNote({
                    id: "n-1",
                    content: "A note",
                    created_at: "2026-01-01T09:00:00Z",
                }),
            ]),
            DEFAULT_LABELS,
        );
        const aIdx = md.indexOf("- A note");
        const bIdx = md.indexOf("- B note");
        expect(aIdx).toBeGreaterThan(0);
        expect(bIdx).toBeGreaterThan(0);
        expect(aIdx).toBeLessThan(bIdx);
    });

    it("flattens multi-line note content to a single bullet", () => {
        const md = renderCheatsheet(
            buildCtx([
                makeNote({content: "Line one\nLine two\n  Line three"}),
            ]),
            DEFAULT_LABELS,
        );
        expect(md).toContain("- Line one Line two Line three");
        // No literal newlines inside the bullet.
        expect(md).not.toMatch(/- Line one\n/);
    });
});

describe("renderCheatsheet — meta-learning section", () => {
    it("renders kind='meta_learning' notes under the right heading", () => {
        const md = renderCheatsheet(
            buildCtx([
                makeNote({
                    content: "I learn better when I write things down.",
                    kind: "meta_learning",
                }),
            ]),
            DEFAULT_LABELS,
        );
        expect(md).toContain(
            "- I learn better when I write things down.",
        );
        // The "no insights yet" placeholder is NOT there.
        expect(md).not.toContain("_No meta-learning insights yet.");
    });
});
