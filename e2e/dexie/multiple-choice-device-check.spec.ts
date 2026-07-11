/**
 * Device check for the native multiple_choice renderer (#1527, schema v1.6).
 *
 * Drives the REAL reference lesson from adaptive-learner-content-test
 * (sets/de/fuehrerschein-uebung/lessons/05-rettungsgasse-einsatzfahrzeuge,
 * vendored as e2e/fixtures/multiple-choice-device-check.lesson.json) through
 * a real Chromium against the Dexie/GH-Pages-shape build:
 *
 *  - single mode: radio semantics (a second pick replaces the first),
 *    wrong pick -> "wrong" + "missed" verdicts, correct pick -> correct.
 *  - multiple mode: checkbox semantics, exact-set grading.
 *  - coexistence regression: the same lesson's cloze-select steps still
 *    render and grade (#890 vehicle untouched).
 *  - mobile width: options remain visible and tappable at 375x812 and the
 *    page does not scroll horizontally.
 *
 * GitHub fetches are mocked with page.route (deterministic, offline) - the
 * lesson content itself is the real authored artifact.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const OWNER_REPO = "e2e/mc-device-check";
const SET_ID = "fuehrerschein-uebung-from-de";

const LESSON = readFileSync(
  join(__dirname, "..", "fixtures", "multiple-choice-device-check.lesson.json"),
  "utf-8",
);

const ROOT_MANIFEST = `
schema_version: "1.6"
sets:
  - id: ${SET_ID}
    title: "Führerschein-Übung"
    target_language: de
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: knowledge
    path: sets/de/fuehrerschein-uebung
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "05-rettungsgasse-einsatzfahrzeuge.json"
`;

async function mockRepo(page: Page) {
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith("/sets/de/fuehrerschein-uebung/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith("/05-rettungsgasse-einsatzfahrzeuge.json")) {
        return route.fulfill({ status: 200, body: LESSON });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

/** Connect the mocked repo and open the reference lesson. */
async function openLesson(page: Page) {
  await mockRepo(page);
  await createTestUser(page);
  await page.goto("/settings?tab=data");
  await expect(page.getByTestId("content-repo-section")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("content-repo-url").fill(
    `https://github.com/${OWNER_REPO}`,
  );
  await page.getByTestId("content-repo-connect").click();
  await expect(page.getByTestId("content-repo-result")).toContainText(
    /passed|erfolgreich/i,
  );
  await page.goto("/content?tab=my");
  await expect(page.getByTestId("content-tree")).toBeVisible({
    timeout: 15000,
  });
  const open = page.getByTestId(`content-set-${SET_ID}-open`);
  await expect(open).toBeVisible({ timeout: 15000 });
  await open.click();
  await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });
}

/** Advance past the current step via the lesson footer. */
async function next(page: Page) {
  const nextBtn = page.getByTestId("lesson-next");
  await expect(nextBtn).toBeVisible({ timeout: 5000 });
  const before = await currentStepTestId(page);
  await nextBtn.click();
  await waitForStepAdvance(page, before);
}

async function check(page: Page) {
  const checkBtn = page.getByTestId("lesson-check");
  await expect(checkBtn).toBeEnabled({ timeout: 5000 });
  await checkBtn.click();
}

const verdicts = (page: Page, verdict: string) =>
  page.locator(`[data-testid^="multiple-choice-option-"][data-verdict="${verdict}"]`);

test.describe("#1527 - native multiple_choice on a real browser (Dexie build)", () => {
  test("single radio + missed/wrong verdicts, exact-set multi, cloze-select regression", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLesson(page);

    // Theory 1 + 2.
    await next(page);
    await next(page);

    // --- MC single #1 (Rettungsgasse wo): WRONG pick on purpose. ---
    await expect(page.getByTestId("multiple-choice-exercise")).toBeVisible();
    await expect(
      page.getByTestId("multiple-choice-exercise"),
    ).toHaveAttribute("data-multiple", "false");
    // Radio semantics: pick one, then another - only the second stays.
    const wrong = page.getByRole("radio", { name: "Auf dem Seitenstreifen" });
    const alsoWrong = page.getByRole("radio", {
      name: "Erst kurz vor der Unfallstelle",
    });
    await alsoWrong.check();
    await wrong.check();
    await expect(alsoWrong).not.toBeChecked();
    await expect(wrong).toBeChecked();
    await check(page);
    // Wrong pick marked, the unpicked correct option marked "missed".
    await expect(verdicts(page, "wrong")).toHaveCount(1);
    await expect(verdicts(page, "missed")).toHaveCount(1);
    await next(page);

    // --- MC single #2 (wann): correct pick. ---
    await page
      .getByRole("radio", { name: "Sobald der Verkehr stockt" })
      .check();
    await check(page);
    await expect(verdicts(page, "correct")).toHaveCount(1);
    await expect(verdicts(page, "wrong")).toHaveCount(0);
    await next(page);

    // --- MC multiple (Mehrfachauswahl): exact set of the 2 correct options. ---
    await expect(
      page.getByTestId("multiple-choice-exercise"),
    ).toHaveAttribute("data-multiple", "true");
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(4);
    await page
      .getByRole("checkbox", { name: /Sie entsteht zwischen dem link/ })
      .check();
    await page
      .getByRole("checkbox", { name: /Unerlaubtes Befahren kann Bu/ })
      .check();
    await check(page);
    await expect(
      page.getByTestId("multiple-choice-result"),
    ).toHaveAttribute("data-result", "correct");
    await next(page);

    // --- Coexistence regression: cloze select still renders + grades. ---
    await expect(page.getByTestId("cloze-choices")).toBeVisible();
    await page
      .getByRole("radio", { name: "Sofort freie Bahn schaffen" })
      .click();
    await check(page);
    await next(page);
    await expect(page.getByTestId("cloze-choices")).toBeVisible();
    await page
      .getByRole("radio", { name: "Nur mit Schrittgeschwindigkeit" })
      .click();
    await check(page);
    await next(page);

    // Scored summary reached; no page errors anywhere on the path.
    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("lesson-summary-score")).toBeVisible();
    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("mobile width (375x812): options tappable, no horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLesson(page);
    await next(page);
    await next(page);

    await expect(page.getByTestId("multiple-choice-exercise")).toBeVisible();
    const first = page.getByRole("radio", {
      name: "Zwischen dem linken und dem mittleren Fahrstreifen",
    });
    await first.check();
    await expect(first).toBeChecked();

    // 44px touch targets: every option row is at least 44 CSS px tall.
    const options = page.locator('[data-testid^="multiple-choice-option-"]');
    const count = await options.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      const box = await options.nth(i).boundingBox();
      expect(box, `option ${i} has a bounding box`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeLessThanOrEqual(375);
    }

    // No horizontal page scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await check(page);
    await expect(verdicts(page, "correct")).toHaveCount(1);
    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
