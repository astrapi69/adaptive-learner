/**
 * EXP-023 Phase A — user content repository (Dexie mode).
 *
 * Covers connect -> validate -> sync -> browse -> offline against the
 * GH-Pages-shape build (no backend). The user repo's GitHub fetches are
 * mocked with ``page.route`` so the flow is fully deterministic and needs
 * no real network: a fake ``jane/test-content`` repo advertises one set.
 *
 * Pins:
 *  - The Content Repositories section renders in Settings > Data.
 *  - An invalid URL is rejected client-side (no network).
 *  - A valid repo validates ("Validation passed"), saves, and syncs.
 *  - The Content Browser shows the user set with the "Your repo" badge
 *    and a working source filter.
 *  - After going offline, the cached user set is still browseable.
 */

import { expect, test } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

const OWNER_REPO = "jane/test-content";

const ROOT_MANIFEST = `
schema_version: "1.3"
sets:
  - id: demo
    title: "Jane Demo"
    target_language: fr
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: sets/de/demo
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01.json"
`;

const LESSON = JSON.stringify({
  schema_version: "1.3",
  id: "01",
  title: "Demo lesson",
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

/** Intercept the fake user repo's raw GitHub requests. */
async function mockUserRepo(page: import("@playwright/test").Page) {
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    async (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith("/sets/de/demo/manifest.yaml")) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith("/sets/de/demo/lessons/01.json")) {
        return route.fulfill({ status: 200, body: LESSON });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

test.describe("EXP-023 Phase A — user content repository", () => {
  test("connect, validate, sync, browse, offline", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockUserRepo(page);
    await createTestUser(page);

    // --- Settings > Data: the section renders. -----------------------
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("content-repo-official")).toBeVisible();

    // --- Invalid URL is rejected client-side (no network). -----------
    await page.getByTestId("content-repo-url").fill("not a repo");
    await page.getByTestId("content-repo-connect").click();
    await expect(page.locator(".Toastify__toast--error")).toBeVisible();

    // --- Valid repo: validate + save. --------------------------------
    await page.getByTestId("content-repo-url").fill(
      `https://github.com/${OWNER_REPO}`,
    );
    await page.getByTestId("content-repo-connect").click();
    const result = page.getByTestId("content-repo-result");
    await expect(result).toBeVisible();
    await expect(result).toContainText(/passed|erfolgreich/i);

    // --- Connecting adds the repo to the list AND caches its content
    // in one step (#132 — Phase B reworked the old single-repo "Sync"
    // button into a per-repo list; there is no separate sync step). ---
    await expect(
      page.getByTestId("content-repo-item-jane-test-content"),
    ).toBeVisible();

    // --- Browse: the user set carries the "Your repo" badge. ---------
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("content-set-demo-origin")).toBeVisible();

    // The source filter (a menu button since #1386) narrows to the user repo.
    await expect(page.getByTestId("content-source-filter")).toBeVisible();
    await page.getByTestId("content-source-filter").click();
    await page.getByTestId(`content-source-filter-${OWNER_REPO}`).click();
    await expect(page.getByTestId("content-set-demo")).toBeVisible();

    // --- Offline: cached user content stays browseable. --------------
    // Drop the mock so the manifest request truly fails offline; the
    // loader must fall back to the cached rows from the sync above.
    await page.unroute(`**/raw.githubusercontent.com/${OWNER_REPO}/main/**`);
    await page.context().setOffline(true);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("content-set-demo")).toBeVisible();
    await page.context().setOffline(false);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
