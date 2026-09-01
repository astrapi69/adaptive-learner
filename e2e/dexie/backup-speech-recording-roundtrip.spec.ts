/**
 * Programmatic backup round-trip proof, content-verified (#2825/#2818).
 *
 * BACKUP-AKZEPTANZTEST (quality-checks.md) asks for a real Export ->
 * Import round-trip with real data, because unit tests alone missed
 * five consecutive "fixed" backup releases. This spec is the automated
 * equivalent for the Dexie surface: it drives the REAL app (real
 * button clicks, a real browser download, a real re-import), and then
 * proves the exported artifact itself carries the payload — file size
 * and exact byte content of a real field, not just "no error toast".
 *
 * It exists specifically to prove the #2824 fix (speech_recordings was
 * missing from ``BACKUP_TABLES`` and silently dropped from every
 * Dexie-mode export): a microphone recording is a large base64 blob
 * that is easy to get right in a unit test's shrunken fixture and
 * wrong in the wire format. Seeding is via a raw ``indexedDB`` write
 * (headless Chromium has no microphone) against the app's own,
 * already-open Dexie database, so the seeded row is exercised through
 * the exact same read path the app uses for every other row.
 */

import {readFileSync} from "node:fs";

import {expect, test} from "@playwright/test";
import {strFromU8, unzipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const RECORDING_ID = "e2e-roundtrip-sr-1";
// Long enough to be a meaningful size signal in the exported file (a
// real recording is tens of KB of base64), short enough to keep the
// spec fast. The exact byte string is what gets asserted verbatim.
const AUDIO_BASE64 = "UklGRhAAAABXQVZFZmF0IBAAAAABAAEA".repeat(64);

interface SeedResult {
    ok: boolean;
    error?: string;
}

test.describe("Backup — speech_recordings round-trip, content-verified (Dexie)", () => {
    test("export carries the seeded recording's exact bytes; re-import restores it", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.addInitScript(() => {
            try {
                // @ts-expect-error — force the download fallback.
                delete window.showSaveFilePicker;
            } catch {
                /* non-configurable in some engines; ignore */
            }
        });

        await createTestUser(page);
        const userId = await page.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        );
        expect(userId, "onboarding must have set a learner id").not.toBeNull();

        // Seed a real speechRecordings row via raw IndexedDB against the
        // app's own, already-open database. This is the real storage
        // layer, not a mock - only the microphone capture step is
        // bypassed (headless Chromium has none).
        const seed: SeedResult = await page.evaluate(
            ({dbName, userId, recordingId, audioBase64}) => {
                return new Promise<SeedResult>((resolve) => {
                    const openReq = indexedDB.open(dbName);
                    openReq.onerror = () =>
                        resolve({ok: false, error: String(openReq.error)});
                    openReq.onsuccess = () => {
                        const db = openReq.result;
                        const tx = db.transaction("speechRecordings", "readwrite");
                        tx.objectStore("speechRecordings").put({
                            id: recordingId,
                            user_id: userId,
                            source: "astrapi69/adaptive-learner-content",
                            set_id: "es-a1",
                            lesson_filename: "03-pronunciation.json",
                            exercise_id: "ex-1",
                            audio_base64: audioBase64,
                            mime_type: "audio/webm",
                            duration_ms: 4200,
                            recorded_at: "2026-06-01T10:00:00.000Z",
                            updated_at: "2026-06-01T10:00:00.000Z",
                        });
                        tx.oncomplete = () => {
                            db.close();
                            resolve({ok: true});
                        };
                        tx.onerror = () =>
                            resolve({ok: false, error: String(tx.error)});
                    };
                });
            },
            {
                dbName: DEXIE_DB_NAME,
                userId,
                recordingId: RECORDING_ID,
                audioBase64: AUDIO_BASE64,
            },
        );
        expect(seed.ok, `seed failed: ${seed.error}`).toBe(true);

        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({
            timeout: 15000,
        });

        // --- Export: real button, real download ---------------------
        const exportBtn = page.getByTestId("backup-export");
        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            exportBtn.click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.alb$/);

        const downloadPath = await download.path();
        expect(downloadPath, "download must materialize to a local file").not.toBeNull();
        const albBytes = readFileSync(downloadPath as string);

        // --- Content proof: unzip the REAL downloaded file, assert on
        //     its real byte size and the real bytes of the seeded field.
        // Lower bound tied to the seeded payload itself (not just ">0"):
        // the ZIP must carry at least the raw audio_base64 length, since
        // that field alone accounts for most of the archive's content.
        expect(albBytes.byteLength).toBeGreaterThan(AUDIO_BASE64.length);
        // eslint-disable-next-line no-console -- evidence for the
        // programmatic BACKUP-AKZEPTANZTEST proof: a reportable number,
        // not just a pass/fail.
        console.log(
            `[backup-roundtrip] downloaded .alb size: ${albBytes.byteLength} bytes`,
        );
        const entries = unzipSync(new Uint8Array(albBytes));
        const dataEntryName = Object.keys(entries).find((name) =>
            name.endsWith("data.json"),
        );
        expect(
            dataEntryName,
            `expected a data.json entry in the .alb, got: ${Object.keys(entries).join(", ")}`,
        ).toBeDefined();
        const dataJson = JSON.parse(strFromU8(entries[dataEntryName as string]));

        expect(Array.isArray(dataJson.data?.speech_recordings)).toBe(true);
        expect(dataJson.data.speech_recordings).toHaveLength(1);
        const exportedRow = dataJson.data.speech_recordings[0];
        expect(exportedRow.id).toBe(RECORDING_ID);
        // The exact byte content, not a truncated preview or a length
        // check - this is the assertion the #2824 fix exists for.
        expect(exportedRow.audio_base64).toBe(AUDIO_BASE64);
        expect(exportedRow.duration_ms).toBe(4200);

        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);

        // --- Wipe the store, so restore-from-file is provably doing
        //     the work (not just seeing data that was never gone). ---
        const wiped = await page.evaluate(
            ({dbName}) => {
                return new Promise<boolean>((resolve) => {
                    const openReq = indexedDB.open(dbName);
                    openReq.onsuccess = () => {
                        const db = openReq.result;
                        const tx = db.transaction("speechRecordings", "readwrite");
                        tx.objectStore("speechRecordings").clear();
                        tx.oncomplete = () => {
                            db.close();
                            resolve(true);
                        };
                    };
                });
            },
            {dbName: DEXIE_DB_NAME},
        );
        expect(wiped).toBe(true);

        // --- Import: real file input, the exact bytes just downloaded ---
        const fileInput = page.getByTestId("backup-file-input");
        await fileInput.setInputFiles({
            name: download.suggestedFilename(),
            mimeType: "application/zip",
            buffer: albBytes,
        });

        await expect(page.getByTestId("backup-comparison")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("backup-confirm").click();

        await expect(page.getByTestId("backup-summary")).toBeVisible({
            timeout: 15000,
        });
        const restoredRow = page.getByTestId(
            "backup-summary-row-speech_recordings",
        );
        await expect(restoredRow).toBeVisible();
        await expect(restoredRow).toContainText("1");

        // --- Final proof: read the restored row straight back out of
        //     IndexedDB and assert on its real bytes, end to end. -----
        const restored = await page.evaluate(
            ({dbName, recordingId}) => {
                return new Promise<{audio_base64: string; duration_ms: number} | null>(
                    (resolve) => {
                        const openReq = indexedDB.open(dbName);
                        openReq.onsuccess = () => {
                            const db = openReq.result;
                            const tx = db.transaction("speechRecordings", "readonly");
                            const getReq = tx
                                .objectStore("speechRecordings")
                                .get(recordingId);
                            getReq.onsuccess = () => {
                                db.close();
                                resolve(getReq.result ?? null);
                            };
                        };
                    },
                );
            },
            {dbName: DEXIE_DB_NAME, recordingId: RECORDING_ID},
        );
        expect(restored).not.toBeNull();
        expect(restored?.audio_base64).toBe(AUDIO_BASE64);
        expect(restored?.duration_ms).toBe(4200);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
