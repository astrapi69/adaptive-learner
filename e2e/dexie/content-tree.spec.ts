/**
 * Content Browser tree + language filter (Phase 61 E2E, journey d).
 *
 * Runs against the GH-Pages-shape dexie build (no backend). The
 * bundled content ships 4 sets (fr/es A1 for EN + DE speakers).
 * The app's default language is German, so the German-source sets
 * render expanded under the primary "I speak" heading, and the
 * English-source sets sit in the collapsed "other source
 * languages" section until the learner expands it.
 */

import { expect, test } from "@playwright/test";

test.describe("Content Browser — source-language tree", () => {
  test("groups by source language and filters English-source under 'other'", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/content?tab=my");

    // Tree renders (not the flat list, not an error).
    const tree = page.getByTestId("content-tree");
    await expect(tree).toBeVisible({ timeout: 15000 });

    // The learner's primary source language (German app language)
    // section is present and expanded.
    await expect(page.getByTestId("content-source-primary")).toBeVisible();
    // A German-source target group renders (French and/or Spanish).
    await expect(
      page.getByTestId("content-source-de"),
    ).toBeVisible();

    // English-source sets are NOT in the primary tree — they live
    // in the collapsed "other source languages" section.
    const other = page.getByTestId("content-source-other");
    await expect(other).toBeVisible();
    // A German-source set row is visible; an English-source set row
    // is hidden until the section is expanded.
    await expect(
      page.getByTestId("content-set-fr-a1-from-en"),
    ).toHaveCount(0);

    // Expand "other source languages" -> English-source sets appear.
    await page.getByTestId("content-other-toggle").click();
    await expect(
      page.getByTestId("content-set-fr-a1-from-en"),
    ).toBeVisible();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
