/**
 * Programmatic backup round-trip proof, content-verified (#3362).
 *
 * BACKUP-AKZEPTANZTEST (quality-checks.md, accepted alternative #2828):
 * an API-mode backup (UUID ids, JSON text columns as strings, the shape
 * ``sync_service.serialize_row`` writes) is imported through the real
 * file input of the browser build, then read back by the composite key
 * the lesson page and the SRS queue use. Before the fix the rows landed
 * under their UUID and the lesson page found nothing.
 */

import {expect, test, type Page} from "@playwright/test";
import {strToU8, zipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const SOURCE = "astrapi69/alc-spanish";
const SET_ID = "es-a1";
const LESSON = "03-greetings.json";
const TS = "2026-09-20T10:00:00+00:00";
const ALB_FORMAT = "adaptive-learner-backup";
const ALB_CONTAINER = "alb";

/** Read one row by primary key from the app's own database. */
async function readRow(page: Page, store: string, key: string): Promise<Record<string, unknown> | null> {
    return page.evaluate(
        ({dbName, store, key}) =>
            new Promise<Record<string, unknown> | null>((resolve) => {
                const openReq = indexedDB.open(dbName);
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const getReq = db.transaction(store, "readonly").objectStore(store).get(key);
                    getReq.onsuccess = () => {
                        db.close();
                        resolve(getReq.result ?? null);
                    };
                };
            }),
        {dbName: DEXIE_DB_NAME, store, key},
    );
}

test.describe("Backup - API-mode file restored in browser mode (Dexie, #3362)", () => {
    test("restored lesson progress and element errors sit under the keys the app reads", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await createTestUser(page);
        const userId = (await page.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        )) as string;
        expect(userId).not.toBeNull();

        const payload = {
            format: "adaptive-learner-backup",
            version: "1.6.0",
            app_version: "9.9.9",
            created_at: TS,
            user_id: userId,
            storage_mode: "api",
            data: {
                lesson_progress: [
                    {
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
                        attempts: 0,
                        best_score_correct: 0,
                        best_score_total: 0,
                        attempt_history: "[]",
                        // #3365 - the resume reads the last step entry.
                        recent_steps: JSON.stringify([
                            {at: TS, kind: "step", step_index: 4, step_id: "s4"},
                        ]),
                    },
                ],
                element_errors: [
                    {
                        id: "5f0c1d2e-0000-4000-8000-000000000002",
                        user_id: userId,
                        run_id: 1,
                        set_id: SET_ID,
                        lesson_id: LESSON,
                        exercise_id: "ex-1",
                        element_key: "hola",
                        direction: "target_to_source",
                        element_type: "vocabulary",
                        user_answer: "helo",
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
                    },
                ],
            },
            content_sets: [],
            stats: {total_records: 2, tables: {lesson_progress: 1, element_errors: 1}},
        };
        // The .alb container the API export produces (albContainer.ts).
        const manifest = {
            format: ALB_FORMAT,
            container: ALB_CONTAINER,
            app_version: payload.app_version,
            schema_version: payload.version,
            created_at: TS,
            backup_type: "full",
            user_id: userId,
            storage_mode: "api",
            assets: [],
            stats: payload.stats,
        };
        const alb = zipSync({
            "manifest.json": strToU8(JSON.stringify(manifest)),
            "data.json": strToU8(JSON.stringify(payload)),
        });

        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        await page.getByTestId("backup-file-input").setInputFiles({
            name: "api-origin.alb",
            mimeType: "application/zip",
            buffer: Buffer.from(alb),
        });
        await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});

        const slug = SOURCE.replace(/\//g, "--");
        const progress = await readRow(page, "lessonProgress", `${userId}#${slug}#${SET_ID}#${LESSON}`);
        expect(progress, "lesson progress must sit under the lesson page's key").not.toBeNull();
        expect(progress?.current_step).toBe(4);
        expect(progress?.step_results).toEqual({"2": {correct: 3, total: 4}});
        expect(progress?.recent_steps).toEqual([
            {at: TS, kind: "step", step_index: 4, step_id: "s4"},
        ]);

        const errorRow = await readRow(
            page,
            "elementErrors",
            [userId, SET_ID, LESSON, "ex-1", "hola", "target_to_source", "1"].join("#"),
        );
        expect(errorRow, "element error must sit under the SRS key").not.toBeNull();
        expect(errorRow?.error_count).toBe(2);
        expect(errorRow?.attempt_history).toEqual([{at: TS, correct: false}]);

        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
