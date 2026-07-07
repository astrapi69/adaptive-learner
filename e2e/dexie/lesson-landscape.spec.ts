/**
 * #1410 regression — the lesson action button (Prüfen/Weiter) must be fully
 * visible AND clickable in LANDSCAPE, not just portrait.
 *
 * Dexie build, no backend. On the iPhone PWA, rotating to landscape left the
 * sticky footer's action button mostly below the visible screen (app shell
 * sized off the static ICB instead of the dynamic viewport; no safe-area
 * padding), and — engine-independent, pinned here — the bottom-right
 * download-success toast sat exactly over the button with
 * ``pointer-events: auto``, swallowing every tap for its 5s lifetime
 * (same class as the #589 motivation-toast bug).
 *
 * Pinned invariants at an iPhone-landscape viewport (812×375):
 *   1. The action button is fully inside the viewport and a REAL click on it
 *      advances the lesson even while the download toast is still up
 *      (click-through via ``passThrough``).
 *   2. The step content is scrollable at the low viewport height and the
 *      footer stays pinned to the viewport bottom across steps (nothing is
 *      unreachable — scroll, don't clip).
 *   3. Portrait (390×844) keeps the exact same pinned-footer behaviour
 *      (no regression from the landscape fix).
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Download the bundled set and open its first lesson. */
async function openLesson(page: Page): Promise<void> {
  await page.goto("/content?tab=my");
  // 30s: three fresh-context download flows run back-to-back in this file,
  // and the first catalogue paint can exceed the usual 15s on slow runners.
  await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("content-other-toggle").click();
  const action = page.getByTestId(`content-set-${SET_ID}-action`);
  await expect(action).toBeVisible();
  await action.click();
  const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
  await expect(openBtn).toBeVisible({ timeout: 20000 });
  await openBtn.click();
  await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });
}

/** Answer whatever exercise is on screen (coverage, not correctness). */
async function answerCurrentExercise(page: Page): Promise<void> {
  if (await page.getByTestId("free-text-exercise").count()) {
    await page.getByTestId("free-text-input").fill("Bonjour");
  } else if (await page.getByTestId("cloze-exercise").count()) {
    const inputs = page.locator('[data-testid^="cloze-input-"]');
    const n = await inputs.count();
    for (let j = 0; j < n; j++) await inputs.nth(j).fill("Bonjour");
  } else if (await page.getByTestId("word-tiles-exercise").count()) {
    const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
    let guard = 0;
    while ((await scrambled.count()) > 0 && guard++ < 12) {
      await scrambled.first().click();
    }
  } else if (await page.getByTestId("picture-exercise").count()) {
    await page.locator('[data-testid^="picture-choice-"]').first().click();
  } else if (await page.getByTestId("matching-exercise").count()) {
    const lefts = page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    for (let j = 0; j < n; j++) {
      await page.getByTestId(`matching-left-${j}`).click();
      await page.getByTestId(`matching-right-${j}`).click();
    }
  }
}

/** The active two-phase action button (Check while ungraded, else Next). */
function actionButton(page: Page) {
  return page
    .getByTestId("lesson-check")
    .or(page.getByTestId("lesson-next"))
    .first();
}

test.describe("#1410 — lesson action button in landscape (812×375)", () => {
  test.use({ viewport: { width: 812, height: 375 } });

  test("action button is fully visible and a real click works, even under the download toast", async ({
    page,
  }) => {
    await openLesson(page);

    const viewport = page.viewportSize()!;
    const btn = actionButton(page);
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    if (!box) throw new Error("action button has no bounding box");
    expect(box.y, "button top inside the viewport").toBeGreaterThanOrEqual(0);
    expect(
      box.y + box.height,
      "button bottom inside the viewport",
    ).toBeLessThanOrEqual(viewport.height);
    expect(box.height, "44px touch target").toBeGreaterThanOrEqual(44);

    // The download-success toast sits bottom-right, directly over the
    // button, for ~5s after the download. Pre-fix it had
    // pointer-events: auto and this click TIMED OUT; with passThrough the
    // click reaches the button on the first try. (No toast-visibility
    // precondition: if the toast already closed, the click must work
    // anyway.)
    const toast = page.locator(".Toastify__toast");
    if (await toast.count()) {
      await expect
        .poll(async () => {
          const pe = await toast
            .first()
            .evaluate((el) => getComputedStyle(el).pointerEvents);
          return pe;
        })
        .toBe("none");
    }
    await answerCurrentExercise(page);
    const isCheck = (await page.getByTestId("lesson-check").count()) > 0;
    await actionButton(page).click({ timeout: 5000 });
    if (isCheck) {
      // Grading flips the two-phase button to Next.
      await expect(page.getByTestId("lesson-next")).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("content scrolls at the low landscape height; footer stays pinned across steps", async ({
    page,
  }) => {
    await openLesson(page);
    const viewport = page.viewportSize()!;

    // The lesson page is taller than the 375px viewport, so the step
    // content must be reachable by SCROLLING (never clipped away).
    const scrollable = await page.evaluate(() => {
      const root = document.getElementById("root")!;
      return root.scrollHeight > root.clientHeight;
    });
    expect(scrollable, "#root is the scrollable app container").toBe(true);

    const scrolled = await page.evaluate(() => {
      const root = document.getElementById("root")!;
      root.scrollTo(0, root.scrollHeight);
      return root.scrollTop > 0;
    });
    expect(scrolled, "content actually scrolls").toBe(true);

    // Footer pinned to the viewport bottom on several consecutive steps.
    for (let i = 0; i < 3; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      await page.evaluate(() =>
        document.getElementById("root")?.scrollTo(0, 0),
      );
      await page.waitForTimeout(60);
      const footer = await page.getByTestId("lesson-footer").boundingBox();
      if (!footer) throw new Error("lesson-footer not visible");
      expect(
        Math.abs(footer.y + footer.height - viewport.height),
        `step ${i}: footer flush with the landscape viewport bottom`,
      ).toBeLessThanOrEqual(2);

      await answerCurrentExercise(page);
      const check = page.getByTestId("lesson-check");
      if (await check.count()) {
        await expect(check).toBeEnabled({ timeout: 5000 });
        await check.click();
      }
      const next = page.getByTestId("lesson-next");
      await expect(next).toBeVisible({ timeout: 5000 });
      await next.click();
      await page.waitForTimeout(80);
    }
  });
});

test.describe("#1410 — portrait stays intact (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("footer flush with the viewport bottom and button clickable in portrait", async ({
    page,
  }) => {
    await openLesson(page);
    const viewport = page.viewportSize()!;

    const footer = await page.getByTestId("lesson-footer").boundingBox();
    if (!footer) throw new Error("lesson-footer not visible");
    expect(
      Math.abs(footer.y + footer.height - viewport.height),
      "footer flush with the portrait viewport bottom",
    ).toBeLessThanOrEqual(2);

    await answerCurrentExercise(page);
    const isCheck = (await page.getByTestId("lesson-check").count()) > 0;
    await actionButton(page).click({ timeout: 5000 });
    if (isCheck) {
      await expect(page.getByTestId("lesson-next")).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
