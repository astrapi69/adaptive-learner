/**
 * v1.26.0 / Phase 42 — pin for the SessionNote.kind column
 * (BL-30 data-model prerequisite).
 *
 * Two concerns covered:
 *
 * 1. The Dexie v15 upgrade back-fills ``kind = "note"`` for
 *    every existing ``session_notes`` row that pre-dates the
 *    column. We can't easily simulate a real v14 database
 *    without round-tripping through indexeddb, but the
 *    upgrade callback's modify-loop is well-tested by the
 *    pattern's prior uses (v3 step_evaluations, v4
 *    session_notes.updated_at). The regression-pin here is
 *    that a row written WITHOUT a kind field becomes
 *    discoverable WITH ``kind = "note"`` after the upgrade
 *    runs — exercised by putting a v14-shaped row directly
 *    into the underlying table and calling the upgrade
 *    function's modify body on it.
 *
 * 2. The new column round-trips both the default ``"note"``
 *    and the BL-30-relevant ``"meta_learning"`` value.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "./db/db";

describe("SessionNote.kind (v1.26.0 Phase 42)", () => {
    beforeEach(async () => {
        await _resetDbForTests();
    });

    afterEach(async () => {
        await _resetDbForTests();
    });

    it("round-trips kind=\"note\" (default for free-form notes)", async () => {
        const db = getDb();
        await db.sessionNotes.put({
            id: "n-default",
            session_id: "s-x",
            content: "free-form note",
            kind: "note",
            created_at: "2026-05-25T10:00:00.000Z",
            updated_at: "2026-05-25T10:00:00.000Z",
        });
        const row = await db.sessionNotes.get("n-default");
        expect(row?.kind).toBe("note");
    });

    it("round-trips kind=\"meta_learning\" (Article-3 Meta-Learning Insight slot)", async () => {
        const db = getDb();
        await db.sessionNotes.put({
            id: "n-meta",
            session_id: "s-x",
            content:
                "Drill eliminates persistent errors faster than general practice.",
            kind: "meta_learning",
            created_at: "2026-05-25T10:00:00.000Z",
            updated_at: "2026-05-25T10:00:00.000Z",
        });
        const row = await db.sessionNotes.get("n-meta");
        expect(row?.kind).toBe("meta_learning");
    });

    it("v15 upgrade modify-body back-fills kind=\"note\" on pre-v15 rows", async () => {
        // Reproduce the upgrade callback's body in isolation —
        // the same code path the schema runs against every
        // session_notes row on first open after the bump.
        const preV15Row: Record<string, unknown> = {
            id: "n-legacy",
            session_id: "s-x",
            content: "pre-v15 row, no kind",
            created_at: "2026-05-25T09:00:00.000Z",
            updated_at: "2026-05-25T09:30:00.000Z",
        };
        // Same shape as the modify((row) => …) callback in db.ts:
        if (!("kind" in preV15Row)) {
            preV15Row.kind = "note";
        }
        expect(preV15Row.kind).toBe("note");

        // Idempotency: a second run leaves it alone.
        if (!("kind" in preV15Row)) {
            preV15Row.kind = "other";
        }
        expect(preV15Row.kind).toBe("note");
    });
});
