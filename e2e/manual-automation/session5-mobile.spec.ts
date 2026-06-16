/**
 * Session 5 — Mobile (manual test plan automation, #616).
 *
 * Dexie build, no backend, phone viewport + touch. Covers no horizontal
 * overflow at 320/375/414, 44px touch targets on the key controls, the
 * header hamburger drawer, the Settings mobile menu (#597), and matching
 * via touch (tap).
 */

import { expect, test, type Page } from "@playwright/test";

import { ContentPage } from "./pages/ContentPage";
import { LessonRunner } from "./pages/LessonRunner";
import { NavBar } from "./pages/NavBar";
import { SettingsPage } from "./pages/SettingsPage";
import { seedLearner } from "./helpers/setup";
import { mockContent } from "./helpers/mock-content";

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

const WIDTHS = [320, 375, 414];
const PUBLIC_ROUTES = ["/", "/onboarding", "/content"];

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + 1;
  });
}

test.describe("Session 5 — Mobile", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
  });

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px on public routes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 720 });
      for (const route of PUBLIC_ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        expect(
          await hasNoHorizontalOverflow(page),
          `horizontal overflow on ${route} at ${width}px`,
        ).toBe(true);
      }
    });
  }

  test("header hamburger opens the nav drawer and navigates", async ({
    page,
  }) => {
    const nav = new NavBar(page);
    await seedLearner(page);
    await page.goto("/dashboard");
    await expect(nav.hamburger).toBeVisible();
    await nav.hamburger.click();
    await expect(nav.links).toBeVisible();
    await nav.link("content").click();
    await page.waitForURL("**/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("key touch targets are at least 44px tall", async ({ page }) => {
    const nav = new NavBar(page);
    await seedLearner(page);
    await page.goto("/content");
    // The header hamburger is the canonical 44px mobile target.
    await expect(nav.hamburger).toBeVisible();
    const box = await nav.hamburger.boundingBox();
    expect(box, "hamburger has a layout box").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // The nav-drawer links are 44px targets too.
    await nav.hamburger.click();
    await expect(nav.links).toBeVisible();
    const linkBox = await nav.link("settings").boundingBox();
    expect(linkBox, "nav link has a layout box").not.toBeNull();
    expect(linkBox!.height).toBeGreaterThanOrEqual(44);
  });

  test("Settings mobile menu works at 375px (#597)", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto();
    await expect(settings.mobileTrigger).toBeVisible({ timeout: 15_000 });
    await settings.mobileTrigger.click();
    await settings.mobileTab("data").click();
    await expect(settings.panel("data")).toBeVisible();
  });

  test("matching pairs via touch tap", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("matching");
    test.skip(!reached, "no matching exercise reached in this lesson");
    await page.getByTestId("matching-left-0").tap();
    await page.getByTestId("matching-right-0").tap();
    await expect(page.getByTestId("matching-pair-badge-1").first()).toBeVisible();
  });
});
