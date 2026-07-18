/**
 * Dexie-mode pronunciation namespace (#1786).
 *
 * Covers the browser-side logic that had no Dexie-path test before
 * the extraction (only the ApiStorage delegation was pinned):
 * the eligibility subject-walk (direct + parent-chain + negative)
 * and the no-key ApiError gates on phrase.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {ApiError} from "../../api/client";
import {_resetDbForTests, getDb, nowIso} from "../dexie/db";
import {dexiePronunciation} from "./pronunciation-dexie";

beforeEach(async () => {
    const db = getDb();
    try {
        await Promise.all([
            db.users.clear(),
            db.userSettings.clear(),
            db.learningProjects.clear(),
            db.subjects.clear(),
            db.projectSubjects.clear(),
        ]);
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

async function seedUserProject() {
    const db = getDb();
    const ts = nowIso();
    await db.users.add({
        id: "u1",
        name: "Tester",
        email: null,
        language: "en",
        created_at: ts,
        updated_at: ts,
    });
    await db.learningProjects.add({
        id: "p1",
        user_id: "u1",
        topic: "Spanish",
        goal: "A2",
        timeframe: "3m",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        created_at: ts,
        updated_at: ts,
    });
    return {db, ts};
}

function subjectRow(
    id: string,
    name: string,
    parentId: string | null,
    ts: string,
) {
    return {
        id,
        parent_id: parentId,
        name,
        description: null,
        icon: null,
        created_at: ts,
        updated_at: ts,
    };
}

describe("dexiePronunciation.eligibility", () => {
    it("is eligible when a project subject is named Languages", async () => {
        const {db, ts} = await seedUserProject();
        await db.subjects.add(subjectRow("s-lang", "Languages", null, ts));
        await db.projectSubjects.add({
            id: "ps1",
            project_id: "p1",
            subject_id: "s-lang",
            created_at: ts,
        });
        expect(await dexiePronunciation.eligibility("p1")).toEqual({
            eligible: true,
        });
    });

    it("walks the parent chain to a Sprachen ancestor", async () => {
        const {db, ts} = await seedUserProject();
        await db.subjects.bulkAdd([
            subjectRow("s-root", "Sprachen", null, ts),
            subjectRow("s-child", "Spanisch", "s-root", ts),
        ]);
        await db.projectSubjects.add({
            id: "ps1",
            project_id: "p1",
            subject_id: "s-child",
            created_at: ts,
        });
        expect(await dexiePronunciation.eligibility("p1")).toEqual({
            eligible: true,
        });
    });

    it("is not eligible without a language ancestor", async () => {
        const {db, ts} = await seedUserProject();
        await db.subjects.add(subjectRow("s-sci", "Science", null, ts));
        await db.projectSubjects.add({
            id: "ps1",
            project_id: "p1",
            subject_id: "s-sci",
            created_at: ts,
        });
        expect(await dexiePronunciation.eligibility("p1")).toEqual({
            eligible: false,
        });
    });

    it("is not eligible for a project without subjects", async () => {
        await seedUserProject();
        expect(await dexiePronunciation.eligibility("p1")).toEqual({
            eligible: false,
        });
    });
});

describe("dexiePronunciation.phrase", () => {
    it("throws ApiError(404) for an unknown project", async () => {
        await expect(
            dexiePronunciation.phrase({
                project_id: "missing",
                language: "es",
                level: "A1",
            } as never),
        ).rejects.toMatchObject({name: "ApiError", status: 404});
    });

    it("throws ApiError(400) when no AI key is configured", async () => {
        await seedUserProject();
        let caught: unknown;
        try {
            await dexiePronunciation.phrase({
                project_id: "p1",
                language: "es",
                level: "A1",
            } as never);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(ApiError);
        expect((caught as ApiError).status).toBe(400);
        expect((caught as ApiError).detail).toMatch(/API key/i);
    });
});
