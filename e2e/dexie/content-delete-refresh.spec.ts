/**
 * "Meine Inhalte" — deleted sets stay deleted across Refresh (#1709).
 *
 * Reproduction pin: deleting a downloaded set purges the cache, but the
 * source catalogue (bundled build assets / repo manifest) keeps
 * advertising it, so a bare Refresh used to bring every deleted set
 * back. The fix records the deletion as a dismissal (localStorage) and
 * filters the set out of "Meine Inhalte" while it is not cached.
 *
 * Regression guards in the same flow: an untouched catalogue set stays
 * listed after Refresh (the Refresh's sync purpose is intact), and the
 * deleted set remains discoverable on the Entdecken tab (one download
 * away, never lost).
 */

import { expect, test } from "@playwright/test";

/** German-source bundled set — renders in the primary tree unexpanded. */
const SET_ID = "es-a1-from-de";
/** A second German-source bundled set used as the stays-visible control. */
const CONTROL_SET_ID = "fr-a1-from-de";

test.describe("Content Browser — delete survives Refresh (#1709)", () => {
  test("download, delete, refresh: the set stays gone; control set stays", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId(`content-set-${SET_ID}`)).toBeVisible();
    await expect(
      page.getByTestId(`content-set-${CONTROL_SET_ID}`),
    ).toBeVisible();

    // Download (idempotent) so the delete action becomes available.
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    await expect(page.getByTestId(`content-set-${SET_ID}-open`)).toBeVisible({
      timeout: 20000,
    });

    // Delete via the set-actions menu + confirm modal.
    await page.getByTestId(`set-actions-${SET_ID}`).click();
    await page.getByTestId(`set-action-${SET_ID}-delete`).click();
    await expect(page.getByTestId("delete-set-modal")).toBeVisible();
    await page.getByTestId("delete-set-confirm").click();
    await expect(page.getByTestId(`content-set-${SET_ID}`)).toHaveCount(0);

    // Refresh re-reads the source catalogue — the deleted set must NOT
    // come back (this is the #1709 reproduction assertion).
    const refresh = page.getByTestId("content-refresh");
    await refresh.click();
    await expect(refresh).toBeEnabled({ timeout: 20000 });
    await expect(page.getByTestId(`content-set-${SET_ID}`)).toHaveCount(0);

    // The untouched catalogue set is still listed (sync purpose intact).
    await expect(
      page.getByTestId(`content-set-${CONTROL_SET_ID}`),
    ).toBeVisible();

    // A full reload lands in the same state (persisted, not React-only).
    await page.reload();
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId(`content-set-${SET_ID}`)).toHaveCount(0);

    // The deleted set stays one download away on the Entdecken tab.
    await page.goto("/content?tab=discover");
    await expect(page.getByTestId("discover-page")).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.locator(`[data-set-id="${SET_ID}"]`).first(),
    ).toBeVisible({ timeout: 20000 });

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
