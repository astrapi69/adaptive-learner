/**
 * Dexie-loader integration test (Phase 49B / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Seeds a minimal project + sessions + ratings + step
 * evaluations + method switches + notes into the Dexie DB,
 * then calls ``loadDexieContext`` and asserts the resulting
 * RenderContext carries every row mapped to the right shape.
 *
 * The Python loader (``renderer.load_context``) gets its own
 * pytest coverage in
 * ``plugins/.../learning-repo/tests/test_renderer.py``; this
 * test is the Dexie-side parallel.
 */

import "fake-indexeddb/auto";

import {beforeEach, describe, expect, it} from "vitest";

import {ApiError} from "../../api/client";
import {_resetDbForTests, getDb} from "../../storage/db/db";

import {loadDexieContext} from "./load-context-dexie";

const PROJECT_ID = "proj-1";
const USER_ID = "user-1";
const RENDER_AT = "2026-05-27T12:00:00.000Z";

beforeEach(async () => {
    const db = getDb();
    // Clear every table the loader reads so each test starts
    // from a known state. Mirrors the
    // ``element-errors-dexie.test.ts`` reset pattern.
    try {
        await Promise.all([
            db.learningProjects.clear(),
            db.learningSessions.clear(),
            db.sessionRatings.clear(),
            db.stepEvaluations.clear(),
            db.methodSwitches.clear(),
            db.sessionNotes.clear(),
        ]);
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

async function seedProject() {
    const db = getDb();
    await db.learningProjects.add({
        id: PROJECT_ID,
        user_id: USER_ID,
        topic: "Spanish",
        goal: "Conversational fluency",
        timeframe: "3 months",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    });
}

describe("loadDexieContext", () => {
    it("throws 404 when the project doesn't exist", async () => {
        await expect(
            loadDexieContext("no-such-project"),
        ).rejects.toBeInstanceOf(ApiError);
        await expect(
            loadDexieContext("no-such-project"),
        ).rejects.toMatchObject({status: 404});
    });

    it("returns a context with empty collections for a fresh project", async () => {
        await seedProject();
        const ctx = await loadDexieContext(PROJECT_ID, {
            renderedAt: RENDER_AT,
        });
        expect(ctx.project.id).toBe(PROJECT_ID);
        expect(ctx.project.kind).toBe("standard");
        expect(ctx.sessions).toEqual([]);
        expect(ctx.ratings).toEqual([]);
        expect(ctx.step_evaluations).toEqual([]);
        expect(ctx.method_switches).toEqual([]);
        expect(ctx.notes).toEqual([]);
        expect(ctx.topics).toEqual([]);
        expect(ctx.rendered_at).toBe(RENDER_AT);
    });

    it("loads sessions + ratings + step-evals + notes for the project", async () => {
        await seedProject();
        const db = getDb();
        await db.learningSessions.add({
            id: "sess-1",
            project_id: PROJECT_ID,
            method: "deductive",
            started_at: "2026-01-01T09:00:00Z",
            ended_at: "2026-01-01T09:30:00Z",
            cycle_step: 7,
            status: "completed",
            imported_conversation_id: null,
        });
        await db.sessionRatings.add({
            id: "rate-1",
            session_id: "sess-1",
            understanding: 4,
            stress: 2,
            method_fit: 4,
            notes: null,
            created_at: "2026-01-01T09:30:00Z",
        });
        await db.stepEvaluations.add({
            id: "eval-1",
            session_id: "sess-1",
            from_step: 3,
            to_step: 4,
            advance: true,
            applied: true,
            confidence: 0.85,
            reason: "Demonstrated grasp.",
            fallback_used: false,
            duration_seconds: 120,
            evaluated_at: "2026-01-01T09:15:00Z",
        });
        await db.sessionNotes.add({
            id: "note-1",
            session_id: "sess-1",
            content: "Imperfect tense clicked.",
            kind: "meta_learning",
            created_at: "2026-01-01T09:35:00Z",
            updated_at: "2026-01-01T09:35:00Z",
        });
        await db.methodSwitches.add({
            id: "switch-1",
            project_id: PROJECT_ID,
            session_id: "sess-1",
            from_method: "deductive",
            to_method: "inductive",
            reason: "User asked to try inductive.",
            switched_at: "2026-01-02T10:00:00Z",
        });

        const ctx = await loadDexieContext(PROJECT_ID, {
            renderedAt: RENDER_AT,
        });
        expect(ctx.sessions.map((s) => s.id)).toEqual(["sess-1"]);
        expect(ctx.ratings.map((r) => r.id)).toEqual(["rate-1"]);
        expect(ctx.step_evaluations.map((e) => e.id)).toEqual(["eval-1"]);
        expect(ctx.notes.map((n) => n.id)).toEqual(["note-1"]);
        expect(ctx.notes[0].kind).toBe("meta_learning");
        expect(ctx.method_switches.map((m) => m.id)).toEqual(["switch-1"]);
    });

    it("filters by project_id — sessions on another project are skipped", async () => {
        await seedProject();
        const db = getDb();
        await db.learningProjects.add({
            id: "other-project",
            user_id: USER_ID,
            topic: "Python",
            goal: "Algorithms",
            timeframe: "1 month",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            kind: "standard",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        });
        await db.learningSessions.add({
            id: "other-sess",
            project_id: "other-project",
            method: "deductive",
            started_at: "2026-01-01T09:00:00Z",
            ended_at: "2026-01-01T09:30:00Z",
            cycle_step: 7,
            status: "completed",
            imported_conversation_id: null,
        });

        const ctx = await loadDexieContext(PROJECT_ID);
        expect(ctx.sessions).toEqual([]);
    });

    it("back-fills missing kind to 'standard' (pre-v1.31.0 row)", async () => {
        const db = getDb();
        // Direct put with NO kind field — simulates a pre-
        // v1.31.0 row that survived the schema bump.
        await db.learningProjects.put({
            id: PROJECT_ID,
            user_id: USER_ID,
            topic: "Legacy",
            goal: "Test",
            timeframe: "1 month",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        } as unknown as Parameters<typeof db.learningProjects.put>[0]);

        const ctx = await loadDexieContext(PROJECT_ID);
        expect(ctx.project.kind).toBe("standard");
    });
});
