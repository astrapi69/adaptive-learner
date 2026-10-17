/**
 * Dexie v35 upgrade: complete the rows that reached the summary (#3792).
 *
 * Before #3792 only a "Mark as complete" button wrote ``completed``; a
 * learner who went on with "Next lesson" kept every finished lesson
 * ``in_progress`` (``paused`` once left). The v35 upgrade repairs those rows
 * once: a row counts as having reached the summary when its
 * ``current_step`` is at least the step count of the cached lesson, the
 * same condition the summary renders under (summary index ===
 * ``lesson.steps.length`` in ``useLesson``).
 *
 * The test seeds a v34 database with rows in both states and opens the
 * current schema against it.
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import {IDBFactory} from "fake-indexeddb";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {AdaptiveLearnerDB, _resetDbForTests} from "./db";
import {completeRowsThatReachedSummary} from "./db-migrations";

const NAME = "adaptive-learner";
const SOURCE = "astrapi69/alc-psychology";
const SET = "psych-intro-from-de";

function lessonBody(steps: number): string {
    return JSON.stringify({
        id: "l",
        title: "L",
        steps: Array.from({length: steps}, (_, i) => ({id: `s${i}`, type: "theory"})),
    });
}

function progressRow(
    lesson: string,
    status: string,
    currentStep: number,
    extra: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: `u1#astrapi69--alc-psychology#${SET}#${lesson}`,
        user_id: "u1",
        source: SOURCE,
        set_id: SET,
        lesson_filename: lesson,
        status,
        current_step: currentStep,
        score_correct: 12,
        score_total: 12,
        step_results: {s9: {correct: true}},
        updated_at: "2026-09-14T06:06:00.000Z",
        completed_at: null,
        paused_at: status === "paused" ? "2026-09-14T06:07:00.000Z" : null,
        abandoned_at: null,
        attempts: 0,
        attempt_history: [],
        ...extra,
    };
}

async function seedV34(): Promise<void> {
    const legacy = new Dexie(NAME);
    legacy.version(34).stores({
        lessonProgress: "id, user_id, set_id, status, updated_at",
        contentSets: "id, source, set_id, version, downloaded_at",
        contentSetFiles: "id, set_pk, filename",
    });
    await legacy.open();
    // Two cached versions of the set. A string comparison would pick 1.9.0
    // ("1.9.0" > "1.10.0"); the repair must read the numerically latest.
    await legacy.table("contentSets").bulkPut([
        {id: `astrapi69--alc-psychology/${SET}/1.9.0`, source: SOURCE, set_id: SET, version: "1.9.0"},
        {id: `astrapi69--alc-psychology/${SET}/1.10.0`, source: SOURCE, set_id: SET, version: "1.10.0"},
    ]);
    const files = [
        ["1.9.0", "24-deskriptive-statistik.json", 12],
        ["1.10.0", "24-deskriptive-statistik.json", 10],
        ["1.10.0", "25-inferenzstatistik.json", 10],
        ["1.10.0", "26-paedagogische-psychologie.json", 10],
        ["1.10.0", "02-done-before.json", 10],
        ["1.10.0", "04-abandoned.json", 10],
    ] as const;
    await legacy.table("contentSetFiles").bulkPut(
        files.map(([version, name, steps]) => {
            const setPk = `astrapi69--alc-psychology/${SET}/${version}`;
            return {
                id: `${setPk}#lessons/${name}`,
                set_pk: setPk,
                filename: `lessons/${name}`,
                body: lessonBody(steps),
                encoding: "text",
            };
        }),
    );
    await legacy.table("lessonProgress").bulkPut([
        progressRow("24-deskriptive-statistik.json", "in_progress", 10),
        progressRow("25-inferenzstatistik.json", "paused", 10),
        progressRow("26-paedagogische-psychologie.json", "in_progress", 1),
        progressRow("02-done-before.json", "completed", 10, {
            completed_at: "2026-06-08T15:04:00.000Z",
            attempts: 1,
        }),
        progressRow("04-abandoned.json", "abandoned", 0),
        progressRow("31-not-cached.json", "in_progress", 10),
    ]);
    legacy.close();
}

async function rowFor(db: AdaptiveLearnerDB, lesson: string): Promise<Record<string, unknown>> {
    const row = await db.table("lessonProgress").get(`u1#astrapi69--alc-psychology#${SET}#${lesson}`);
    return row as Record<string, unknown>;
}

beforeEach(async () => {
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
    // Dexie keeps the IndexedDB factory it saw first, so a fresh factory
    // alone does not isolate the tests: start each from an empty database.
    await Dexie.delete(NAME);
});

afterEach(async () => {
    await _resetDbForTests();
});

describe("Dexie v35 upgrade: rows that reached the summary are completed (#3792)", () => {
    it("completes in_progress and paused rows at the end of their lesson, at the time they were last touched", async () => {
        await seedV34();
        const db = new AdaptiveLearnerDB(NAME);
        await db.open();

        const reached = await rowFor(db, "24-deskriptive-statistik.json");
        expect(reached.status).toBe("completed");
        expect(reached.completed_at).toBe("2026-09-14T06:06:00.000Z");
        expect(reached.attempts).toBe(1);
        expect(reached.attempt_history).toEqual([
            {at: "2026-09-14T06:06:00.000Z", correct: 12, total: 12},
        ]);

        const paused = await rowFor(db, "25-inferenzstatistik.json");
        expect(paused.status).toBe("completed");
        expect(paused.paused_at).toBeNull();
        db.close();
    });

    it("leaves every row alone that did not reach the summary or needs no repair", async () => {
        await seedV34();
        const db = new AdaptiveLearnerDB(NAME);
        await db.open();

        expect((await rowFor(db, "26-paedagogische-psychologie.json")).status).toBe("in_progress");
        const done = await rowFor(db, "02-done-before.json");
        expect(done.completed_at).toBe("2026-06-08T15:04:00.000Z");
        expect(done.attempts).toBe(1);
        expect((await rowFor(db, "04-abandoned.json")).status).toBe("abandoned");
        // Its step count is unknown without the cached lesson.
        expect((await rowFor(db, "31-not-cached.json")).status).toBe("in_progress");
        db.close();
    });

    it("reports what it did and changes nothing on a second run", async () => {
        await seedV34();
        const db = new AdaptiveLearnerDB(NAME);
        await db.open();

        const again = await completeRowsThatReachedSummary(
            db.table("lessonProgress"),
            db.table("contentSets"),
            db.table("contentSetFiles"),
        );
        expect(again).toEqual({candidates: 2, repaired: 0, withoutLesson: 1});
        db.close();
    });

    it("counts the first run: 2 of 4 candidates repaired, 1 without a cached lesson", async () => {
        await seedV34();
        const legacy = new Dexie(NAME);
        legacy.version(34).stores({
            lessonProgress: "id, user_id, set_id, status, updated_at",
            contentSets: "id, source, set_id, version, downloaded_at",
            contentSetFiles: "id, set_pk, filename",
        });
        await legacy.open();
        const first = await completeRowsThatReachedSummary(
            legacy.table("lessonProgress"),
            legacy.table("contentSets"),
            legacy.table("contentSetFiles"),
        );
        expect(first).toEqual({candidates: 4, repaired: 2, withoutLesson: 1});
        legacy.close();
    });
});
