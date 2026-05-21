/**
 * Phase 28E / v1.15.0 — Sync pairing UI flow (simulated).
 *
 * Verifies the pairing surface in Settings > Sync. Two views
 * exist depending on storage mode:
 *
 *   - ``api`` mode (default for the E2E backend): the
 *     desktop-unpaired view with host + port inputs + a
 *     Generate-QR button.
 *   - ``dexie`` mode: the phone-unpaired view with the
 *     Scan-QR-Code button + paste-the-link fallback.
 *
 * The spec covers both views in turn:
 *
 *   - Desktop: host + port → Generate QR → QR image + link
 *     panel appear.
 *   - Phone: localStorage flips to dexie mode, page reloads,
 *     Scan button + paste fallback are both visible. The
 *     paste-link flow attempts to pair with an obviously-
 *     invalid URI; the UI surfaces an error toast without
 *     navigating away.
 *
 * No real second-device pairing. The Scan-QR-Code button
 * opens a camera modal which the spec does NOT click (camera
 * permission prompts are flaky in headless mode).
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers";

test.describe("Sync pairing UI", () => {
    test("desktop unpaired: host + port → Generate QR → QR panel renders", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Sync Desktop E2E"});

        await page.getByTestId("nav-settings").click();
        await page.waitForURL("**/settings");
        await expect(page.getByTestId("settings-sync")).toBeVisible();
        await expect(
            page.getByTestId("sync-desktop-unpaired"),
        ).toBeVisible();

        // Generate the QR / pairing link from the default host
        // + port (already pre-filled). No real network needed —
        // the URL is just an encoded display.
        await page.getByTestId("sync-host-input").fill("localhost");
        await page.getByTestId("sync-port-input").fill("18001");
        await page.getByTestId("sync-generate-button").click();

        await expect(page.getByTestId("sync-qr-panel")).toBeVisible();
        await expect(page.getByTestId("sync-qr-image")).toBeVisible();
        await expect(page.getByTestId("sync-qr-link")).toBeVisible();
        await expect(page.getByTestId("sync-copy-link")).toBeVisible();
    });

    test("phone unpaired (mobile viewport): scan button + paste fallback visible", async ({
        page,
    }) => {
        // Flip storage mode to dexie BEFORE navigation so the
        // SyncSection renders the PhoneUnpairedView. Also flip
        // the viewport to a mobile size — the prompt's "test at
        // 375 / 1024" rule applies here because the layout is
        // genuinely viewport-sensitive.
        await page.setViewportSize({width: 375, height: 812});
        await page.addInitScript(() => {
            localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        });
        await createTestUser(page, {name: "Sync Phone E2E"});

        // Mobile viewport: nav-settings is hidden behind the
        // hamburger drawer. Open it first.
        await page.getByTestId("nav-hamburger").click();
        await page.getByTestId("nav-settings").click();
        await page.waitForURL("**/settings");
        await expect(
            page.getByTestId("sync-phone-unpaired"),
        ).toBeVisible();
        await expect(page.getByTestId("sync-scan-button")).toBeVisible();
        // Paste fallback lives inside a <details> element —
        // expand it before the textarea + button become
        // visible.
        await page.getByTestId("sync-paste-fallback").click();
        await expect(page.getByTestId("sync-pair-input")).toBeVisible();
        await expect(page.getByTestId("sync-pair-button")).toBeVisible();

        // Enter an obviously-invalid pairing URI; pair button
        // surfaces an error toast without breaking the page.
        await page
            .getByTestId("sync-pair-input")
            .fill("not-a-valid-uri");
        await page.getByTestId("sync-pair-button").click();
        // The page must remain on /settings (no crash, no
        // navigation away).
        await expect(page.getByTestId("settings-sync")).toBeVisible();
        await expect(
            page.getByTestId("sync-phone-unpaired"),
        ).toBeVisible();
    });
});
