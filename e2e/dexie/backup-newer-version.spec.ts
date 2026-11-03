/**
 * A backup from a newer app version (#3827), through the real file input of
 * the browser build.
 *
 * A newer minor format restores what this build knows and then names the
 * segments it skipped; a newer major format is rejected before the restore
 * dialog opens, in Settings and in onboarding. The assertions match the
 * version strings and segment names, which no catalog translates.
 */

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";

const TS = "2026-10-31T10:00:00+00:00";

function backup(userId: string, version: string, extra: Record<string, unknown> = {}): Buffer {
    const payload = {
        format: "adaptive-learner-backup",
        version,
        app_version: "99.0.0",
        created_at: TS,
        user_id: userId,
        storage_mode: "dexie",
        data: {
            tags: [{id: "tag-3827", user_id: userId, name: "from-the-future", created_at: TS}],
            future_table: [{id: "f-1"}],
        },
        content_sets: [],
        stats: {total_records: 2, tables: {tags: 1, future_table: 1}},
        ...extra,
    };
    return Buffer.from(JSON.stringify(payload));
}

async function userIdOf(page: Page): Promise<string> {
    const userId = await page.evaluate(() => localStorage.getItem("adaptive-learner.user_id"));
    expect(userId).not.toBeNull();
    return userId as string;
}

async function pickInSettings(page: Page, buffer: Buffer): Promise<void> {
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
    await page.getByTestId("backup-file-input").setInputFiles({
        name: "newer.json",
        mimeType: "application/json",
        buffer,
    });
}

test.describe("Backup from a newer app version (Dexie, #3827)", () => {
    test("a newer minor format restores and names what it skipped", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await createTestUser(page);
        const userId = await userIdOf(page);

        await pickInSettings(page, backup(userId, "1.99.0", {future_block: {x: 1}}));
        await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});

        const note = page.locator(".Toastify__toast--warning").filter({hasText: "1.99.0"});
        await expect(note).toBeVisible({timeout: 10000});
        await expect(note).toContainText("future_block");
        await expect(note).toContainText("future_table");
        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("a newer major format is rejected in Settings before the restore dialog", async ({page}) => {
        await createTestUser(page);
        const userId = await userIdOf(page);

        await pickInSettings(page, backup(userId, "2.0.0"));
        const message = page.locator(".Toastify__toast--warning").filter({hasText: "2.0.0"});
        await expect(message).toBeVisible({timeout: 10000});
        await expect(message).toContainText("1.x");
        await expect(page.getByTestId("backup-comparison")).toHaveCount(0);
    });

    test("a newer major format is rejected in onboarding", async ({page}) => {
        await page.goto("/onboarding");
        await expect(page.getByTestId("onboarding-restore-backup")).toBeVisible({timeout: 15000});
        await page.getByTestId("onboarding-restore-input").setInputFiles({
            name: "newer.json",
            mimeType: "application/json",
            buffer: backup("someone-else", "2.0.0"),
        });
        const message = page.locator(".Toastify__toast--warning").filter({hasText: "2.0.0"});
        await expect(message).toBeVisible({timeout: 10000});
        await expect(message).toContainText("1.x");
        await expect(page.getByTestId("dashboard")).toHaveCount(0);
    });
});
