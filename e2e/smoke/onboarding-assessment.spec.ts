/**
 * Phase 6D smoke: full Onboarding → Assessment → Dashboard
 * happy path. Exercises the two heaviest backend roundtrips
 * (user+project creation, profile evaluation) and the page
 * transitions between them.
 *
 * One spec rather than two so the localStorage state carried
 * by completeOnboarding flows naturally into the assessment
 * step without a fresh-page-reload trap.
 */

import {expect, test} from "@playwright/test";

import {completeAssessment, completeOnboarding} from "../helpers/onboarding";

test.describe("Onboarding → Assessment → Dashboard", () => {
    test("creates user + project, walks the 12 questions, lands on dashboard", async ({
        page,
    }) => {
        await completeOnboarding(page, {
            name: "Smoke Learner",
            topic: "Adaptive learning",
            goal: "Find my preferred method.",
        });
        // Assessment intro is visible after redirect.
        await expect(page.getByTestId("assessment")).toBeVisible();
        await expect(page.getByTestId("question-card-q01")).toBeVisible();

        await completeAssessment(page);
        // Dashboard mounted; both the page-root testid and a card
        // title should render.
        await expect(page.getByTestId("dashboard")).toBeVisible();
        await expect(page.getByTestId("quick-start")).toBeVisible();
    });
});
