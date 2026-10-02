/**
 * Programmatic backup round-trip proof, content-verified (#3367).
 *
 * BACKUP-AKZEPTANZTEST (quality-checks.md, accepted alternative #2828):
 * the real Export button, the real downloaded ``.alb`` bytes, the real
 * file input on import. What it proves for #3367:
 *
 * 1. A browser-mode backup carries no stored API key, neither a live
 *    ``user_settings.api_key_<provider>`` value (all four providers,
 *    Perplexity included) nor a rollback copy in ``api_key_backups``,
 *    which Dexie holds in cleartext.
 * 2. Importing a file that DOES carry keys (a hand-edited or legacy
 *    pre-#3367 file) overwrites neither the live keys nor the rollback
 *    copies.
 *
 * Seeding writes the rows in the shape their producers write them
 * (``settings.setApiKey`` on the ``userSettings`` row, ``backupApiKey``
 * as ``{id: "<user>#<provider>", key, tested_at, works}``) via raw
 * IndexedDB against the app's own database; only the provider key test
 * is bypassed (no network in the gate).
 */

import {readFileSync} from "node:fs";

import {expect, test, type Page} from "@playwright/test";
import {strFromU8, strToU8, unzipSync, zipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const PROVIDERS = ["anthropic", "openai", "gemini", "perplexity"] as const;

const liveKey = (provider: string) => `sk-live-${provider}-3367-secret`;

interface KeyState {
    live: Record<string, string | null>;
    rollback: Record<string, string | null>;
}

/** Write the live key and the rollback copy for every provider. */
async function seedKeys(page: Page, userId: string): Promise<string> {
    return page.evaluate(
        ({dbName, userId, providers}) =>
            new Promise<string>((resolve) => {
                const openReq = indexedDB.open(dbName);
                openReq.onerror = () => resolve(String(openReq.error));
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const tx = db.transaction(["userSettings", "apiKeyBackups"], "readwrite");
                    const settings = tx.objectStore("userSettings");
                    const cursorReq = settings.index("user_id").openCursor(userId);
                    let found = false;
                    cursorReq.onsuccess = () => {
                        const cursor = cursorReq.result;
                        if (!cursor) return;
                        found = true;
                        const row = {...cursor.value};
                        for (const p of providers) row[`api_key_${p}`] = `sk-live-${p}-3367-secret`;
                        cursor.update(row);
                    };
                    const backups = tx.objectStore("apiKeyBackups");
                    for (const p of providers) {
                        backups.put({
                            id: `${userId}#${p}`,
                            user_id: userId,
                            provider: p,
                            key: `sk-live-${p}-3367-secret`,
                            tested_at: "2026-09-30T10:00:00.000Z",
                            works: true,
                        });
                    }
                    tx.oncomplete = () => {
                        db.close();
                        resolve(found ? "ok" : "no userSettings row");
                    };
                    tx.onerror = () => resolve(String(tx.error));
                };
            }),
        {dbName: DEXIE_DB_NAME, userId, providers: [...PROVIDERS]},
    );
}

/** Read the live keys and the rollback copies back out of IndexedDB. */
async function readKeys(page: Page, userId: string): Promise<KeyState> {
    return page.evaluate(
        ({dbName, userId, providers}) =>
            new Promise<KeyState>((resolve) => {
                const state: KeyState = {live: {}, rollback: {}};
                const openReq = indexedDB.open(dbName);
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const tx = db.transaction(["userSettings", "apiKeyBackups"], "readonly");
                    const getSettings = tx
                        .objectStore("userSettings")
                        .index("user_id")
                        .get(userId);
                    getSettings.onsuccess = () => {
                        for (const p of providers) {
                            state.live[p] = getSettings.result?.[`api_key_${p}`] ?? null;
                        }
                    };
                    for (const p of providers) {
                        const getBackup = tx.objectStore("apiKeyBackups").get(`${userId}#${p}`);
                        getBackup.onsuccess = () => {
                            state.rollback[p] = getBackup.result?.key ?? null;
                        };
                    }
                    tx.oncomplete = () => {
                        db.close();
                        resolve(state);
                    };
                };
            }),
        {dbName: DEXIE_DB_NAME, userId, providers: [...PROVIDERS]},
    );
}

