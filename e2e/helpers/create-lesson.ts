/**
 * Shared E2E helpers for the Lesson Creator (``/create-lesson``).
 */

import {type Page} from "@playwright/test";

/**
 * Step past the draft prompt on the way into a fresh Lesson Creator.
 *
 * A restorable draft in ``localStorage`` (the autosave slot,
 * ``adaptive-learner.lesson-draft``) makes the page open with a
 * continue-or-fresh dialog. Callers that want an empty wizard choose
 * "fresh"; on a clean browser there is no prompt and nothing happens.
 * The prompt itself is not this helper's subject: it is asserted, both
 * paths, in ``e2e/dexie/lesson-draft-resume.spec.ts`` and captured as the
 * ``create-lesson/entwurf-hinweis`` FeatureShot (#3227).
 */
export async function declineDraftPrompt(page: Page): Promise<void> {
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
}
