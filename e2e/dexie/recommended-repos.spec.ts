/**
 * EXP-023 Phase C slice — recommended repos + local ratings (Dexie mode).
 *
 * Mocks the curated recommended-repos.json (served from the official
 * content repo) + one recommended repo's GitHub fetches, deterministically
 * (no real network). Run by the maintainer. Pins: the discovery section
 * lists the curated repo, one-click add connects it with the "Officially
 * recommended" badge, a local star rating sticks, and the Content Browser
 * shows the recommended badge.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

const RECOMMENDED_JSON = JSON.stringify({
  repos: [{ url: "jane/alpha", branch: "main", title: "Jane Alpha" }],
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
  schema_version: "1.3",
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
  await page.route(
    "**/raw.githubusercontent.com/jane/alpha/main/**",
    (route) => {
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
    },
  );
}

test.describe("EXP-023 Phase C — recommended repos + local ratings", () => {
  // #547 — the recommended-repos discovery section went live once the curated
  // catalogue was published (CATALOGUE_PUBLISHED = true in
  // lib/content/recommended-repos.ts, #574): fetchRecommendedRepos now performs
  // the real fetch, so `content-repo-recommended` renders. The spec mocks the
  // recommended-repos.json route deterministically (no real network), so it is
  // independent of the live catalogue's content.
  test("discover, one-click add, rate, browse badge", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockRoutes(page);
    await createTestUser(page);

    // --- Discovery: the curated repo is offered. ---------------------
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-recommended")).toBeVisible({
      timeout: 15000,
    });

    // --- One-click add connects it. ---------------------------------
    await page.getByTestId("content-repo-recommended-add-jane/alpha").click();
    await expect(page.getByTestId("content-repo-item-jane-alpha")).toBeVisible();
    // #1319/#1320 consolidated the per-repo trust/recommended badges into one
    // RepoCategoryBadge; a recommended repo resolves to the "official" category.
    await expect(
      page.getByTestId("content-repo-category-jane-alpha"),
    ).toHaveAttribute("data-category", "official");
    // Once connected, it leaves the discovery list.
    await expect(page.getByTestId("content-repo-recommended")).toHaveCount(0);

    // --- Local star rating sticks. ----------------------------------
    await page
      .getByTestId("content-repo-rating-jane-alpha-star-4")
      .click();
    await expect(
      page.getByTestId("content-repo-rating-jane-alpha-star-4"),
    ).toHaveAttribute("aria-checked", "true");

    // --- Content Browser shows the unified category badge: an
    // officially recommended repo resolves to the "official" category
    // (#1405 — the shared RepoCategoryBadge replaced the old
    // recommended span). ----------------------------------------------
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    const categoryBadge = page.getByTestId("content-set-alpha-category");
    await expect(categoryBadge).toBeVisible();
    await expect(categoryBadge).toHaveAttribute("data-category", "official");

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
