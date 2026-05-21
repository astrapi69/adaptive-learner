/**
 * Phase 28D / v1.15.0 — Backup export + restore roundtrip.
 *
 * Verifies the v1.10.0 backup feature contract:
 *
 *   - Settings > Backup > "Create Backup" downloads a JSON
 *     file. The file contains the expected top-level tables
 *     (users, learning_projects, etc.) and explicitly does
 *     NOT contain any API key fields (the user-settings rows
 *     omit ``api_key_*`` columns).
 *   - Re-uploading the same file via "Restore from Backup"
 *     surfaces the per-table comparison preview (number of
 *     records the restore will add / update / leave alone).
 *   - Confirming the restore lands cleanly (no error toast)
 *     and the comparison block clears.
 *
 * Pure backend feature — no AI mocking required. The spec
 * creates data via the real onboarding flow, exports, then
 * re-imports the same payload.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers";

test.describe("Backup export + restore", () => {
    test("export downloads JSON, re-upload renders comparison + clean confirm", async ({
        page,
    }) => {
        // Step 1: create a user + project + complete the
        // assessment so the backup has real rows to export.
        await createTestUser(page, {name: "Backup E2E"});

        // Step 2: navigate to Settings -> Backup section.
        await page.getByTestId("nav-settings").click();
        await page.waitForURL("**/settings");
        await expect(page.getByTestId("settings-backup")).toBeVisible();

        // Step 3: click Create Backup and capture the downloaded
        // file. Playwright's ``waitForEvent("download")`` captures
        // the browser-initiated download.
        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId("backup-export").click();
        const download = await downloadPromise;
        const path = await download.path();
        const fs = await import("node:fs/promises");
        const raw = await fs.readFile(path, "utf-8");
        const payload = JSON.parse(raw);

        // Top-level envelope shape (v1.10.0 contract).
        expect(typeof payload.format).toBe("string");
        expect(typeof payload.user_id).toBe("string");
        expect(payload.data).toBeTruthy();

        // Expected tables in ``data`` — each must be an array
        // (possibly empty).
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
            expect(Array.isArray(payload.data[table])).toBe(true);
        }

        // API keys MUST NOT leak into the export. Every
        // user_settings row must omit ``api_key_*`` fields
        // (the v0.4.0 contract strips them entirely).
        for (const row of payload.data.user_settings ?? []) {
            for (const key of Object.keys(row as Record<string, unknown>)) {
                expect(key.startsWith("api_key_")).toBe(false);
            }
        }

        // Step 4: feed the downloaded file back through the
        // restore picker via the hidden file input.
        await page
            .getByTestId("backup-file-input")
            .setInputFiles(path);

        // Step 5: the comparison preview surfaces.
        await expect(page.getByTestId("backup-comparison")).toBeVisible({
            timeout: 15_000,
        });

        // Step 6: confirm the restore. Importing the same payload
        // we just exported should produce a no-op restore (every
        // record already exists; mutable rows match by
        // updated_at; history rows are append-only).
        await page.getByTestId("backup-confirm").click();
        // The comparison block unmounts once the restore finishes.
        await expect(page.getByTestId("backup-comparison")).toHaveCount(
            0,
            {timeout: 15_000},
        );
    });
});
