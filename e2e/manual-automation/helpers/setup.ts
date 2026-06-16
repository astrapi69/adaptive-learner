/**
 * Shared setup helpers for the manual-automation suite (#616).
 *
 * ``seedLearner`` is the fast path to an authenticated state: it runs the
 * quick start (name + topic) and "jump right in", seeding user_id +
 * project_id in localStorage and landing on the Dashboard — without the
 * optional profile wizard or the assessment. Use it whenever a spec needs
 * a learner but not a profile.
 */

import { expect, type Page } from "@playwright/test";

import { OnboardingPage } from "../pages/OnboardingPage";

export async function seedLearner(
  page: Page,
  name = "QA Learner",
  topic = "French A1",
): Promise<void> {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto();
  await onboarding.quickStart(name, topic);
  await onboarding.jumpRightIn.click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
}
