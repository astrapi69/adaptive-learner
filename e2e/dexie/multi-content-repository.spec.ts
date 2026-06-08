/**
 * EXP-023 Phase B — multi content repository (Dexie mode).
 *
 * Covers connecting MULTIPLE user repos, the per-repo source filter, the
 * deep-link add flow, and removal — all against the GH-Pages-shape build
 * with each repo's GitHub fetches mocked (deterministic, no real network).
 *
 * The maintainer runs this (Claude writes the spec). Pins:
 *  - Two repos add + appear in the Settings list with trust badges.
 *  - The Content Browser shows per-repo filter chips and badges.
 *  - A deep link `/add-repo?url=…` connects a third repo.
 *  - Removing a repo (two-step confirm) drops it from the list.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

function rootManifest(setId: string): string {
  return `
schema_version: "1.3"
sets:
  - id: ${setId}
    title: "${setId} title"
    target_language: fr
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: sets/de/${setId}
`;
}

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

/** Mock one ``owner/repo`` advertising a single set ``setId``. */
async function mockRepo(page: Page, ownerRepo: string, setId: string) {
  await page.route(
    `**/raw.githubusercontent.com/${ownerRepo}/main/**`,
    async (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: rootManifest(setId) });
      }
      if (url.endsWith(`/sets/de/${setId}/manifest.yaml`)) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith(`/sets/de/${setId}/lessons/01.json`)) {
        return route.fulfill({ status: 200, body: LESSON });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

async function addRepo(page: Page, url: string) {
  await page.getByTestId("content-repo-url").fill(url);
  await page.getByTestId("content-repo-connect").click();
  await expect(page.getByTestId("content-repo-result")).toContainText(/passed/i);
}

test.describe("EXP-023 Phase B — multi content repository", () => {
  test("add multiple repos, filter, deep-link add, remove", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockRepo(page, "jane/alpha", "alpha");
    await mockRepo(page, "bob/beta", "beta");
    await mockRepo(page, "kim/gamma", "gamma");
    await createTestUser(page);

    // --- Connect two repos in Settings. -----------------------------
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({
      timeout: 15000,
    });
    await addRepo(page, "https://github.com/jane/alpha");
    await addRepo(page, "https://github.com/bob/beta");

    await expect(page.getByTestId("content-repo-item-jane-alpha")).toBeVisible();
    await expect(page.getByTestId("content-repo-item-bob-beta")).toBeVisible();
    await expect(page.getByTestId("content-repo-trust-jane-alpha")).toBeVisible();

    // --- Content Browser: per-repo filter chips + badges. -----------
    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("content-source-filter")).toBeVisible();
    await expect(
      page.getByTestId("content-source-filter-jane/alpha"),
    ).toBeVisible();
    await expect(
      page.getByTestId("content-source-filter-bob/beta"),
    ).toBeVisible();

    // Filter to one repo: only its set remains.
    await page.getByTestId("content-source-filter-jane/alpha").click();
    await expect(page.getByTestId("content-set-alpha")).toBeVisible();
    await expect(page.getByTestId("content-set-beta")).toHaveCount(0);

    // --- Deep link adds a third repo. -------------------------------
    await page.goto("/add-repo?url=kim/gamma&branch=main");
    await expect(page.getByTestId("add-repo-name")).toContainText("kim/gamma");
    await page.getByTestId("add-repo-connect").click();
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });

    // --- Remove a repo (two-step confirm). --------------------------
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-item-jane-alpha")).toBeVisible();
    await page.getByTestId("content-repo-remove-jane-alpha").click(); // arm
    await page.getByTestId("content-repo-remove-jane-alpha").click(); // confirm
    await expect(page.getByTestId("content-repo-item-jane-alpha")).toHaveCount(0);
    await expect(page.getByTestId("content-repo-item-bob-beta")).toBeVisible();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
