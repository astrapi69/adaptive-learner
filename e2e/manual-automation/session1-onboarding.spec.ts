/**
 * Session 1 — Onboarding (manual test plan automation, #616).
 *
 * Dexie build, no backend. Covers the first-run experience: the quick
 * start (name + topic → invite → dashboard), the first-run restore
 * affordance lifecycle, and the optional profile wizard (step label,
 * next / back, the "Later" finish).
 *
 * NOTE: "wizard cancel with a confirmation dialog" from the manual plan
 * has no implementation — the wizard's last step offers "Later" (finish
 * without the assessment) instead. That stays a manual/exploratory check.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { OnboardingPage } from "./pages/OnboardingPage";

test.describe("Session 1 — Onboarding", () => {
  test("fresh user sees the onboarding screen", async ({ page }) => {
    const errors = installErrorCollectors(page);
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await expect(onboarding.nameInput).toBeVisible();
    await expect(onboarding.topicInput).toBeVisible();
    await expect(onboarding.submit).toBeVisible();
    expect(errors.pageErrors()).toEqual([]);
  });

  test("quick start (name + topic) → jump right in → dashboard", async ({
    page,
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.quickStart("QA Learner", "French A1");
    await expect(onboarding.jumpRightIn).toBeVisible();
    await onboarding.jumpRightIn.click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
  });

  test("first-run restore affordance shows on an empty install", async ({
    page,
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await expect(onboarding.restoreButton).toBeVisible({ timeout: 15_000 });
  });

  test("restore affordance is hidden once the learner has data", async ({
    page,
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.quickStart("QA Learner", "French A1");
    await onboarding.jumpRightIn.click();
    await page.waitForURL("**/dashboard");
    // Returning to onboarding with data present: no restore button.
    await onboarding.goto();
    await expect(onboarding.restoreButton).toHaveCount(0);
  });

  test("profile wizard: step label, next advances, back returns", async ({
    page,
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.quickStart("QA Learner", "French A1");
    await onboarding.setUpProfile.click();

    await expect(onboarding.wizard).toBeVisible();
    const firstLabel = await onboarding.wizardStepLabel.textContent();
    expect(firstLabel).toMatch(/\d/); // "Step 1 of N"

    await onboarding.wizardNext.click();
    await expect
      .poll(async () => onboarding.wizardStepLabel.textContent())
      .not.toBe(firstLabel);

    await onboarding.wizardBack.click();
    await expect(onboarding.wizardStepLabel).toHaveText(firstLabel ?? "");
  });

  test("profile wizard 'Later' finishes to the dashboard", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.quickStart("QA Learner", "French A1");
    await onboarding.setUpProfile.click();
    await expect(onboarding.wizard).toBeVisible();
    // Walk to the last step (the "Later" button only shows there).
    for (let i = 0; i < 8; i++) {
      if (await page.getByTestId("onboarding-wizard-later").count()) break;
      await onboarding.wizardNext.click();
    }
    await page.getByTestId("onboarding-wizard-later").click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
  });
});
