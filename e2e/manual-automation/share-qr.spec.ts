/**
 * QR-code app sharing (manual test plan gap-fill, #775/#788).
 *
 * Settings > About carries a "Share the app" entry: a "Show QR code" button
 * opens the reusable ``QrCodeModal`` (copy / download-PNG / native share) of
 * the public app URL. The QR is generated client-side via the ``qrcode``
 * library, so it works in the Dexie/GH-Pages build with no backend.
 *
 * Covers: the section + trigger render, the modal opens with a generated QR
 * image + copyable URL + download action, and Escape dismisses it.
 */

import { expect, test } from "@playwright/test";

import { seedLearner } from "./helpers/setup";

test.describe("QR-code app sharing (#775)", () => {
  test.beforeEach(async ({ page }) => {
    await seedLearner(page);
    await page.goto("/settings?tab=about");
    await expect(page.getByTestId("settings-panel-about")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the About tab offers a Share-the-app QR entry", async ({ page }) => {
    await expect(page.getByTestId("about-share-section")).toBeVisible();
    await expect(page.getByTestId("about-share-show-qr")).toBeVisible();
  });

  test("Show QR code opens the modal with a generated code + actions", async ({
    page,
  }) => {
    await page.getByTestId("about-share-show-qr").click();

    const modal = page.getByTestId("qr-code-modal");
    await expect(modal).toBeVisible();
    // The qrcode library renders the PNG into an <img> asynchronously.
    await expect(page.getByTestId("qr-code-modal-image")).toBeVisible({
      timeout: 10_000,
    });
    // The copyable URL + the download action (the anchor appears once the
    // data URL exists).
    await expect(page.getByTestId("qr-code-modal-url")).toBeVisible();
    await expect(page.getByTestId("qr-code-modal-copy")).toBeVisible();
    await expect(page.getByTestId("qr-code-modal-download")).toBeVisible();
  });

  test("Escape closes the QR modal", async ({ page }) => {
    await page.getByTestId("about-share-show-qr").click();
    await expect(page.getByTestId("qr-code-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("qr-code-modal")).toHaveCount(0);
  });
});
