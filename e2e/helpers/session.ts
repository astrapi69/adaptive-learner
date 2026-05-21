/**
 * Shared E2E helper: kick off a learning session from the
 * Dashboard. Assumes ``completeOnboarding`` +
 * ``completeAssessment`` have already run so the user lands
 * on /dashboard with a profile.
 *
 * The Dashboard's Quick Start button defaults to the
 * profile's strongest method. Callers that want a specific
 * method should use ``startSessionWithMethod`` instead (it
 * picks via the method-card UI).
 */

import type {Page} from "@playwright/test";

import type {LearningMethod} from "./types";

/** Start a session via the Quick Start button (uses the
 *  user's recommended method per their profile). */
export async function startSession(page: Page): Promise<void> {
    await page.getByTestId("quick-start").click();
    await page.waitForURL("**/session");
}

/** Start a session by clicking a specific method card on
 *  the dashboard. */
export async function startSessionWithMethod(
    page: Page,
    method: LearningMethod,
): Promise<void> {
    await page.getByTestId(`method-start-${method}`).click();
    await page.waitForURL("**/session");
}

/** Send a single user message in the open session. Waits for
 *  the chat input to clear and the assistant bubble to
 *  appear (assuming the AI route is mocked via
 *  ``mockSessionMessage``). */
export async function sendChatMessage(
    page: Page,
    text: string,
): Promise<void> {
    await page.getByTestId("chat-input").fill(text);
    await page.getByTestId("chat-send").click();
}

/** Click End → submit the rating dialog at defaults. Lands
 *  back on /dashboard. */
export async function endSessionWithDefaultRating(page: Page): Promise<void> {
    await page.getByTestId("session-end").click();
    await page.getByTestId("rating-dialog").waitFor();
    await page.getByTestId("rating-submit").click();
    await page.waitForURL("**/dashboard");
}
