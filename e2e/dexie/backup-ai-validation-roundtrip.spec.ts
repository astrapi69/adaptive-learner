/**
 * A cached AI content-check report survives a browser round trip (#3412).
 *
 * The report carries the AIV-09 signature behind the "AI-checked" badge and
 * only comes from a paid, hand-started check, but the backup did not carry
 * it. The payload's ``ai_validation_results`` block now does. This spec
 * drives the real Export button and download, reads the file, wipes the
 * report store, imports the same bytes through the real file input and reads
 * the store back.
 */

import {readFileSync} from "node:fs";

import {expect, test, type Page} from "@playwright/test";
import {strFromU8, unzipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const SOURCE = "coach-e2e/greek-a1";
const SET_ID = "greek-a1";
/** The row id the app writes: ``slugifySource(source)#set_id``. */
const ROW_ID = "coach-e2e--greek-a1#greek-a1";
const REPORT = {
    source: SOURCE,
    set_id: SET_ID,
    set_version: "1.2.0",
    content_hash: "sha256:e2e-content",
    results: [
        {card_id: "c1", ok: true, issues: []},
        {card_id: "c2", ok: false, issues: [{field: "back", problem: "typo", suggestion: "fix"}]},
    ],
    response_ids: ["resp-e2e-1", "resp-e2e-2"],
    provider: "openai",
    model: "gpt-4o-mini",
    card_count: 2,
    issue_count: 1,
    checked_at: "2026-10-01T10:00:00.000Z",
    signature: null,
};

async function reportStore(page: Page, action: "put" | "clear" | "get"): Promise<unknown> {
    return page.evaluate(
        ({dbName, action, rowId, report}) =>
            new Promise<unknown>((resolve, reject) => {
                const open = indexedDB.open(dbName);
                open.onsuccess = () => {
                    const db = open.result;
                    const mode = action === "get" ? "readonly" : "readwrite";
                    const tx = db.transaction("aiValidationResults", mode);
                    const store = tx.objectStore("aiValidationResults");
                    let value: unknown = null;
                    if (action === "put") store.put({id: rowId, ...report});
                    if (action === "clear") store.clear();
                    if (action === "get") {
                        const req = store.get(rowId);
                        req.onsuccess = () => {
                            value = req.result ?? null;
                        };
                    }
                    tx.oncomplete = () => {
                        db.close();
                        resolve(value);
                    };
                    tx.onerror = () => reject(String(tx.error));
                };
            }),
        {dbName: DEXIE_DB_NAME, action, rowId: ROW_ID, report: REPORT},
    );
}

test.describe("Backup - AI content-check reports round trip (Dexie, #3412)", () => {
    test("a cached report and its signature fields come back after a wipe", async ({page}) => {
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
        await reportStore(page, "put");

        // --- Export: real button, real download, real file content --------
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            page.getByTestId("backup-export").click(),
        ]);
        const bytes = readFileSync((await download.path()) as string);
        const entries = unzipSync(new Uint8Array(bytes));
        const dataEntry = Object.keys(entries).find((n) => n.endsWith("data.json")) as string;
        const payload = JSON.parse(strFromU8(entries[dataEntry])) as {
            version?: string;
            ai_validation_results?: unknown[];
        };
        expect(payload.version).toBe("1.9.0");
        expect(payload.ai_validation_results).toEqual([REPORT]);

        // --- Wipe: a fresh device has no cached report ---------------------
        await reportStore(page, "clear");
        expect(await reportStore(page, "get")).toBeNull();

        // --- Import the same bytes through the real file input -------------
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        await page.getByTestId("backup-file-input").setInputFiles({
            name: download.suggestedFilename(),
            mimeType: "application/zip",
            buffer: bytes,
        });
        await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});

        // --- The report store holds the same report again ------------------
        await expect.poll(() => reportStore(page, "get"), {timeout: 10000}).toEqual({id: ROW_ID, ...REPORT});

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