/** Import ``bytes`` through the real file input and confirm. */
async function importFile(page: Page, name: string, bytes: Uint8Array): Promise<void> {
    await page.getByTestId("backup-file-input").setInputFiles({
        name,
        mimeType: "application/zip",
        buffer: Buffer.from(bytes),
    });
    await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
    await page.getByTestId("backup-confirm").click();
    await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});
}

test.describe("Backup - API keys never travel, content-verified (Dexie, #3367)", () => {
    test("the exported .alb carries no stored key; importing a key-carrying file changes no key", async ({
        page,
    }) => {
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
        const userId = await page.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        );
        expect(userId, "onboarding must have set a learner id").not.toBeNull();

        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        expect(await seedKeys(page, userId as string)).toBe("ok");

        // --- Export: real button, real download --------------------------
        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            page.getByTestId("backup-export").click(),
        ]);
        const albBytes = readFileSync((await download.path()) as string);
        const entries = unzipSync(new Uint8Array(albBytes));
        const dataName = Object.keys(entries).find((name) => name.endsWith("data.json"));
        expect(dataName, `entries: ${Object.keys(entries).join(", ")}`).toBeDefined();

        // --- Content proof: no key value anywhere in any entry ------------
        for (const [name, bytes] of Object.entries(entries)) {
            const text = strFromU8(bytes);
            for (const p of PROVIDERS) {
                expect(text, `${name} carries the ${p} key`).not.toContain(liveKey(p));
            }
        }
        const dataJson = JSON.parse(strFromU8(entries[dataName as string]));
        expect(dataJson.data.api_key_backups).toEqual([]);
        // eslint-disable-next-line no-console -- evidence for the programmatic
        // BACKUP-AKZEPTANZTEST proof, a reportable number.
        console.log(
            `[backup-roundtrip] .alb ${albBytes.byteLength} bytes, ${Object.keys(entries).length} entries, 0 key values`,
        );

        // --- Plain re-import of the real file: every key stays ----------
        await importFile(page, download.suggestedFilename(), new Uint8Array(albBytes));
        const afterPlain = await readKeys(page, userId as string);
        for (const p of PROVIDERS) {
            expect(afterPlain.live[p]).toBe(liveKey(p));
            expect(afterPlain.rollback[p]).toBe(liveKey(p));
        }

        // --- Import a key-carrying file (hand-edited / legacy) -----------
        const future = new Date(Date.now() + 86_400_000).toISOString();
        for (const row of dataJson.data.user_settings) {
            for (const p of PROVIDERS) row[`api_key_${p}`] = "sk-injected";
            row.updated_at = future;
        }
        dataJson.data.api_key_backups = PROVIDERS.map((p) => ({
            id: `${userId}#${p}`,
            user_id: userId,
            provider: p,
            key: "sk-injected",
            tested_at: future,
            works: true,
        }));
        const injected = zipSync({
            ...entries,
            [dataName as string]: strToU8(JSON.stringify(dataJson)),
        });
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        await importFile(page, "injected.alb", injected);
        // Columns: table, inserted, updated, skipped, errors.
        const keyRow = page.getByTestId("backup-summary-row-api_key_backups").locator("td");
        await expect(keyRow.nth(1)).toHaveText("0");
        await expect(keyRow.nth(3)).toHaveText("4");

        const afterInjected = await readKeys(page, userId as string);
        for (const p of PROVIDERS) {
            expect(afterInjected.live[p], `live ${p} key overwritten`).toBe(liveKey(p));
            expect(afterInjected.rollback[p], `rollback ${p} key overwritten`).toBe(liveKey(p));
        }

        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
