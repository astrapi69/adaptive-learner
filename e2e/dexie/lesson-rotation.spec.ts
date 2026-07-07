/**
 * #1422 rotation regression (follow-up to #1410/#1415) — the lesson must
 * survive the portrait → landscape TRANSITION, not just a statically
 * landscape viewport.
 *
 * Dexie build, no backend. The #1415 spec starts directly at 812×375; the
 * device rotates at runtime, which flips the short-landscape compact-nav
 * media query (#1391) while the lesson is open. Pinned here, across a LIVE
 * ``setViewportSize`` portrait → landscape → portrait round-trip with the
 * download toast still up:
 *   1. the top bar stays in its compact lesson state — the drawer does NOT
 *      pop open and no drawer overlay is left in the DOM catching taps
 *      (the #589 class in a new guise);
 *   2. the action button is fully inside the rotated viewport,
 *      ``elementFromPoint`` at its centre resolves to the button itself,
 *      and a REAL click advances the two-phase flow;
 *   3. rotating back to portrait keeps the footer flush + operable.
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "fr-a1-from-en";

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/** Download the bundled set and open its first lesson. */
async function openLesson(page: Page): Promise<void> {
  await page.goto("/content?tab=my");
  await expect(page.getByTestId("content-tree")).toBeVisible({
    timeout: 30000,
  });
  await page.getByTestId("content-other-toggle").click();
  const action = page.getByTestId(`content-set-${SET_ID}-action`);
  await expect(action).toBeVisible();
  await action.click();
  const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
  await expect(openBtn).toBeVisible({ timeout: 20000 });
  await openBtn.click();
  await expect(page.getByTestId("lesson-page")).toBeVisible({
    timeout: 15000,
  });
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

/** Layout facts about the nav / drawer / button after a viewport change. */
async function layoutFacts(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-testid="app-nav"]');
    const links = document.getElementById("app-nav-links");
    const btn =
      document.querySelector('[data-testid="lesson-check"]') ||
      document.querySelector('[data-testid="lesson-next"]');
    const btnRect = btn?.getBoundingClientRect() ?? null;
    let hitIsButton = false;
    if (btn && btnRect) {
      const el = document.elementFromPoint(
        btnRect.left + btnRect.width / 2,
        btnRect.top + btnRect.height / 2,
      );
      hitIsButton = el === btn || btn.contains(el);
    }
    return {
      navHeight: nav?.getBoundingClientRect().height ?? -1,
      lessonCompact: nav?.getAttribute("data-lesson-compact"),
      drawerOpenClass: links?.className.includes("is-open") ?? false,
      drawerVisible: links
        ? getComputedStyle(links).display !== "none"
        : false,
      btnRect: btnRect
        ? { top: btnRect.top, bottom: btnRect.bottom, h: btnRect.height }
        : null,
      hitIsButton,
    };
  });
}

test.describe("#1422 — portrait → landscape rotation keeps the lesson operable", () => {
  test.use({ viewport: PORTRAIT });

  test("live rotation: compact top bar, no drawer pop, button hit + click, back without break", async ({
    page,
  }) => {
    await openLesson(page);

    // --- rotate to landscape while the download toast may still be up ---
    await page.setViewportSize(LANDSCAPE);
    // One frame for media-query listeners + layout to settle.
    await page.waitForTimeout(150);

    const landscape = await layoutFacts(page);

    // 1. Top bar: compact lesson state, drawer NOT popped open, no
    //    visible drawer panel catching taps.
    expect(landscape.lessonCompact, "nav in lesson-compact state").toBe(
      "true",
    );
    expect(landscape.drawerOpenClass, "drawer is-open class absent").toBe(
      false,
    );
    expect(landscape.drawerVisible, "drawer panel not visible").toBe(false);
    expect(
      landscape.navHeight,
      "compact nav height stays a slim bar",
    ).toBeLessThanOrEqual(64);

    // 2. Action button fully inside the rotated viewport and the actual
    //    hit-test target at its centre.
    expect(landscape.btnRect, "action button present").toBeTruthy();
    expect(landscape.btnRect!.top).toBeGreaterThanOrEqual(0);
    expect(landscape.btnRect!.bottom).toBeLessThanOrEqual(LANDSCAPE.height);
    expect(landscape.btnRect!.h).toBeGreaterThanOrEqual(44);
    expect(
      landscape.hitIsButton,
      "elementFromPoint at the button centre is the button (no overlay)",
    ).toBe(true);

    // 3. A REAL click drives the two-phase flow after the rotation.
    await answerCurrentExercise(page);
    const wasCheck = (await page.getByTestId("lesson-check").count()) > 0;
    await actionButton(page).click({ timeout: 5000 });
    if (wasCheck) {
      await expect(page.getByTestId("lesson-next")).toBeVisible({
        timeout: 5000,
      });
    }

    // --- rotate back to portrait: footer flush + still operable ---
    await page.setViewportSize(PORTRAIT);
    await page.waitForTimeout(150);

    const portrait = await layoutFacts(page);
    expect(portrait.drawerOpenClass, "portrait: drawer stays closed").toBe(
      false,
    );
    expect(portrait.btnRect, "portrait: action button present").toBeTruthy();
    expect(portrait.btnRect!.bottom).toBeLessThanOrEqual(PORTRAIT.height);
    expect(
      portrait.hitIsButton,
      "portrait: button is the hit target again",
    ).toBe(true);

    const footer = await page.getByTestId("lesson-footer").boundingBox();
    if (!footer) throw new Error("lesson-footer not visible");
    expect(
      Math.abs(footer.y + footer.height - PORTRAIT.height),
      "footer flush with the portrait viewport bottom after the round-trip",
    ).toBeLessThanOrEqual(2);

    await actionButton(page).click({ timeout: 5000 });
  });
});
