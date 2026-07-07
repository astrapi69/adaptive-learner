/**
 * Session 3 — Content + repositories (manual test plan automation, #616).
 *
 * Dexie build, no backend. Covers the Content Browser search (Cmd/Ctrl+K),
 * the source filter, the content-repo settings surface (official repo),
 * and the My Lessons section.
 *
 * Conditional checks (skip with a reason when the precondition isn't met
 * offline): the source filter (only shown with multiple sources), book
 * companions (AUTH-02 — needs a published books.yaml domain that matches a
 * downloaded set; the bundled language sets have none offline), and the
 * own-lesson badge (UGC-03 — needs a user-generated lesson, covered by the
 * EXP-026 unit/dexie tests; seeding one here is out of scope).
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { ContentPage } from "./pages/ContentPage";
import { SettingsPage } from "./pages/SettingsPage";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

test.describe("Session 3 — Content + repositories", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
  });

  test("Cmd/Ctrl+K focuses search; typing filters; clear resets", async ({
    page,
  }) => {
    const errors = installErrorCollectors(page);
    const content = new ContentPage(page);
    await content.goto();

    // Ctrl+K focuses the search input.
    await page.keyboard.press("Control+k");
    await expect(content.searchInput).toBeFocused();

    // Typing a token in the fixture set's title surfaces results + a
    // count (1-char queries are below the activation threshold).
    await content.searchInput.fill("french");
    await expect(content.searchResults).toBeVisible();
    await expect(content.searchCount).toBeVisible();

    // Clear resets back to the tree.
    await content.searchClear.click();
    await expect(content.tree).toBeVisible();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("search empty-state for a no-match query", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    await content.searchInput.fill("zzzzzqqqq-nomatch-xyz");
    await expect(page.getByTestId("content-search-empty")).toBeVisible();
  });

  test("source filter narrows the tree (if present)", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    // #1386 — the source filter is an always-visible menu button; open it,
    // pick "Official", and the trigger label reflects the choice.
    const filter = page.getByTestId("content-source-filter");
    test.skip(
      (await filter.count()) === 0,
      "source filter only renders once sets are downloaded",
    );
    await filter.click();
    await page.getByTestId("content-source-filter-official").click();
    await expect(
      page.getByTestId("content-source-filter-label"),
    ).toContainText(/Offiziell|Official/);
    await expect(content.tree).toBeVisible();
  });

  test("My Lessons section is hidden when there are no user lessons (UGC-04)", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    await seedLearner(page);
    await content.goto();
    // EXP-026 / UGC-04: the section hides entirely with no user sets
    // (rather than showing a standalone empty state on the browser).
    await expect(page.getByTestId("content-my-lessons")).toHaveCount(0);
  });

  test("the official content repository is listed in Settings → Data", async ({
    page,
  }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("data");
    await expect(settings.panel("data")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("content-repo-official")).toBeVisible();
    // The connect affordance for adding a repo is present.
    await expect(page.getByTestId("content-repo-url")).toBeVisible();
  });

  test("book-companion card (AUTH-02) shows when a companion exists", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    await content.goto();
    const companions = page.getByTestId("content-book-companions");
    test.skip(
      (await companions.count()) === 0,
      "no book companion for the bundled language sets offline (needs a books.yaml domain match)",
    );
    await expect(page.getByTestId("book-companion-link").first()).toBeVisible();
  });
});
