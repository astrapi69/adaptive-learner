/**
 * Post-answer explanation (#2991, engine schema 1.13 ``Exercise.explanation``).
 *
 * Drives the reference lesson ``e2e/fixtures/explanation-post-answer.lesson.json``
 * (one theory, one exercise WITH an explanation, one WITHOUT) through a real
 * Chromium against the Dexie/GH-Pages-shape build:
 *
 *  - before the check nothing is shown;
 *  - a wrong answer reveals the explanation EXPANDED, with rendered Markdown;
 *  - a correct answer on the next exercise: no chrome at all (no explanation
 *    authored), so the absence case is pinned on the same path;
 *  - the review preference "Show explanations" hides it live.
 *
 * GitHub fetches are mocked with page.route (deterministic, offline).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const OWNER_REPO = "e2e/explanation-post-answer";
const SET_ID = "adjektivstellung-from-de";

const LESSON = readFileSync(
  join(__dirname, "..", "fixtures", "explanation-post-answer.lesson.json"),
  "utf-8",
);

const ROOT_MANIFEST = `
schema_version: "1.13"
sets:
  - id: ${SET_ID}
    title: "Adjektivstellung"
    target_language: es
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: sets/es/adjektivstellung
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01-adjektivstellung.json"
`;

/** Route the official content index + the recommended list to EMPTY so
 *  the Settings > Data section finishes loading without any real GitHub
 *  or GitHub-Pages fetch (hermetic across environments); the mocked test
 *  repo below is then the only content the browser sees. Registered FIRST:
 *  Playwright matches the most recently registered route first, so the
 *  specific test-repo route wins over this catch-all. */
async function mockEmptyOfficialIndex(page: Page) {
  const empty = 'schema_version: "1.13"\nsets: []\n';
  const handler = (route: Route) => {
    const url = route.request().url();
    if (url.endsWith("/recommended-repos.json")) {
      return route.fulfill({ status: 200, body: '{"repos":[]}' });
    }
    if (url.endsWith("/books.yaml")) {
      return route.fulfill({ status: 200, body: "domains: {}\n" });
    }
    if (url.endsWith("/manifest.yaml")) {
      return route.fulfill({ status: 200, body: empty });
    }
    return route.fulfill({ status: 404, body: "" });
  };
  await page.route("**/raw.githubusercontent.com/**", handler);
  await page.route("**/adaptive-learner-content/**", handler);
}

async function mockRepo(page: Page) {
  await mockEmptyOfficialIndex(page);
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith("/sets/es/adjektivstellung/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith("/01-adjektivstellung.json")) {
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
  // The section stays a bare heading (aria-busy) until the recommended
  // list + the official index have loaded from GitHub; wait for the add
  // form itself, not the section shell, so a slow index never races the fill.
  await expect(page.getByTestId("content-repo-add")).toBeVisible({
    timeout: 60000,
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

test.describe("#2991 - post-answer explanation on a real browser (Dexie build)", () => {
  test("wrong answer expands the explanation, absent explanation renders no chrome", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLesson(page);

    // Theory.
    await next(page);

    // Exercise WITH explanation: nothing before the check.
    await expect(page.getByTestId("multiple-choice-exercise")).toBeVisible();
    await expect(page.getByTestId("exercise-explanation")).toHaveCount(0);
    await page.getByRole("radio", { name: "el rojo coche" }).check();
    await check(page);
    const explanation = page.getByTestId("exercise-explanation");
    await expect(explanation).toBeVisible();
    await expect(explanation).toHaveAttribute("data-state", "open");
    await expect(explanation).toHaveAttribute("data-outcome", "incorrect");
    const body = page.getByTestId("exercise-explanation-body");
    // Rendered Markdown, not literal asterisks: a bold rule + a bullet list.
    await expect(body.locator("strong").first()).toContainText("Regel");
    await expect(body.locator("li")).toHaveCount(5);
    await expect(body).not.toContainText("**");
    // The toggle folds it away and back.
    await page.getByTestId("exercise-explanation-toggle").click();
    await expect(explanation).toHaveAttribute("data-state", "collapsed");
    await expect(body).toHaveCount(0);
    await page.getByTestId("exercise-explanation-toggle").click();
    await expect(explanation).toHaveAttribute("data-state", "open");
    await next(page);

    // Exercise WITHOUT explanation: correct answer, no chrome at all.
    await expect(page.getByTestId("multiple-choice-exercise")).toBeVisible();
    await page.getByRole("radio", { name: "la casa blanca" }).check();
    await check(page);
    await expect(page.getByTestId("multiple-choice-result")).toHaveAttribute(
      "data-result",
      "correct",
    );
    await expect(page.getByTestId("exercise-explanation")).toHaveCount(0);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("the review preference hides the explanation live", async ({ page }) => {
    await openLesson(page);
    await next(page);
    await page.getByRole("radio", { name: "el rojo coche" }).check();
    await check(page);
    await expect(page.getByTestId("exercise-explanation")).toBeVisible();
    // Flip the same localStorage key the Settings toggle writes and fire
    // its change event, so the mounted panel re-reads it without a reload.
    await page.evaluate(() => {
      localStorage.setItem("adaptive-learner.review.explanations", "false");
      window.dispatchEvent(new Event("adaptive-learner:review-pref"));
    });
    await expect(page.getByTestId("exercise-explanation")).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem("adaptive-learner.review.explanations", "true");
      window.dispatchEvent(new Event("adaptive-learner:review-pref"));
    });
    await expect(page.getByTestId("exercise-explanation")).toBeVisible();
  });
});
