/**
 * #106 — resumable assessment.
 *
 * Dexie build, no backend. A learner who abandons the assessment
 * partway is invited from the Dashboard to finish, and resumes exactly
 * where they left off with their earlier answers intact.
 *
 * The decisive check: after resuming at question 6 and answering ONLY
 * questions 6-12, the result screen appears — which is only possible if
 * answers 1-5 were persisted (submit requires all 12 answered).
 */

import { expect, test } from "@playwright/test";

import { completeOnboarding } from "../helpers/onboarding";

test.describe("#106 — resumable assessment", () => {
  test("abandon mid-assessment, resume from the Dashboard, finish", async ({
    page,
  }) => {
    await completeOnboarding(page); // lands on /assessment

    // Answer the first five questions, leaving the cursor on q06.
    for (let i = 1; i <= 5; i++) {
      const qid = `q${String(i).padStart(2, "0")}`;
      await page.getByTestId(`question-${qid}-answer-a`).click();
      await page.getByTestId("assessment-next").click();
    }
    await expect(page.getByTestId("question-card-q06")).toBeVisible();

    // Abandon: leave for the Dashboard. The profile is incomplete, so the
    // profile card invites the learner to continue. #858 — the profile card
    // lives on the Aktivität tab.
    await page.goto("/dashboard?tab=activity");
    const resume = page.getByTestId("dashboard-profile-resume");
    await expect(resume).toBeVisible({ timeout: 15000 });
    await page.getByTestId("dashboard-profile-resume-btn").click();
    await page.waitForURL("**/assessment");

    // Resumed exactly at q06 (not restarted at q01).
    await expect(page.getByTestId("question-card-q06")).toBeVisible({
      timeout: 15000,
    });

    // Answer the remaining questions and submit. Reaching the result
    // proves q01-q05 survived the round-trip (submit needs all 12).
    for (let i = 6; i <= 12; i++) {
      const qid = `q${String(i).padStart(2, "0")}`;
      await page.getByTestId(`question-${qid}-answer-a`).click();
      if (i < 12) await page.getByTestId("assessment-next").click();
    }
    await page.getByTestId("assessment-submit").click();
    await expect(page.getByTestId("assessment-result")).toBeVisible({
      timeout: 15000,
    });

    // Completing clears the saved progress: on the Aktivität tab the resume
    // invitation is gone and the radar renders.
    await page.getByTestId("assessment-continue").click();
    await page.waitForURL("**/dashboard");
    await page.goto("/dashboard?tab=activity");
    await expect(page.getByTestId("dashboard-profile-resume")).toHaveCount(0);
    await expect(page.getByTestId("profile-radar")).toBeVisible({
      timeout: 15000,
    });
  });
});
