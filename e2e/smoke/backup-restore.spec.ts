/**
 * Backup export + restore roundtrip (#2177 rewrite of the Phase 28D spec).
 *
 * The v1.15.0 spec asserted the pre-`.alb` UI generation (plain JSON
 * download) and was silenced at the v2.7.0 release gate (#2170). This is
 * the rewrite against the CURRENT contract:
 *
 *   - Settings > Data > "Create Backup" downloads an `.alb` container
 *     (deflate ZIP: manifest.json + data.json, EXP-031). The manifest is
 *     readable before the data; the payload carries the expected
 *     top-level tables and the user_settings rows omit every
 *     ``api_key_*`` column (the v0.4.0 no-key-leak contract).
 *   - Re-uploading the same file through the hidden file input surfaces
 *     the pre-restore comparison panel; confirming lands cleanly (the
 *     panel unmounts, the restore summary appears, no error toast).
 *
 * Until this spec went live again, the ONLY coverage of this path was
 * the manual BACKUP-AKZEPTANZTEST (quality-checks.md) - it had no
 * automated signal from 2026-05-23 to this rewrite.
 */

import {expect, test} from "@playwright/test";

import {readAlb} from "../helpers/alb";
import {createTestUser} from "../helpers";

test.describe("Backup export + restore", () => {
    test("export downloads an .alb, re-upload renders comparison + clean confirm", async ({
        page,
    }) => {
        // Step 0: force the blob-download path. Chromium exposes
        // showSaveFilePicker (BACKUP-DIR-EXPORT-01), which opens a NATIVE
        // OS save dialog Playwright cannot script; removing the API makes
        // the app take its documented Firefox/Safari fallback, which
        // emits the download event this spec captures.
        await page.addInitScript(() => {
            delete (window as {showSaveFilePicker?: unknown}).showSaveFilePicker;
        });

        // Step 1: real data via the real onboarding flow (the helper
        // dismisses the #1085 migration-welcome overlay).
        await createTestUser(page, {name: "Backup E2E"});

        // Step 2: deep link straight to the Data tab (#549 ?tab= contract).
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-backup")).toBeVisible();

        // Step 3: Create Backup downloads one `.alb` file.
        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId("backup-export").click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.alb$/);
        const albPath = await download.path();

        // Step 4: container contract - manifest readable, payload shaped.
        const {manifest, data: payload} = readAlb(albPath);
        expect(manifest.format).toBe("adaptive-learner-backup");
        expect(manifest.container).toBe("alb");
        expect(typeof manifest.user_id).toBe("string");
        expect(manifest.backup_type).toBe("full");
        const tables = (payload as {data: Record<string, unknown>}).data;
        const expectedTables = [
            "users",
            "user_settings",
            "learning_projects",
            "learning_profiles",
            "curriculums",
            "learning_topics",
            "lessons",
        ];
        for (const table of expectedTables) {
            expect(Array.isArray(tables[table]), `data.${table} is an array`).toBe(true);
        }

        // API keys MUST NOT leak: every user_settings row omits api_key_*.
        for (const row of (tables.user_settings as Record<string, unknown>[]) ?? []) {
            for (const key of Object.keys(row)) {
                expect(key.startsWith("api_key_"), `user_settings leaks ${key}`).toBe(false);
            }
        }

        // Step 5: feed the file back through the hidden input.
        await page.getByTestId("backup-file-input").setInputFiles(albPath);

        // Step 6: the pre-restore comparison panel surfaces.
        await expect(page.getByTestId("backup-comparison")).toBeVisible({
            timeout: 15_000,
        });

        // Step 7: confirm. Restoring the export we just made is a clean
        // no-op restore; the panel unmounts, the summary appears, and no
        // error toast fires.
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-comparison")).toHaveCount(0, {
            timeout: 15_000,
        });
        await expect(page.getByTestId("backup-summary")).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
    });
});
