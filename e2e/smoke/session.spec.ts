/**
 * Phase 6D smoke: session start + send message + end +
 * navigate. The AI orchestration deliberately fires with no
 * stored API key, so the assistant_message is null and the
 * page surfaces ai_error via toast — the smoke check is that
 * the user message persists and the End flow works.
 *
 * Live AI testing requires real provider credentials and a
 * separate spec gated behind an env var; that's out of scope
 * for the v0.3.0 smoke suite.
 */

import {expect, test} from "@playwright/test";

import {completeAssessment, completeOnboarding} from "../helpers/onboarding";

test.describe("Session flow", () => {
    test("starts, accepts a user message, rates, ends, lands on dashboard", async ({
        page,
    }) => {
        await completeOnboarding(page, {name: "Session Smoke"});
        await completeAssessment(page);

        // From the dashboard, kick off a new session.
        await page.getByTestId("quick-start").click();
        await page.waitForURL("**/session");
        await expect(page.getByTestId("session")).toBeVisible();
        // System-prompt seed renders as the first message.
        await expect(page.getByTestId("chat-message-system")).toBeVisible();

        // v0.5.0: intercept the /message response and pin the
        // dual-prompt contract — the ``step_evaluation`` field
        // MUST be present on the response shape (null in this
        // smoke run because there's no stored API key, so the
        // route short-circuits before the evaluator runs).
        const messageResponse = page.waitForResponse(
            (resp) =>
                resp.url().includes("/api/plugins/session/") &&
                resp.url().endsWith("/message") &&
                resp.request().method() === "POST",
        );

        // Send a user message.
        await page.getByTestId("chat-input").fill("Hello, this is a smoke test.");
        await page.getByTestId("chat-send").click();
        // The optimistic + persisted user message both bear the
        // "user" role testid.
        await expect(page.getByTestId("chat-message-user")).toBeVisible();

        // v0.5.0 contract pin: the response carries step_evaluation
        // (null when the route short-circuits before evaluating —
        // which is the no-API-key path this smoke takes).
        const resp = await messageResponse;
        const body = await resp.json();
        expect(body).toHaveProperty("step_evaluation");
        // In the no-API-key smoke path the route bails before the
        // evaluator runs, so the field is explicitly null. A future
        // smoke with a real key would assert ``not null`` here.
        expect(body.step_evaluation).toBeNull();

        // End the session via the rating dialog.
        await page.getByTestId("session-end").click();
        await expect(page.getByTestId("rating-dialog")).toBeVisible();
        // Sliders default to 3; just submit.
        await page.getByTestId("rating-submit").click();
        await page.waitForURL("**/dashboard");
        await expect(page.getByTestId("dashboard")).toBeVisible();
    });
});
