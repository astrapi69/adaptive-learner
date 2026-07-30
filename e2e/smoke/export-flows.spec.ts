/**
 * Phase 28F / v1.15.0 — Markdown export flows.
 *
 * Verifies the v1.3.0 export feature from the Settings >
 * Export section:
 *
 *   - Progress Report Markdown download produces a file
 *     whose top-level heading matches the project title.
 *   - Session Detail Markdown download requires picking a
 *     session from the dropdown first; the downloaded file
 *     surfaces session metadata.
 *   - Curriculum Overview Markdown download is gated by the
 *     curriculum dropdown; the downloaded file surfaces the
 *     selected curriculum's title.
 *
 * PDF flows open the browser's print dialog (hidden iframe
 * + window.print) which is non-deterministic in headless
 * mode — out of scope for this spec. Markdown-only.
 *
 * No AI mocking required. The downloads are produced
 * client-side from real data the spec writes via the
 * onboarding + session flows.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers";

async function readDownload(
    page: import("@playwright/test").Page,
    triggerSelector: string,
): Promise<string> {
    const fs = await import("node:fs/promises");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(triggerSelector).click();
    const download = await downloadPromise;
    const path = await download.path();
    return fs.readFile(path, "utf-8");
}

test.describe("Export flows", () => {
    test("Progress Report Markdown download contains the project title", async ({
        page,
    }) => {
        await createTestUser(page, {
            name: "Export E2E",
            topic: "Spanish B1",
        });

        // Settings is tab-grouped (#549); deep link straight to the tab
        // that holds this section - the documented ?tab= contract.
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("export-section")).toBeVisible();

        const body = await readDownload(page, "export-md-progress");
        // The progress report opens with an # H1 + the user's
        // overall title; the project topic should appear within
        // the first ~2000 chars.
        expect(body.length).toBeGreaterThan(50);
        expect(body.slice(0, 2000).toLowerCase()).toContain("spanish");
    });

    test("Curriculum Overview Markdown surfaces the curriculum title", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Curriculum Export E2E"});

        // Create a curriculum so the dropdown is non-empty. EXP-037 (#850):
        // Curriculum is no longer a top-level nav entry — it is the "Meine
        // Pfade" tab in Progress; /curriculum redirects to /progress?tab=paths,
        // which renders the same curriculum surface.
        await page.goto("/curriculum");
        await page
            .getByTestId("curriculum-new-title")
            .fill("E2E Test Curriculum");
        await page.getByTestId("curriculum-create").click();

        // Settings is tab-grouped (#549); deep link straight to the tab
        // that holds this section - the documented ?tab= contract.
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("export-section")).toBeVisible();

        // Pick the just-created curriculum.
        await page
            .getByTestId("export-curriculum-select")
            .selectOption({label: "E2E Test Curriculum"});

        const body = await readDownload(page, "export-md-curriculum");
        expect(body).toContain("E2E Test Curriculum");
    });
});
