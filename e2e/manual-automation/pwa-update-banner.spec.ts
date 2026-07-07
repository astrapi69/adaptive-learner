/**
 * PWA update-banner persistence (manual test plan gap-fill, #846).
 *
 * The "new version available" banner must never re-nag once the user clicks
 * "Aktualisieren": acceptance is persisted (version + timestamp in
 * localStorage) and gated by ``shouldShowUpdateBanner`` so it stays dismissed
 * across reloads — yet a genuinely NEWER version still re-offers it once the
 * 1h quiet window has passed.
 *
 * The banner is driven by ``version.json`` (compared to the built-in
 * ``__APP_VERSION__``), so the suite routes ``version.json`` to a controllable
 * newer version — no real deploy, no service-worker timing dependence. The
 * banner is Dexie/PWA-only (``UpdatePromptHost`` returns null in API mode), so
 * it only surfaces in this GH-Pages-shape build.
 */

import { expect, test, type Page } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";

/** localStorage keys from ``lib/pwa/update-accept.ts``. */
const ACCEPTED_VERSION_KEY = "adaptive-learner.update.accepted_version";
const ACCEPTED_AT_KEY = "adaptive-learner.update.last_accepted_at";

/** Route ``version.json`` to whatever ``current()`` returns at fetch time.
 *
 * The glob ends in ``*`` on purpose: the app fetches ``version.json`` with a
 * cache-buster query string (``?cb=<ts>``, #1382, to defeat the GitHub-Pages
 * edge cache). A bare ``**​/version.json`` glob is ``$``-anchored and would NOT
 * match ``version.json?cb=123``, so the mock would never intercept the real
 * request and every assertion below would run against the deployed manifest. */
async function routeVersionJson(
  page: Page,
  current: () => { version: string; buildHash: string },
): Promise<void> {
  await page.route("**/version.json*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(current()),
    }),
  );
}

/** Read a localStorage key without throwing if the context is mid-reload. */
async function readKey(page: Page, key: string): Promise<string | null | undefined> {
  try {
    return await page.evaluate((k) => localStorage.getItem(k), key);
  } catch {
    return undefined;
  }
}

test.describe("PWA update banner (#846)", () => {
  test("a newer version shows the banner", async ({ page }) => {
    await routeVersionJson(page, () => ({
      version: "999.0.0",
      buildHash: "e2e-newer",
    }));
    await page.goto("/");
    await expect(page.getByTestId("update-prompt")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("clicking Update persists acceptance and the banner stays gone", async ({
    page,
  }) => {
    const errors = installErrorCollectors(page);
    await routeVersionJson(page, () => ({
      version: "999.0.0",
      buildHash: "e2e-newer",
    }));
    await page.goto("/");
    await expect(page.getByTestId("update-prompt")).toBeVisible({
      timeout: 15_000,
    });
    // Not accepted yet.
    expect(await readKey(page, ACCEPTED_VERSION_KEY)).toBeNull();

    await page.getByTestId("update-prompt-apply").click();

    // The accepted version is persisted (survives the background reload).
    await expect
      .poll(() => readKey(page, ACCEPTED_VERSION_KEY), { timeout: 15_000 })
      .toBe("999.0.0");

    // A fresh load of the SAME deployed version no longer offers the banner.
    await page.goto("/");
    await expect(page.getByTestId("update-prompt")).toHaveCount(0);
    expect(errors.pageErrors()).toEqual([]);
  });

  test("a genuinely newer version re-offers the banner after the quiet window", async ({
    page,
  }) => {
    // Seed a prior acceptance of 999.0.0, stamped 2h ago (past the 1h quiet
    // window) — exactly the state after a real "Aktualisieren" + a later visit.
    const twoHoursAgoIso = new Date(
      Date.now() - 2 * 60 * 60 * 1000,
    ).toISOString();
    await page.addInitScript(
      ([versionKey, atKey, version, atIso]) => {
        localStorage.setItem(versionKey, version);
        localStorage.setItem(atKey, atIso);
      },
      [ACCEPTED_VERSION_KEY, ACCEPTED_AT_KEY, "999.0.0", twoHoursAgoIso] as const,
    );
    // A genuinely newer deploy than the accepted one.
    await routeVersionJson(page, () => ({
      version: "1000.0.0",
      buildHash: "e2e-even-newer",
    }));
    await page.goto("/");
    await expect(page.getByTestId("update-prompt")).toBeVisible({
      timeout: 15_000,
    });
  });
});
