/**
 * Navigation structure (manual test plan gap-fill, complements
 * ``nav-redirects.spec.ts``).
 *
 * EXP-037 (#850) restructured the nav into a small grouped primary bar
 * (Nielsen-Norman 5-7) plus a mobile ``BottomTabBar`` (4 tabs + a "More"
 * sheet), and KEPT several pages reachable by URL after dropping them from the
 * nav (``/session``, ``/anki``, ``/pronunciation``, ``/create-lesson``). The
 * redirects spec proves the moved routes redirect; this spec proves:
 *
 *   - the desktop primary bar shows its grouped entries,
 *   - the mobile bottom bar shows exactly its 4 tabs + the More sheet,
 *   - the still-reachable (un-redirected) routes render, not the 404 page.
 *
 * Dexie build, no backend; content is mocked so ``/content`` renders without a
 * content-repo checkout or network egress.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

/** The primary top-bar entries that survive the EXP-037 grouping. */
const PRIMARY_NAV = [
  "dashboard",
  "learning-path",
  "content",
  "progress",
  "settings",
  "help",
] as const;

test.describe("Navigation structure", () => {
  test("desktop primary bar shows the grouped entries", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockContent(page);
    const errors = installErrorCollectors(page);
    await seedLearner(page);

    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`nav-${entry}`)).toBeVisible();
    }
    // The mobile bottom bar is md:hidden — absent on a desktop viewport.
    await expect(page.getByTestId("bottom-tab-bar")).toBeHidden();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("mobile bottom bar shows 4 tabs + a More sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockContent(page);
    await seedLearner(page);

    const bar = page.getByTestId("bottom-tab-bar");
    await expect(bar).toBeVisible();
    // 4 NavLink tabs + the "More" button = 5 direct children.
    await expect(bar.locator("> *")).toHaveCount(5);
    for (const id of ["tab-learn", "tab-content", "tab-learning-path", "tab-progress"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    // The "More" sheet exposes the overflow entries (Settings + Help).
    await page.getByTestId("tab-more").click();
    await expect(page.getByTestId("more-sheet")).toBeVisible();
    await expect(page.getByTestId("more-settings")).toBeVisible();
    await expect(page.getByTestId("more-help")).toBeVisible();
  });

  test("routes kept reachable after the nav drop still render (no 404)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockContent(page);
    await seedLearner(page);

    // #850 kept these pages reachable by URL even though they left the nav.
    for (const route of ["/session", "/anki", "/pronunciation", "/create-lesson"]) {
      const errors = installErrorCollectors(page);
      await page.goto(route);
      // The catch-all NotFound would render here if the route were dropped.
      // (A benign empty state / feature-disabled notice is fine — only a real
      // 404 or an uncaught error fails the route.)
      await expect(page.getByTestId("not-found")).toHaveCount(0);
      expect(errors.pageErrors()).toEqual([]);
    }
  });
});
