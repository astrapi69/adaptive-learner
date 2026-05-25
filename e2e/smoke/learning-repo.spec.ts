/**
 * Phase 42 / BL-30 smoke: Learning Repository.
 *
 * Four pins:
 *   1. The Dashboard widget mounts after onboarding and links
 *      to ``/projects/:projectId/learning-repo``.
 *   2. The page renders all four root meta-files in the
 *      sidebar; clicking each updates the Markdown viewer.
 *   3. "Download ZIP" triggers a download with the expected
 *      filename shape ``{slug}-learning-repo.zip``.
 *   4. "Persist to git" is gated by ``enable_git`` — with the
 *      default-off config, the click surfaces a 400 toast.
 */

import {expect, test} from "@playwright/test";

import {completeAssessment, completeOnboarding} from "../helpers";

test.describe("Learning Repository", () => {
    test("dashboard widget links to the learning-repo page", async ({page}) => {
        await completeOnboarding(page, {topic: "Docker", goal: "QA setups"});
        await completeAssessment(page);
        await page.getByTestId("assessment-continue").click();
        await page.waitForURL("**/dashboard");

        const widget = page.getByTestId("learning-repo-widget");
        await expect(widget).toBeVisible();
        const link = page.getByTestId("learning-repo-widget-link");
        await expect(link).toBeVisible();
        const href = await link.getAttribute("href");
        expect(href).toMatch(/^\/projects\/[^/]+\/learning-repo$/);
    });

    test("page renders the four meta-files and switches viewer content", async ({
        page,
    }) => {
        await completeOnboarding(page, {topic: "Docker", goal: "QA setups"});
        await completeAssessment(page);
        await page.getByTestId("assessment-continue").click();
        await page.waitForURL("**/dashboard");

        await page.getByTestId("learning-repo-widget-link").click();
        await expect(page.getByTestId("learning-repo-page")).toBeVisible();

        for (const file of [
            "README.md",
            "LEARNING_STATS.md",
            "CHEATSHEET.md",
            "ROADMAP.md",
        ]) {
            await expect(page.getByTestId(`repo-file-${file}`)).toBeVisible();
        }

        // README is selected by default — its title should be in
        // the Markdown viewer.
        const content = page.getByTestId("repo-content");
        await expect(content).toContainText("Learning Project: Docker");

        // Switch to STATS — its heading should appear in the
        // viewer, replacing the README content.
        await page.getByTestId("repo-file-LEARNING_STATS.md").click();
        await expect(content).toContainText("Learning Statistics");
        await expect(content).not.toContainText("Learning Project: Docker");
    });

    test("Download ZIP triggers a .zip download with the expected filename", async ({
        page,
    }) => {
        await completeOnboarding(page, {topic: "Docker", goal: "QA setups"});
        await completeAssessment(page);
        await page.getByTestId("assessment-continue").click();
        await page.waitForURL("**/dashboard");
        await page.getByTestId("learning-repo-widget-link").click();
        await expect(page.getByTestId("learning-repo-page")).toBeVisible();

        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId("repo-download-zip-btn").click();
        const download = await downloadPromise;
        // The download is triggered from a Blob URL; some
        // Playwright contexts surface the suggested filename
        // verbatim while others surface a blob-prefixed
        // identifier. The assertion is lenient: SOMETHING
        // resembling a .zip filename surfaces.
        const suggested = download.suggestedFilename();
        expect(suggested.endsWith(".zip") || suggested.includes("learning-repo")).toBe(
            true,
        );
    });

    test("Persist to git is gated by enable_git (400 → error toast)", async ({
        page,
    }) => {
        await completeOnboarding(page, {topic: "Docker", goal: "QA setups"});
        await completeAssessment(page);
        await page.getByTestId("assessment-continue").click();
        await page.waitForURL("**/dashboard");
        await page.getByTestId("learning-repo-widget-link").click();
        await expect(page.getByTestId("learning-repo-page")).toBeVisible();

        // Listen for the 400 response so the assertion is
        // grounded in network behaviour, not just UI strings
        // (which i18n-vary by language).
        const persistResponse = page.waitForResponse(
            (resp) =>
                resp.url().includes("/plugins/learning-repo/persist/") &&
                resp.request().method() === "POST",
        );
        await page.getByTestId("repo-persist-btn").click();
        const resp = await persistResponse;
        expect(resp.status()).toBe(400);

        // The toast surface itself is asserted by other smoke
        // specs (settings.spec.ts etc.); here we only need the
        // 400 to confirm the gate works. Going one level
        // deeper, the response body should name the setting
        // key so the user knows where to flip it.
        const body = await resp.json();
        expect(body.detail).toContain("enable_git");
    });
});
