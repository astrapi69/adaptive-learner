/**
 * Programmatic backup round-trip proof, content-verified (#3369).
 *
 * BACKUP-AKZEPTANZTEST (quality-checks.md, accepted alternative #2828):
 * a Dexie-managed localStorage key (``adaptive-learner.set-status``) is
 * exported through the real Export button, changed, restored through the
 * real file input, and must still hold the backup's value after a page
 * reload. Before the fix the boot reconcile let the older Dexie
 * ``userData`` row win, so the restored value reverted on reload.
 */

import {readFileSync} from "node:fs";

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const KEY = "adaptive-learner.set-status";
const BACKED_UP = '{"es-a1":"completed"}';
const LATER = '{"es-a1":"deferred"}';

/** Write the key the way the app's store does: localStorage plus the
 *  Dexie ``userData`` mirror. */
async function writeManagedKey(page: Page, value: string): Promise<void> {
    await page.evaluate(
        ({dbName, key, value}) =>
            new Promise<void>((resolve, reject) => {
                localStorage.setItem(key, value);
                const openReq = indexedDB.open(dbName);
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const tx = db.transaction("userData", "readwrite");
                    tx.objectStore("userData").put({key, value});
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
            }),
        {dbName: DEXIE_DB_NAME, key: KEY, value},
    );
}

/** The Dexie ``userData`` row for {@link KEY}, or null. */
async function readUserDataRow(page: Page): Promise<string | null> {
    return page.evaluate(
        ({dbName, key}) =>
            new Promise<string | null>((resolve) => {
                const openReq = indexedDB.open(dbName);
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const getReq = db.transaction("userData", "readonly").objectStore("userData").get(key);
                    getReq.onsuccess = () => {
                        db.close();
                        resolve(getReq.result?.value ?? null);
                    };
                };
            }),
        {dbName: DEXIE_DB_NAME, key: KEY},
    );
}

test.describe("Backup - restored user data survives a reload (Dexie, #3369)", () => {
    test("a restored set status is still there after the next app start", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(() => {
            try {
                // @ts-expect-error - force the download fallback.
                delete window.showSaveFilePicker;
            } catch {
                /* non-configurable in some engines; ignore */
            }
        });

        await createTestUser(page);
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        await writeManagedKey(page, BACKED_UP);

        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            page.getByTestId("backup-export").click(),
        ]);
        const albBytes = readFileSync((await download.path()) as string);

        await writeManagedKey(page, LATER);

        await page.getByTestId("backup-file-input").setInputFiles({
            name: download.suggestedFilename(),
            mimeType: "application/zip",
            buffer: albBytes,
        });
        await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});
        expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(BACKED_UP);

        // The canonical copy the boot reconcile prefers must hold the
        // backup's value too; before the fix it still held LATER.
        expect(await readUserDataRow(page)).toBe(BACKED_UP);

        // Next app start: the boot reconcile runs and copies the Dexie
        // row into localStorage.
        await page.reload({waitUntil: "networkidle"});
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(BACKED_UP);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
