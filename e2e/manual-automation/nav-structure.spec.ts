/**
 * Navigation structure (manual test plan gap-fill, complements
 * ``nav-redirects.spec.ts``).
 *
 * EXP-037 (#850) restructured the nav into a small grouped primary bar
 * (Nielsen-Norman 5-7) plus a mobile ``BottomTabBar`` (4 tabs + a "More"
 * sheet), and KEPT several pages reachable by URL after dropping them from the
 * nav (``/session``, ``/anki``, ``/pronunciation``, ``/create-lesson``).
 *
 * #891 added a vertical desktop sidebar (``DesktopSidebar``, ``sidebar-*``
 * testids). Three navigation surfaces now coexist, each owning one viewport
 * band:
 *   - ``>= lg`` (>= 1024px): the fixed ``DesktopSidebar`` is the primary nav;
 *     the top bar's inline links are CSS-hidden (``body.has-desktop-sidebar``).
 *   - ``md .. lg`` (768-1023px): the inline top bar (``nav-*``) is the primary
 *     nav; the sidebar is ``hidden`` and the bottom bar is ``md:hidden``.
 *   - ``< md`` (< 768px): the ``BottomTabBar``.
 *
 * The redirects spec proves the moved routes redirect; this spec proves:
 *
 *   - the desktop sidebar shows its grouped entries (>= lg),
 *   - the tablet-width top bar shows its grouped entries (md..lg),
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

/** The primary entries that survive the EXP-037 grouping. Both the desktop
 *  sidebar (``sidebar-*``, #891) and the tablet-width top bar (``nav-*``)
 *  render this same set. */
const PRIMARY_NAV = [
  "dashboard",
  "learning-path",
  "content",
  "progress",
  "settings",
  "help",
] as const;

test.describe("Navigation structure", () => {
  test("desktop sidebar shows the grouped entries (>= lg)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockContent(page);
    const errors = installErrorCollectors(page);
    await seedLearner(page);

    // #891 — at >= lg the fixed DesktopSidebar is the primary navigation.
    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`sidebar-${entry}`)).toBeVisible();
    }
    // The top bar's inline links are CSS-hidden (body.has-desktop-sidebar) so
    // the two never duplicate; the mobile bottom bar is md:hidden.
    await expect(page.getByTestId("nav-dashboard")).toBeHidden();
    await expect(page.getByTestId("bottom-tab-bar")).toBeHidden();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("tablet-width top bar shows the grouped entries (md..lg)", async ({
    page,
  }) => {
    // Between md (768) and lg (1024) the DesktopSidebar is hidden and the
    // BottomTabBar is md:hidden, so the inline top bar is the primary nav.
    await page.setViewportSize({ width: 900, height: 800 });
    await mockContent(page);
    const errors = installErrorCollectors(page);
    await seedLearner(page);

    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`nav-${entry}`)).toBeVisible();
    }
    await expect(page.getByTestId("sidebar-dashboard")).toBeHidden();
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
