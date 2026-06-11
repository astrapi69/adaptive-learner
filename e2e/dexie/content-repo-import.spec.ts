/**
 * EXP-023 — external content repository import: error paths + playthrough
 * (Dexie mode). Closes #278.
 *
 * The happy paths (connect, validate, sync, browse, source filter, offline
 * cache, multi-repo, deep-link add, remove, recommended) are already pinned
 * by ``content-repository.spec.ts``, ``multi-content-repository.spec.ts`` and
 * ``recommended-repos.spec.ts``. This spec fills the remaining gaps against
 * the GH-Pages-shape build (no backend), all GitHub fetches mocked with
 * ``page.route`` for determinism:
 *
 *  - A repo whose ``manifest.yaml`` 404s -> validation fails, not added.
 *  - A repo with an unsupported schema major -> validation fails, not added.
 *  - Re-adding the same repo is idempotent (one list row, no duplicate).
 *  - A lesson from a connected external repo plays to the scored summary.
 *
 * Note on the duplicate case: ``addUserRepo`` dedupes by ``owner/repo``
 * source, so a second connect REPLACES the row rather than warning. The
 * assertion therefore pins "exactly one row", not an "already added" toast
 * (which the UI does not emit).
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

const OWNER_REPO = "jane/import-demo";
const SET_ID = "importdemo";

const ROOT_MANIFEST = `
schema_version: "1.3"
sets:
  - id: ${SET_ID}
    title: "Import Demo"
    target_language: fr
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: sets/de/${SET_ID}
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01.json"
`;

const LESSON = JSON.stringify({
  schema_version: "1.3",
  id: "01",
  title: "Greetings",
  target_language: "fr",
  source_language: "de",
  cards: [
    { id: "c1", front: "bonjour", back: "hallo" },
    { id: "c2", front: "merci", back: "danke" },
  ],
  steps: [
    {
      id: "intro",
      type: "theory",
      title: "Greetings",
      body: "# Greetings\n\nFrench speakers greet differently by time of day.",
    },
    {
      id: "s1",
      type: "exercise",
      exercise: {
        id: "e1",
        type: "matching",
        prompt: "Match the pairs",
        card_ids: ["c1", "c2"],
        pairs: [
          { left: "bonjour", right: "hallo" },
          { left: "merci", right: "danke" },
        ],
        distractors: [],
      },
    },
  ],
});

/** Serve a healthy ``owner/repo`` that advertises one playable set. */
async function mockHealthyRepo(page: Page) {
  await page.route(
    `**/raw.githubusercontent.com/${OWNER_REPO}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({ status: 200, body: ROOT_MANIFEST });
      }
      if (url.endsWith(`/sets/de/${SET_ID}/manifest.yaml`)) {
        return route.fulfill({ status: 200, body: SET_MANIFEST });
      }
      if (url.endsWith(`/sets/de/${SET_ID}/lessons/01.json`)) {
        return route.fulfill({ status: 200, body: LESSON });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

/** Serve ``owner/repo`` whose root manifest 404s (no manifest.yaml). */
async function mockMissingManifestRepo(page: Page, ownerRepo: string) {
  await page.route(
    `**/raw.githubusercontent.com/${ownerRepo}/main/**`,
    (route) => route.fulfill({ status: 404, body: "Not Found" }),
  );
}

/** Serve ``owner/repo`` whose manifest declares an unsupported schema. */
async function mockBadSchemaRepo(page: Page, ownerRepo: string) {
  await page.route(
    `**/raw.githubusercontent.com/${ownerRepo}/main/**`,
    (route) => {
      const url = route.request().url();
      if (url.endsWith("/main/manifest.yaml")) {
        return route.fulfill({
          status: 200,
          body: `schema_version: "2.0"\nsets: []\n`,
        });
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
}

async function connect(page: Page, url: string) {
  await page.getByTestId("content-repo-url").fill(url);
  await page.getByTestId("content-repo-connect").click();
}

test.describe("EXP-023 — external repo import: errors + playthrough", () => {
  test("missing manifest and bad schema both fail validation, not added", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockMissingManifestRepo(page, "ghost/missing");
    await mockBadSchemaRepo(page, "old/schema2");
    await createTestUser(page);

    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({
      timeout: 15000,
    });

    // 404 manifest -> validation failed, no repo row.
    await connect(page, "https://github.com/ghost/missing");
    const result = page.getByTestId("content-repo-result");
    await expect(result).toBeVisible();
    await expect(result).toContainText(/failed/i);
    await expect(
      page.getByTestId("content-repo-item-ghost-missing"),
    ).toHaveCount(0);

    // Unsupported schema major -> validation failed, no repo row.
    await connect(page, "https://github.com/old/schema2");
    await expect(result).toContainText(/failed/i);
    await expect(
      page.getByTestId("content-repo-item-old-schema2"),
    ).toHaveCount(0);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("re-adding the same repo is idempotent (one list row)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockHealthyRepo(page);
    await createTestUser(page);

    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({
      timeout: 15000,
    });

    await connect(page, `https://github.com/${OWNER_REPO}`);
    await expect(page.getByTestId("content-repo-result")).toContainText(
      /passed/i,
    );
    await connect(page, `https://github.com/${OWNER_REPO}`);
    await expect(page.getByTestId("content-repo-result")).toContainText(
      /passed/i,
    );

    // Dedup by owner/repo source: the second connect replaces, not appends.
    await expect(
      page.getByTestId("content-repo-item-jane-import-demo"),
    ).toHaveCount(1);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("a lesson from a connected external repo plays to the summary", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockHealthyRepo(page);
    await createTestUser(page);

    // Connect + cache the external repo's content.
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("content-repo-section")).toBeVisible({
      timeout: 15000,
    });
    await connect(page, `https://github.com/${OWNER_REPO}`);
    await expect(page.getByTestId("content-repo-result")).toContainText(
      /passed/i,
    );

    // Open the cached external set's first lesson.
    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    const open = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(open).toBeVisible({ timeout: 15000 });
    await open.click();

    await expect(page.getByTestId("lesson-page")).toBeVisible({
      timeout: 15000,
    });

    // Walk the lesson (theory -> matching) to the scored summary.
    let playedMatching = false;
    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      if (await page.getByTestId("matching-exercise").count()) {
        const lefts = page.getByTestId(/^matching-left-\d+$/);
        const n = await lefts.count();
        for (let j = 0; j < n; j++) {
          await page.getByTestId(`matching-left-${j}`).click();
          await page.getByTestId(`matching-right-${j}`).click();
        }
        playedMatching = true;
      }
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

    await expect(page.getByTestId("lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("lesson-summary-score")).toBeVisible();
    expect(playedMatching, "matching exercise was rendered").toBe(true);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
