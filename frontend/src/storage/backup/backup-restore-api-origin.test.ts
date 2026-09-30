/**
 * Restoring an API-mode backup in browser mode (#3362).
 *
 * The backend writes UUID ids and JSON text columns as strings
 * (``sync_service.serialize_row``). Dexie reads lesson progress, element
 * errors, speech recordings and set runs by a COMPOSITE key, and expects
 * the JSON columns as parsed values. A restore that stores the API rows
 * verbatim leaves them unreachable: "Weitermachen" lists the lesson, but
 * the lesson page finds no row and starts at step 0.
 *
 * The fixtures are the producer's wire shape (every declared column of
 * the backend ``TableSpec``, UUID ids, owner/name source, JSON strings),
 * and every assertion goes through the consumer that reads the row.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {restoreDexieBackup} from "./backup-restore";
import {BACKUP_FORMAT, BACKUP_VERSION} from "./backup-tables";
import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";
import type {BackupPayload} from "../../types/domain";

const SOURCE = "astrapi69/alc-spanish";
const SET_ID = "es-a1";
const LESSON = "03-greetings.json";
const TS = "2026-09-20T10:00:00+00:00";

let userId = "";

beforeEach(async () => {
    const {IDBFactory} = await import("fake-indexeddb");
    globalThis.indexedDB = new IDBFactory();
    await _resetDbForTests();
    userId = (await dexieStorage.users.create({name: "Aster", language: "de"})).id;
});

afterEach(async () => {
    await _resetDbForTests();
});

/** An API-origin payload (``storage_mode: "api"``) around ``data``. */
function apiPayload(data: Record<string, unknown[]>): BackupPayload {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        app_version: "9.9.9",
        created_at: TS,
        user_id: userId,
        storage_mode: "api",
        data,
        content_sets: [],
        stats: {total_records: 0, tables: {}},
    } as BackupPayload;
}

function apiLessonProgress(): Record<string, unknown> {
    return {
        id: "5f0c1d2e-0000-4000-8000-000000000001",
        user_id: userId,
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON,
        status: "paused",
        lesson_mode: "practice",
        step_results: JSON.stringify({"2": {correct: 3, total: 4}}),
        score_correct: 3,
        score_total: 4,
        time_spent_seconds: 120,
        current_step: 4,
        started_at: TS,
        updated_at: TS,
        completed_at: null,
        paused_at: TS,
        abandoned_at: null,
        attempts: 1,
        best_score_correct: 3,
        best_score_total: 4,
        attempt_history: JSON.stringify([{at: TS, correct: 3, total: 4}]),
    };
}

function apiElementError(): Record<string, unknown> {
    return {
        id: "5f0c1d2e-0000-4000-8000-000000000002",
        user_id: userId,
        run_id: 1,
        set_id: SET_ID,
        lesson_id: LESSON,
        exercise_id: "ex-1",
        element_key: "hola",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "hello?",
        correct_answer: "hello",
        error_count: 2,
        correct_streak: 0,
        last_error_at: TS,
        last_attempt_at: TS,
        mastered: false,
        mastered_at: null,
        hint_used: false,
        hint_used_count: 0,
        last_attempt_exam: false,
        attempt_count: 2,
        attempt_history: JSON.stringify([{at: TS, correct: false}]),
        retired_at: null,
        created_at: TS,
        updated_at: TS,
    };
}

describe("restoring an API-mode backup in browser mode (#3362)", () => {
    it("the lesson page reaches the restored progress at its step, with parsed results", async () => {
        const summary = await restoreDexieBackup(
            userId,
            apiPayload({lesson_progress: [apiLessonProgress()]}),
        );
        expect(summary.errors).toEqual([]);
        const progress = await dexieStorage.lessonProgress.get(userId, SOURCE, SET_ID, LESSON);
        expect(progress?.current_step).toBe(4);
        expect(progress?.step_results).toEqual({"2": {correct: 3, total: 4}});
        expect(progress?.attempt_history).toEqual([{at: TS, correct: 3, total: 4}]);
    });

    it("a later attempt on a restored element error updates that row instead of adding a second", async () => {
        await restoreDexieBackup(userId, apiPayload({element_errors: [apiElementError()]}));
        await dexieStorage.elementErrors.recordBulk(userId, [
            {
                set_id: SET_ID,
                lesson_id: LESSON,
                exercise_id: "ex-1",
                element_key: "hola",
                element_type: "vocabulary",
                user_answer: "helo",
                correct_answer: "hello",
                correct: false,
            },
        ] as never);
        const rows = (await dexieStorage.elementErrors.list(userId, {})).filter(
            (row) => row.element_key === "hola",
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].error_count).toBe(3);
    });

    it("a restored speech recording is found by its exercise", async () => {
        await restoreDexieBackup(
            userId,
            apiPayload({
                speech_recordings: [
                    {
                        id: "5f0c1d2e-0000-4000-8000-000000000003",
                        user_id: userId,
                        source: SOURCE,
                        set_id: SET_ID,
                        lesson_filename: LESSON,
                        exercise_id: "ex-2",
                        audio_base64: "UklGRg==",
                        mime_type: "audio/webm",
                        duration_ms: 900,
                        recorded_at: TS,
                        updated_at: TS,
                    },
                ],
            }),
        );
        const recording = await dexieStorage.speechRecordings.get(
            userId,
            SOURCE,
            SET_ID,
            LESSON,
            "ex-2",
        );
        expect(recording?.audio_base64).toBe("UklGRg==");
    });

    it("a restored set run is the row the next Durchgang closes, not a duplicate", async () => {
        await restoreDexieBackup(
            userId,
            apiPayload({
                set_runs: [
                    {
                        id: "5f0c1d2e-0000-4000-8000-000000000004",
                        user_id: userId,
                        set_id: SET_ID,
                        run_id: 1,
                        content_version_at_start: "1.0.0",
                        started_at: TS,
                        closed_at: null,
                        updated_at: TS,
                    },
                ],
            }),
        );
        await dexieStorage.elementErrors.startRun(userId, SET_ID, {});
        const runs = await dexieStorage.elementErrors.listRuns(userId, SET_ID);
        expect(runs.map((run) => run.run_id).sort()).toEqual([1, 2]);
    });

    it.each([
        ["imported_conversations", "analysis_result", {summary: "ok"}],
        ["badges", "tier_thresholds", {bronze: {threshold: 10, xp_bonus: 50}}],
    ])("parses the JSON text column %s.%s", async (table, column, value) => {
        const row: Record<string, unknown> =
            table === "badges"
                ? {id: "b-api-1", key: "api_only_badge", updated_at: TS}
                : {id: "ic-api-1", user_id: userId, title: "Chat", imported_at: TS};
        row[column] = JSON.stringify(value);
        await restoreDexieBackup(userId, apiPayload({[table]: [row]}));
        const store = table === "badges" ? getDb().badges : getDb().importedConversations;
        const stored = (await store.get(row.id as string)) as Record<string, unknown> | undefined;
        expect(stored?.[column]).toEqual(value);
    });
});
