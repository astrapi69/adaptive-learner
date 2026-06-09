/**
 * #150 — first-run backup restore on an empty install.
 *
 * Dexie build, NO backend. A returning learner on a fresh device
 * (empty IndexedDB) is offered "Restore from existing backup" on the
 * onboarding screen. The restore adopts the backup's identity — seeds
 * the original user/project/language into localStorage — then merges
 * the data and lands on the Dashboard.
 *
 * The decisive check is a REAL round-trip across two isolated browser
 * contexts:
 *
 *   1. Context A: onboard a learner, export a backup file from
 *      Settings > Data (headless chromium has no ``showSaveFilePicker``,
 *      so the export falls back to a normal download we capture).
 *   2. Context B: a brand-new context with its OWN empty IndexedDB
 *      (the "new device"). Feed the captured file to the onboarding
 *      restore input and assert the learner lands on the Dashboard
 *      with the ORIGINAL user id adopted — only possible if the
 *      identity-adopting restore actually ran.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors + the Playwright
 * download event + the toast library's error class.
 */

import {readFileSync} from "node:fs";

import {expect, test} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

const TOPIC = "Spanish B1";

test.describe("#150 — first-run backup restore (Dexie)", () => {
    test("export on one device, restore on a fresh device via onboarding", async ({
        page,
        browser,
    }) => {
        // --- Context A: create a learner and export their backup ------
        // Remove the optional File System Access API so "Create Backup"
        // takes the deterministic download fallback (the picker can't
        // complete in headless chromium).
        await page.addInitScript(() => {
            try {
                // @ts-expect-error — remove the optional picker API.
                delete window.showSaveFilePicker;
            } catch {
                /* non-configurable in some engines; ignore */
            }
        });

        await completeOnboarding(page, {topic: TOPIC}); // lands on /assessment

        const originalUserId = await page.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        );
        expect(originalUserId, "onboarding seeded a user id").toBeTruthy();

        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({
            timeout: 15000,
        });
        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            page.getByTestId("backup-export").click(),
        ]);
        const backupBytes = readFileSync(await download.path());
        expect(backupBytes.length).toBeGreaterThan(0);

        // --- Context B: a fresh device with an empty IndexedDB --------
        const deviceB = await browser.newContext();
        const pageB = await deviceB.newPage();
        const errorsB: string[] = [];
        pageB.on("pageerror", (e) => errorsB.push(e.message));

        await pageB.goto("/onboarding");
        // Empty install → the restore affordance is offered.
        const restoreBtn = pageB.getByTestId("onboarding-restore-backup");
        await expect(restoreBtn).toBeVisible({timeout: 15000});

        // Feed the captured backup to the (hidden) file input.
        await pageB.getByTestId("onboarding-restore-input").setInputFiles({
            name: "adaptive-learner-backup.json",
            mimeType: "application/json",
            buffer: backupBytes,
        });

        // The identity-adopting restore lands on the Dashboard.
        await pageB.waitForURL("**/dashboard", {timeout: 20000});
        await expect(pageB.getByTestId("dashboard")).toBeVisible({
            timeout: 15000,
        });
        await expect(pageB.locator(".Toastify__toast--error")).toHaveCount(0);

        // Decisive: context B adopted the ORIGINAL user id — the restore
        // re-keyed the fresh install to the backup's owner.
        const adoptedUserId = await pageB.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        );
        expect(adoptedUserId).toBe(originalUserId);

        expect(errorsB, `page errors: ${errorsB.join("; ")}`).toEqual([]);

        await deviceB.close();
    });

    test("the restore affordance is hidden once the learner has data", async ({
        page,
    }) => {
        await completeOnboarding(page, {topic: TOPIC}); // user + project exist

        // Returning to onboarding with data present: no restore button.
        await page.goto("/onboarding");
        await expect(page.getByTestId("onboarding")).toBeVisible({
            timeout: 15000,
        });
        await expect(
            page.getByTestId("onboarding-restore-backup"),
        ).toHaveCount(0);
    });
});
