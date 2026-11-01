/**
 * #3819 - a short set link for a set of a registry repo the learner has not
 * added yet (Dexie mode).
 *
 * Mocks the registry (recommended-repos.json), the registry repo's pinned
 * search index and its branch content, so no real network is touched for
 * that repo. Pins: ``/content/set/<id>`` shows the set from the index with
 * the repo it comes from; "Add & start" connects the repo, downloads the set
 * and opens its first lesson; an id no repo carries ends in the not-found
 * state.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

const COMMIT = "c".repeat(40);

const RECOMMENDED_JSON = JSON.stringify({
  repos: [
    {
      url: "https://github.com/jane/alpha",
      branch: "main",
      title: "Jane Alpha",
      commit: COMMIT,
      trust_level: 1,
      validation: { status: "validated", validated_at: "2026-07-09T00:00:00Z" },
    },
  ],
});

const SEARCH_INDEX = JSON.stringify({
  schema_version: "1.9",
  sets: [
    {
      id: "alpha",
      name: "Alpha",
      description: "Erste Schritte",
      source_language: "de",
      target_language: "fr",
      level: "A1",
      domain: "language",
      lesson_count: 1,
      card_count: 1,
    },
  ],
});

const ROOT_MANIFEST = `
schema_version: "1.3"
sets:
  - id: alpha
    title: "Alpha"
    target_language: fr
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: sets/de/alpha
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01.json"
`;

const LESSON = JSON.stringify({
  id: "01",
  title: "Demo",
  cards: [{ id: "c1", front: "bonjour", back: "hallo" }],
  steps: [
    {
      id: "s1",
      type: "exercise",
      exercise: {
        id: "e1",
        type: "matching",
        prompt: "Match",
        card_ids: ["c1"],
        pairs: [{ left: "bonjour", right: "hallo" }],
        distractors: [],
      },
    },
  ],
});

async function mockRoutes(page: Page) {
  await page.route(
    "**/raw.githubusercontent.com/astrapi69/adaptive-learner-content/main/recommended-repos.json",
    (route) => route.fulfill({ status: 200, body: RECOMMENDED_JSON }),
  );
  await page.route(`**/raw.githubusercontent.com/jane/alpha/${COMMIT}/search-index.json`, (route) =>
    route.fulfill({ status: 200, body: SEARCH_INDEX }),
  );
  await page.route("**/raw.githubusercontent.com/jane/alpha/main/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/main/manifest.yaml")) {
      return route.fulfill({ status: 200, body: ROOT_MANIFEST });
    }
    if (url.endsWith("/sets/de/alpha/manifest.yaml")) {
      return route.fulfill({ status: 200, body: SET_MANIFEST });
    }
    if (url.endsWith("/sets/de/alpha/lessons/01.json")) {
      return route.fulfill({ status: 200, body: LESSON });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

test.describe("#3819 short set link for a registry repo", () => {
  test("shows the set, adds its repo and opens the first lesson", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockRoutes(page);
    await createTestUser(page);

    await page.goto("/content/set/alpha");
    await expect(page.getByTestId("registry-set")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("set-deep-link-title")).toHaveText("Alpha");
    await expect(page.getByTestId("registry-set-repo")).toContainText("Jane Alpha");

    await page.getByTestId("set-deep-link-start").click();
    await expect(page).toHaveURL(/\/lesson\/jane--alpha\/alpha\/01\.json$/, { timeout: 20_000 });
    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 20_000 });

    // The repo is now one of the learner's content sources.
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-item-jane-alpha")).toBeVisible({
      timeout: 15_000,
    });

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("an id no repo carries ends in the not-found state", async ({ page }) => {
    await mockRoutes(page);
    await createTestUser(page);

    await page.goto("/content/set/no-such-set");
    await expect(page.getByTestId("set-deep-link-not-found")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("set-deep-link-offline")).toHaveCount(0);
  });
});
