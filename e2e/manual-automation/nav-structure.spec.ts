/**
 * Navigation structure (manual test plan gap-fill, complements
 * ``nav-redirects.spec.ts``).
 *
 * EXP-037 (#850) restructured the nav into a small grouped primary bar
 * (Nielsen-Norman 5-7) plus a mobile ``BottomTabBar`` (4 tabs + a "More"
 * sheet), and KEPT several pages reachable by URL after dropping them from the
 * nav (``/session``, ``/anki``, ``/pronunciation``, ``/create-lesson``).
 *
 * #1390 (Option A) established ONE primary navigation per viewport class and
 * removed the #891 desktop sidebar (a second desktop primary nav behind a
 * burger):
 *   - ``> 768px``: the horizontal top bar (``nav-*``) is the primary nav; the
 *     hamburger + drawer do NOT exist in the DOM.
 *   - ``<= 768px``: the hamburger + drawer own the top-bar links, and the
 *     ``BottomTabBar`` provides the primary tabs.
 *
 * This spec proves:
 *
 *   - the desktop top bar shows its grouped entries with NO burger/drawer,
 *   - the tablet-width top bar behaves identically,
 *   - the mobile bottom bar shows exactly its 4 tabs + the More sheet, and
 *     the hamburger drawer carries the full primary set,
 *   - the still-reachable (un-redirected) routes render, not the 404 page.
 *
 * Dexie build, no backend; content is mocked so ``/content`` renders without a
 * content-repo checkout or network egress.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

/** The primary entries that survive the EXP-037 grouping — the top bar and
 *  the mobile hamburger drawer render this same set from the shared
 *  ``nav-targets.ts`` model (#1390). */
const PRIMARY_NAV = [
  "dashboard",
  "learning-path",
  "session",
  "content",
  "contribute",
  "progress",
  "settings",
  "help",
] as const;

test.describe("Navigation structure", () => {
  test("desktop shows the top bar only — no burger, no drawer (> 768px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockContent(page);
    const errors = installErrorCollectors(page);
    await seedLearner(page);

    // #1390 — the horizontal top bar is THE desktop primary navigation.
    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`nav-${entry}`)).toBeVisible();
    }
    // The removed #891 sidebar and the mobile hamburger must not exist in
    // the DOM at all (not merely CSS-hidden).
    await expect(page.getByTestId("nav-hamburger")).toHaveCount(0);
    await expect(page.getByTestId("sidebar-open-toggle")).toHaveCount(0);
    await expect(page.getByTestId("desktop-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("bottom-tab-bar")).toBeHidden();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("tablet-width top bar behaves like desktop (769..1024px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await mockContent(page);
    const errors = installErrorCollectors(page);
    await seedLearner(page);

    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`nav-${entry}`)).toBeVisible();
    }
    await expect(page.getByTestId("nav-hamburger")).toHaveCount(0);
    await expect(page.getByTestId("desktop-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("bottom-tab-bar")).toBeHidden();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("mobile shows the bottom bar + the hamburger drawer (<= 768px)", async ({
    page,
  }) => {
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
    await page.getByTestId("more-sheet-close").click();

    // #1390 — the hamburger drawer is the mobile top-bar navigation and
    // carries the FULL primary set (parity with the desktop top bar).
    await expect(page.getByTestId("nav-hamburger")).toBeVisible();
    await page.getByTestId("nav-hamburger").click();
    for (const entry of PRIMARY_NAV) {
      await expect(page.getByTestId(`nav-${entry}`)).toBeVisible();
    }
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
