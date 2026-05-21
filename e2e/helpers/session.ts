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

import {expect, type Page} from "@playwright/test";

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

/** Send a single user message in the open session.
 *
 *  Three real-world quirks the helper papers over:
 *
 *  1. The chat-send button is disabled while a stream is in
 *     flight (sendingMessage=true) AND when the draft is
 *     empty. We type the text first so the draft is non-empty,
 *     THEN wait for the button to be enabled (handles the
 *     previous-turn-still-streaming case).
 *  2. React's controlled ``draft`` state and Playwright's
 *     ``fill`` race in multi-turn loops: typing per-keystroke
 *     (via ``page.keyboard.type``) updates React state in
 *     step with the DOM value, which a single ``fill`` call
 *     does not always do.
 *  3. The bottom-right Toastify container can intercept
 *     pointer events even when no toast is visible (the
 *     react-toastify portal stays in the DOM). ``force: true``
 *     bypasses the actionability check; the real click
 *     event still dispatches.
 */
export async function sendChatMessage(
    page: Page,
    text: string,
): Promise<void> {
    const sendButton = page.getByTestId("chat-send");
    const input = page.getByTestId("chat-input");
    await input.click();
    await input.fill("");
    await page.keyboard.type(text, {delay: 5});
    await expect(sendButton).toBeEnabled({timeout: 15_000});
    // Use the native HTMLElement click() (not Playwright's
    // synthetic click) to avoid the Toastify portal's
    // pointer-events intercept that produced the multi-turn
    // hang during 28B development. The native click still
    // fires the form's submit handler via the browser's
    // default behaviour for ``type="submit"`` buttons.
    await sendButton.evaluate((el: HTMLButtonElement) => el.click());
}

/** Click End → submit the rating dialog at defaults. Lands
 *  back on /dashboard. */
export async function endSessionWithDefaultRating(page: Page): Promise<void> {
    await page.getByTestId("session-end").click();
    await page.getByTestId("rating-dialog").waitFor();
    await page.getByTestId("rating-submit").click();
    await page.waitForURL("**/dashboard");
}
