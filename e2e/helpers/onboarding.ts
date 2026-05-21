/**
 * Shared helper: walk a fresh learner through Landing →
 * Onboarding so subsequent specs land on /dashboard with
 * user_id + project_id seeded in localStorage.
 *
 * Tests that need a user but not a profile should call
 * ``completeOnboarding`` only. Tests that need an evaluated
 * profile (e.g. Dashboard radar) should additionally call
 * ``completeAssessment``.
 *
 * v1.15.0 / Phase 28A: the ``createTestUser`` shorthand
 * combines both flows. Specs that need a clean, evaluated
 * learner ready on /dashboard should reach for that helper
 * directly rather than calling the two-step pair every time.
 */

import type {Page} from "@playwright/test";

export interface OnboardingArgs {
    name?: string;
    topic?: string;
    goal?: string;
    timeframe?: string;
    dailyMinutes?: number;
}

const DEFAULTS: Required<OnboardingArgs> = {
    name: "E2E Learner",
    topic: "Spanish B1",
    goal: "Hold a 20-minute conversation.",
    timeframe: "8 weeks",
    dailyMinutes: 30,
};

/**
 * Visit /onboarding directly, fill the form, submit. Lands on
 * /assessment on success. The caller can choose to wait for
 * /dashboard via completeAssessment, or stay on /assessment
 * to exercise the question flow.
 */
export async function completeOnboarding(
    page: Page,
    args: OnboardingArgs = {},
): Promise<void> {
    const merged = {...DEFAULTS, ...args};
    await page.goto("/onboarding");
    await page.getByTestId("onboarding-name").fill(merged.name);
    await page.getByTestId("onboarding-topic").fill(merged.topic);
    await page.getByTestId("onboarding-goal").fill(merged.goal);
    await page.getByTestId("onboarding-timeframe").fill(merged.timeframe);
    await page
        .getByTestId("onboarding-daily-minutes")
        .fill(String(merged.dailyMinutes));
    await page.getByTestId("onboarding-submit").click();
    await page.waitForURL("**/assessment");
}

/**
 * Answer all 12 assessment questions with answer 'a' (the
 * deductive-leaning answer in most questions) and submit. Lands
 * on the assessment result screen; caller can click Continue to
 * advance to /dashboard.
 */
export async function completeAssessment(page: Page): Promise<void> {
    // Answer every question by clicking answer 'a' and Next /
    // Submit. The question IDs are q01..q12; each has answer 'a'.
    for (let i = 1; i <= 12; i++) {
        const qid = `q${String(i).padStart(2, "0")}`;
        await page.getByTestId(`question-${qid}-answer-a`).click();
        if (i < 12) {
            await page.getByTestId("assessment-next").click();
        }
    }
    await page.getByTestId("assessment-submit").click();
    await page.getByTestId("assessment-result").waitFor();
    await page.getByTestId("assessment-continue").click();
    await page.waitForURL("**/dashboard");
}

/**
 * v1.15.0 / Phase 28A — single-call helper that lands a
 * fresh learner on /dashboard with a fully evaluated
 * profile. Equivalent to ``completeOnboarding(page, args)``
 * followed by ``completeAssessment(page)``. Use this in
 * specs that don't care about the onboarding flow itself.
 */
export async function createTestUser(
    page: Page,
    args: OnboardingArgs = {},
): Promise<void> {
    await completeOnboarding(page, args);
    await completeAssessment(page);
}
