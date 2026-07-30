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
    // #1085 migration welcome: on a fresh API-mode install the dialog
    // overlays the form (z-10000) and intercepts every click. It is
    // legitimate product behaviour, so the helper dismisses it the way
    // a learner without online data would - "start fresh". Racy by
    // nature (an async empty-install probe opens it), hence the short
    // wait instead of a hard expect; the react-router 8 bump (#2041)
    // shifted effect timing so the dialog now reliably wins the race
    // it used to lose.
    const migration = page.getByTestId("migration-start-fresh");
    await migration.click({timeout: 3000}).catch(() => {
        /* dialog not shown - not an empty install, or already dismissed */
    });
    // Quick start (#92): only name + topic are required.
    await page.getByTestId("onboarding-name").fill(merged.name);
    await page.getByTestId("onboarding-topic").fill(merged.topic);
    await page.getByTestId("onboarding-submit").click();
    // Optional-profile invitation (#94). "Jump right in" goes to the
    // Dashboard; the path to /assessment runs through the wizard, so
    // open it and walk the five steps. (The timeframe arg is no longer
    // free text — the wizard offers fixed choices; the default
    // "flexible" is kept.)
    await page.getByTestId("onboarding-invite-setup-profile").click();
    await page.getByTestId("onboarding-wizard-goal").fill(merged.goal);
    await page.getByTestId("onboarding-wizard-next").click(); // -> timeframe
    await page.getByTestId("onboarding-wizard-next").click(); // -> minutes
    await page
        .getByTestId("onboarding-wizard-minutes")
        .fill(String(merged.dailyMinutes));
    await page.getByTestId("onboarding-wizard-next").click(); // -> problem
    await page.getByTestId("onboarding-wizard-next").click(); // -> done
    await page.getByTestId("onboarding-wizard-start-assessment").click();
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

/**
 * v1.23.1 / Issue 4 — seed a dummy API key for the active
 * provider. Required when the spec wants to click any
 * AI-gated button (Quick Start, Analyze, Pronunciation,
 * Extract Anki) — those buttons are disabled until the
 * user's settings carry ``has_<provider>_key=true``.
 *
 * The key is a stub string; the backend stores it as
 * Fernet-encrypted ciphertext but never actually calls the
 * provider's API with it. Specs that pin the "ai_error
 * toast surfaces" path are still valid — the key exists so
 * the gate opens; the AI call still fails because the key
 * isn't real.
 */
export async function seedTestApiKey(
    page: Page,
    provider: "anthropic" | "openai" | "gemini" = "anthropic",
): Promise<void> {
    const userId = await page.evaluate(() =>
        localStorage.getItem("adaptive-learner.user_id"),
    );
    if (!userId) {
        throw new Error(
            "seedTestApiKey called before user_id is in localStorage; " +
                "run completeOnboarding first.",
        );
    }
    // The settings API is /api/settings/{uid} (the old
    // /api/users/{uid}/settings shape this helper was written
    // against 404s today, #2170). Keys go through the dedicated
    // POST (the bare PATCH deliberately cannot touch them - they
    // are Fernet-encrypted server-side); the active provider is a
    // plain settings field.
    await page.evaluate(
        async ({uid, prov}) => {
            const keyResp = await fetch(`/api/settings/${uid}/api-key`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({provider: prov, key: "sk-e2e-test-dummy-key"}),
            });
            if (!keyResp.ok) {
                throw new Error(
                    `seedTestApiKey: POST api-key failed ${keyResp.status}`,
                );
            }
            const patchResp = await fetch(`/api/settings/${uid}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({active_provider: prov}),
            });
            if (!patchResp.ok) {
                throw new Error(
                    `seedTestApiKey: PATCH failed ${patchResp.status}`,
                );
            }
        },
        {uid: userId, prov: provider},
    );
}
