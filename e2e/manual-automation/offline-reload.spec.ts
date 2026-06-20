/**
 * True-offline reload (manual test plan gap-fill).
 *
 * The Dexie/PWA build must survive a full reload with the network down: the
 * service worker serves the app shell + lazy route chunks from its precache,
 * and the learner's data lives in IndexedDB. This is stricter than the
 * dexie-smoke gate (which runs with no backend, but still online) — here the
 * whole network is cut via ``context.setOffline``.
 *
 * The test waits for an ACTIVE service worker before going offline (the shell
 * is uncacheable otherwise) and skips with a reason if the build ships no SW,
 * so it never false-fails on a non-PWA preview.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { seedLearner } from "./helpers/setup";

/** Poll (bounded) for an active service-worker registration. */
async function waitForActiveServiceWorker(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return page
    .evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      for (let i = 0; i < 30; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) return true;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return false;
    })
    .catch(() => false);
}

test.describe("Offline reload", () => {
  test("the app still loads after going offline and reloading", async ({
    page,
    context,
  }) => {
    const errors = installErrorCollectors(page);
    await seedLearner(page);
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });

    const swReady = await waitForActiveServiceWorker(page);
    test.skip(!swReady, "no active service worker in this build (offline shell unavailable)");

    // Reload once so the active worker controls the page, then cut the network
    // and reload again — the shell + Dashboard chunk must come from the SW
    // precache and IndexedDB.
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
    // The offline indicator surfaces; no error toast or uncaught error.
    await expect(page.getByTestId("offline-indicator")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
    expect(errors.pageErrors()).toEqual([]);

    await context.setOffline(false);
  });
});
