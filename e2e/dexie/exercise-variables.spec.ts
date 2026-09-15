/**
 * Parametric exercises end to end (#3109, schema v1.14, engine#151).
 *
 * Drives the engine's own worked example
 * (learn-content-engine docs/lesson-format.md#variables-parametric-exercises,
 * a free_text exercise with two SAMPLED variables + one COMPUTED, toleranced
 * variable) through a real Chromium against the Dexie/GH-Pages-shape build:
 *
 *  - the prompt shows CONCRETE numbers, no ``{{name}}`` braces left;
 *  - a wrong answer is rejected;
 *  - the correct computed answer is accepted WITHIN the variable's
 *    tolerance, even when the typed text differs from the exact value.
 *
 * The sampled variables use ``min === max`` so the resolved instance is
 * deterministic (a=4, b=6, sum=10) - the RANDOM sampling itself is already
 * pinned by ``resolve-exercise-variables.test.ts``; this spec's job is the
 * INTEGRATION (dispatch -> substitution -> render -> grade) in a real
 * browser, not re-proving randomness.
 *
 * GitHub fetches are mocked with page.route (deterministic, offline),
 * mirroring multiple-choice-device-check.spec.ts.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const OWNER_REPO = "e2e/exercise-variables";
const SET_ID = "addition-parametrisch-from-de";

/** Deterministic instance: a=4 (min=max=4), b=6 (min=max=6), sum = a+b =
 *  10, tolerance 0.01. Two identical steps so a wrong AND a correct
 *  submission can each be exercised without needing "Try again" (hidden in
 *  the Lesson page's controlled two-phase flow). */
function exercise(id: string) {
  return {
    id,
    type: "free_text",
    prompt: "Was ist {{a}} + {{b}}?",
    card_ids: [],
    distractors: [],
    variables: [
      { name: "a", min: 4, max: 4 },
      { name: "b", min: 6, max: 6 },
      { name: "sum", expression: "a + b", tolerance: 0.01 },
    ],
    accept: ["{{sum}}"],
    explanation: "Die Summe von {{a}} und {{b}} ist {{sum}}.",
  };
}

const LESSON = JSON.stringify({
  id: "addition-parametrisch",
  title: "Addition mit Zufallszahlen",
  description: "Parametric free_text exercise, schema v1.14",
  target_language: "de",
  source_language: "de",
  domain: "knowledge",
  estimated_minutes: 2,
  cards: [],
  steps: [
    { id: "s1", type: "exercise", exercise: exercise("e1") },
    { id: "s2", type: "exercise", exercise: exercise("e2") },
  ],
});

const ROOT_MANIFEST = `
schema_version: "1.14"
sets:
  - id: ${SET_ID}
    title: "Addition mit Zufallszahlen"
    target_language: de
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: knowledge
    path: sets/de/addition-parametrisch
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01-addition.json"
`;

async function mockRepo(page: Page) {
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith("/sets/de/addition-parametrisch/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith("/01-addition.json")) {
        return route.fulfill({ status: 200, body: LESSON });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

async function openLesson(page: Page) {
  await mockRepo(page);
  await createTestUser(page);
  await page.goto("/settings?tab=data");
  await expect(page.getByTestId("content-repo-section")).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByTestId("content-repo-url")
    .fill(`https://github.com/${OWNER_REPO}`);
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
  await expect(page.getByTestId("lesson-page")).toBeVisible({
    timeout: 15000,
  });
}

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

test.describe("#3109 - parametric free_text exercise on a real browser (Dexie build)", () => {
  test("prompt shows concrete numbers; wrong rejected, tolerance-correct accepted", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLesson(page);

    // --- Step 1: the prompt is substituted, no braces left; wrong answer. ---
    await expect(page.getByTestId("free-text-exercise")).toBeVisible();
    await expect(page.getByText("Was ist 4 + 6?")).toBeVisible();
    await expect(page.getByText(/\{\{/)).toHaveCount(0);
    await page.getByTestId("free-text-input").fill("5");
    await check(page);
    await expect(page.getByTestId("free-text-result")).toHaveAttribute(
      "data-result",
      "wrong",
    );
    await next(page);

    // --- Step 2: same deterministic instance; a numeric answer within the
    //     computed variable's tolerance (0.01) is accepted even though the
    //     typed text ("10.005") differs from the exact resolved value ("10"). ---
    await expect(page.getByText("Was ist 4 + 6?")).toBeVisible();
    await page.getByTestId("free-text-input").fill("10.005");
    await check(page);
    await expect(page.getByTestId("free-text-result")).toHaveAttribute(
      "data-result",
      "correct",
    );
    await next(page);

    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
