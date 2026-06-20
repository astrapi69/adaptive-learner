/**
 * Lesson header auto-hide — real-browser verification (PR #30 follow-up).
 *
 * Dexie build, no backend. Proves the auto-hide actually works in a real
 * browser (the unit tests pass synthetic scroll events; this drives the
 * real component + real CSS):
 *   1. inside a lesson, `#root` is the app scroll container
 *      (`overflow-y: auto` per global.css) — NOT the window;
 *   2. scrolling `#root` DOWN hides the sticky nav
 *      (`data-nav-hidden="true"` + the `-translate-y-full` transform);
 *   3. scrolling back to the top reveals it again;
 *   4. on a non-lesson route the nav never hides on scroll.
 *
 * Driven at 375px (mobile — where the reclaimed reading space matters
 * most). A guard spacer guarantees `#root` overflows regardless of the
 * current step's natural height, so the test is deterministic.
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "es-a1-from-en";

async function openALesson(page: Page): Promise<void> {
  await page.goto("/content?tab=my");
  await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 15000 });
  // English-source set lives under "other source languages" (the Dexie
  // build's default UI language is German).
  await page.getByTestId("content-other-toggle").click();
  const action = page.getByTestId(`content-set-${SET_ID}-action`);
  await expect(action).toBeVisible({ timeout: 15000 });
  await action.click(); // download (caches lessons)
  const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
  await expect(openBtn).toBeVisible({ timeout: 25000 });
  await openBtn.click();
  await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });
}

/** Force `#root` to overflow (if the current step is short) and drive a
 *  real scroll to `y`, dispatching the scroll event the hook listens to. */
async function scrollRoot(page: Page, y: number): Promise<void> {
  await page.locator("#root").evaluate((el, top) => {
    if (el.scrollHeight <= el.clientHeight) {
      const spacer = document.createElement("div");
      spacer.style.height = "1600px";
      spacer.setAttribute("data-test-spacer", "");
      el.appendChild(spacer);
    }
    el.scrollTop = top as number;
    el.dispatchEvent(new Event("scroll"));
  }, y);
}

test.describe("Lesson header auto-hide (real browser)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("hides the nav on scroll-down inside a lesson and reveals it at the top", async ({
    page,
  }) => {
    await openALesson(page);

    const root = page.locator("#root");
    // #root is the app scroll container — not the window. This is the
    // element the auto-hide hook observes.
    expect(await root.evaluate((el) => getComputedStyle(el).overflowY)).toBe(
      "auto",
    );

    const nav = page.getByTestId("app-nav");
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute("data-nav-hidden", "false");

    // Scroll down -> the sticky nav slides up out of view.
    await scrollRoot(page, 600);
    await expect(nav).toHaveAttribute("data-nav-hidden", "true");
    await expect(nav).toHaveClass(/-translate-y-full/);

    // Back to the top -> revealed again.
    await scrollRoot(page, 0);
    await expect(nav).toHaveAttribute("data-nav-hidden", "false");
    await expect(nav).not.toHaveClass(/-translate-y-full/);
  });

  test("does NOT hide the nav on a non-lesson route", async ({ page }) => {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    const nav = page.getByTestId("app-nav");
    await scrollRoot(page, 800);
    await expect(nav).toHaveAttribute("data-nav-hidden", "false");
    await expect(nav).not.toHaveClass(/-translate-y-full/);
  });
});
