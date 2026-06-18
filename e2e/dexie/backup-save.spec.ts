/**
 * Backup save-to-disk (Settings > Data) — Dexie mode (E2E hardening).
 *
 * Dexie build, NO backend. In a headless browser ``showSaveFilePicker``
 * is unavailable, so "Create Backup" falls back to a file download — we
 * assert the download fires (and no error toast). Needs a learner: the
 * export is a no-op without a user id.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors + the
 * Playwright download event + the toast library's error class (the same
 * class the release gate already keys on). No CSS-class layout or
 * DOM-structure assertions.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";

test.describe("Backup — save to disk (Dexie)", () => {
    test("Data tab exposes Create Backup and it triggers a download", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // Mock away the File System Access API so the save takes the
        // deterministic download fallback (showSaveFilePicker can't
        // complete in headless chromium). This is the "mock
        // showSaveFilePicker" path the feature is built to handle.
        await page.addInitScript(() => {
            try {
                // @ts-expect-error — remove the optional picker API.
                delete window.showSaveFilePicker;
            } catch {
                /* non-configurable in some engines; ignore */
            }
        });

        await createTestUser(page);
        await page.goto("/settings?tab=data");

        await expect(page.getByTestId("settings-panel-data")).toBeVisible({
            timeout: 15000,
        });
        const exportBtn = page.getByTestId("backup-export");
        await expect(exportBtn).toBeVisible();

        // headless chromium has no showSaveFilePicker -> download fallback.
        const [download] = await Promise.all([
            page.waitForEvent("download", {timeout: 15000}),
            exportBtn.click(),
        ]);
        // EXP-031 (#714) — backups now export as the `.alb` ZIP
        // container, not a bare `.json` dump.
        expect(download.suggestedFilename()).toMatch(/\.alb$/);

        // The export reported success (no error toast).
        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
        // The "last backup" indicator now shows.
        await expect(page.getByTestId("backup-last-backup")).toBeVisible({
            timeout: 10000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("Create Backup button is present at 375px (mobile)", async ({page}) => {
        await page.setViewportSize({width: 375, height: 720});
        await createTestUser(page);
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({
            timeout: 15000,
        });
        await expect(page.getByTestId("backup-export")).toBeVisible();
    });
});
