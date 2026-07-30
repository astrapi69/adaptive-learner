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

        // Settings is tab-grouped (#549); deep link straight to the tab
        // that holds this section - the documented ?tab= contract.
        await page.goto("/settings?tab=data");
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

    test("browser mode (mobile viewport): sync section shows the desktop-only notice", async ({
        page,
    }) => {
        // SYNC-UI-GATE (#335): in Dexie/browser mode the sync feature is
        // DISABLED with a desktop_only notice - the pairing UI this spec
        // used to assert was deliberately retired until Phase 1 LAN mode
        // lands, and must NOT reappear here (#2170: the old assertion
        // pinned removed behaviour). The section header stays visible so
        // the learner knows the feature exists.
        await page.setViewportSize({width: 375, height: 812});
        await page.addInitScript(() => {
            localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        });
        await createTestUser(page, {name: "Sync Phone E2E"});
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-sync-desktop-only")).toBeVisible();
        await expect(page.getByTestId("sync-phone-unpaired")).toHaveCount(0);
    });
});
