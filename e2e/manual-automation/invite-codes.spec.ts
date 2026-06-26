/**
 * Invitation codes — redeem entry points (#1093).
 *
 * The coach-side code generation needs a real GitHub repo + token, so it is
 * out of scope for the offline Dexie build. This spec pins the LEARNER-facing
 * redeem surface, which is fully exercisable with no network egress because the
 * failure paths short-circuit before any GitHub fetch:
 *
 *   - the ``/invite`` page renders, with submit gated on a non-empty field;
 *   - a deep link (``?code=…&repo=…``) seeds the input (no submit → no fetch);
 *   - a bare code (no repo) is rejected with a "needs the full link" message
 *     (``redeemInvite`` returns ``no_repo`` before it ever fetches);
 *   - the Import tab's "Einladungscode eingeben" entry opens ``/invite``.
 *
 * Dexie build, no backend. Locale-robust: assertions key on testids + state,
 * not on translated prose (the build's default locale is German).
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { seedLearner } from "./helpers/setup";

test.describe("Invitation code redeem", () => {
  test.beforeEach(async ({ page }) => {
    installErrorCollectors(page);
    await seedLearner(page);
  });

  test("the redeem page renders with submit gated on input", async ({ page }) => {
    await page.goto("/invite");
    await expect(page.getByTestId("redeem-invite-page")).toBeVisible();
    // Empty field → submit disabled.
    await expect(page.getByTestId("redeem-invite-submit")).toBeDisabled();
    await page.getByTestId("redeem-invite-input").fill("DEUTSCH-8X4K");
    await expect(page.getByTestId("redeem-invite-submit")).toBeEnabled();
  });

  test("a deep link seeds the input from code + repo", async ({ page }) => {
    await page.goto("/invite?code=DEUTSCH-8X4K&repo=coach/deutsch-b1");
    const value = await page.getByTestId("redeem-invite-input").inputValue();
    expect(value).toContain("code=DEUTSCH-8X4K");
    expect(value).toContain("repo=coach");
  });

  test("a bare code with no repo is rejected before any fetch", async ({ page }) => {
    await page.goto("/invite");
    await page.getByTestId("redeem-invite-input").fill("DEUTSCH-8X4K");
    await page.getByTestId("redeem-invite-submit").click();
    // ``no_repo`` short-circuits with a message; we stay on the page.
    const error = page.getByTestId("redeem-invite-error");
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
    await expect(page).toHaveURL(/\/invite/);
  });

  test("the Import tab opens the redeem page", async ({ page }) => {
    await page.goto("/content?tab=import");
    await expect(page.getByTestId("invite-redeem")).toBeVisible();
    await page.getByTestId("invite-redeem-open").click();
    await page.waitForURL("**/invite");
    await expect(page.getByTestId("redeem-invite-page")).toBeVisible();
  });
});
