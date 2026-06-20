/**
 * Navigation redirects (manual test plan gap-fill).
 *
 * EXP-037 (#850) + the Content-hub merge (#856/#857) kept old destinations
 * alive by redirecting them to their new tabbed homes. A bookmarked old URL
 * must land on the new tab, NOT on the NotFound page. These are client-side
 * ``<Navigate replace>`` route elements in ``App.tsx``, so the test asserts the
 * URL actually changes to the new target (a ``*``/NotFound fallback would keep
 * the original URL).
 *
 * Reality note: the redirect targets are the CURRENT ones on ``develop`` —
 * ``/import`` and ``/discover`` now fold into ``/content?tab=...`` (#856), not
 * the v1.91.0 ``/discover?tab=import`` shape that predated the hub merge.
 *
 * Dexie build, no backend; content is mocked so the ``/content`` targets render
 * without a content-repo checkout or network egress.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

interface Redirect {
  from: string;
  /** Regex the final URL must match (query string included). */
  to: RegExp;
}

const REDIRECTS: Redirect[] = [
  { from: "/statistics", to: /\/progress\?tab=stats/ },
  { from: "/curriculum", to: /\/progress\?tab=paths/ },
  { from: "/import", to: /\/content\?tab=import/ },
  { from: "/discover", to: /\/content\?tab=discover/ },
];

test.describe("Navigation redirects", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
    await seedLearner(page);
  });

  for (const { from, to } of REDIRECTS) {
    test(`${from} redirects to ${to.source} (not a 404)`, async ({ page }) => {
      const errors = installErrorCollectors(page);
      await page.goto(from);
      // The client-side <Navigate replace> rewrites the URL to the new home.
      await page.waitForURL(to, { timeout: 15_000 });
      // A redirect, not the catch-all NotFound (which would keep `from`).
      await expect(page.getByTestId("not-found")).toHaveCount(0);
      await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
      expect(errors.pageErrors()).toEqual([]);
    });
  }

  test("an unknown route still renders the NotFound page", async ({ page }) => {
    // The complement: a genuinely unknown path DOES reach the catch-all,
    // proving the redirects above are deliberate, not a blanket fallback.
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByTestId("not-found")).toBeVisible({ timeout: 15_000 });
  });
});
