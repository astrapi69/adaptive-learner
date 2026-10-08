/**
 * Connected repositories, redeemed invites and the Learning Repository switch
 * survive a browser round trip (#3412).
 *
 * They live in plugin settings, which the backup did not carry: after Export,
 * new device, Import the sets came back without their sources. The payload's
 * ``plugin_settings`` block now carries the learner's keys. This spec drives
 * the real Export button and download, reads the file, wipes the settings,
 * imports the same bytes through the real file input and reads the settings
 * store back. ``repos_dir`` (a folder on this device) must stay behind.
 */

import {readFileSync} from "node:fs";

import {expect, test, type Page} from "@playwright/test";
import {strFromU8, unzipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const TS = "2026-06-01T10:00:00.000Z";
const REPO = {
    url: "https://github.com/coach-e2e/greek-a1",
    owner: "coach-e2e",
    repo: "greek-a1",
    branch: "main",
    connected: true,
    last_synced: TS,
    set_count: 2,
    lesson_count: 11,
    shared_via_invite: true,
};
const REDEMPTION = {code: "E2E-INVITE", repo: "coach-e2e/greek-a1", redeemed_at: TS};

type SettingsRows = Record<string, Record<string, unknown> | null>;

async function writeSettings(page: Page, rows: Record<string, Record<string, unknown>>): Promise<void> {
    await page.evaluate(
        ({dbName, rows, ts}) =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open(dbName);
                open.onsuccess = () => {
                    const db = open.result;
                    const tx = db.transaction("pluginSettings", "readwrite");
                    for (const [name, settings] of Object.entries(rows)) {
                        tx.objectStore("pluginSettings").put({name, settings, updated_at: ts});
                    }
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = () => reject(String(tx.error));
                };
            }),
        {dbName: DEXIE_DB_NAME, rows, ts: TS},
    );
}

async function readSettings(page: Page, names: string[]): Promise<SettingsRows> {
    return page.evaluate(
        ({dbName, names}) =>
            new Promise<SettingsRows>((resolve) => {
                const open = indexedDB.open(dbName);
                open.onsuccess = () => {
                    const db = open.result;
                    const store = db.transaction("pluginSettings", "readonly").objectStore("pluginSettings");
                    const out: SettingsRows = {};
                    let pending = names.length;
                    for (const name of names) {
                        const req = store.get(name);
                        req.onsuccess = () => {
                            out[name] = req.result?.settings ?? null;
                            pending -= 1;
                            if (pending === 0) {
                                db.close();
                                resolve(out);
                            }
                        };
                    }
                };
            }),
        {dbName: DEXIE_DB_NAME, names},
    );
}

test.describe("Backup - plugin settings round trip (Dexie, #3412)", () => {
    test("connected repos, invites and the git switch come back; the repos folder does not", async ({page}) => {
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
        await writeSettings(page, {
            "content-loader": {user_repos: [REPO], invite_redemptions: [REDEMPTION]},
            "learning-repo": {enable_git: true, repos_dir: "/home/learner/repos"},
        });

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
            plugin_settings?: Record<string, Record<string, unknown>>;
        };
        expect(payload.plugin_settings).toEqual({
            "content-loader": {user_repos: [REPO], invite_redemptions: [REDEMPTION]},
            "learning-repo": {enable_git: true},
        });

        // --- Wipe: a fresh device has no plugin settings rows --------------
        await page.evaluate(
            ({dbName}) =>
                new Promise<void>((resolve) => {
                    const open = indexedDB.open(dbName);
                    open.onsuccess = () => {
                        const db = open.result;
                        const tx = db.transaction("pluginSettings", "readwrite");
                        tx.objectStore("pluginSettings").clear();
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                    };
                }),
            {dbName: DEXIE_DB_NAME},
        );
        expect(await readSettings(page, ["content-loader", "learning-repo"])).toEqual({
            "content-loader": null,
            "learning-repo": null,
        });

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

        // --- The settings store holds the learner's keys again -------------
        await expect
            .poll(async () => (await readSettings(page, ["content-loader"]))["content-loader"]?.user_repos, {
                timeout: 10000,
            })
            .toEqual([REPO]);
        const restored = await readSettings(page, ["content-loader", "learning-repo"]);
        expect(restored["content-loader"]?.invite_redemptions).toEqual([REDEMPTION]);
        expect(restored["learning-repo"]?.enable_git).toBe(true);
        expect(restored["learning-repo"]?.repos_dir).not.toBe("/home/learner/repos");

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
