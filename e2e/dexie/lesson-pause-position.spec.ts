/**
 * Pause position of a lesson (#3075).
 *
 * Dexie build, no backend. Pins the three ways a learner's place in a
 * lesson used to be lost, all rooted in one guard: nothing was written
 * until the first graded exercise created the progress row, and an
 * in-app exit wrote nothing at all.
 *
 *   1. theory steps only, then a reload: the position survives;
 *   2. theory steps only, then the pause glyph: it pauses (dialog),
 *      instead of leaving without a trace;
 *   3. a graded exercise plus theory steps, then in-app navigation
 *      (the brand link): the row is ``paused`` at the LAST step, the
 *      dashboard lists the lesson under paused lessons, the resume
 *      dialog reopens it at that step.
 */

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";
const LESSON = "01-greetings.json";

async function openFirstLesson(page: Page): Promise<void> {
    await page.addInitScript(() => {
        localStorage.setItem("adaptive-learner.content_view_mode", "grid");
    });
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 25_000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
    await expect(page.locator('[data-testid^="lesson-step-"]').first()).toBeVisible({
        timeout: 10_000,
    });
}

/** Click "Weiter" once and wait for the step to change. */
async function nextStep(page: Page): Promise<string> {
    const before = await currentStepTestId(page);
    await page.getByTestId("lesson-next").click();
    await waitForStepAdvance(page, before);
    return (await currentStepTestId(page)) ?? "";
}

/** Read the lesson's progress row straight from IndexedDB. */
async function progressRow(page: Page): Promise<{status: string; current_step: number} | null> {
    return page.evaluate(
        (filename) =>
            new Promise((resolve) => {
                const request = indexedDB.open("adaptive-learner");
                request.onerror = () => resolve(null);
                request.onsuccess = () => {
                    const db = request.result;
                    const all = db
                        .transaction("lessonProgress", "readonly")
                        .objectStore("lessonProgress")
                        .getAll();
                    all.onsuccess = () => {
                        db.close();
                        const row = (all.result as {lesson_filename: string; status: string; current_step: number}[]).find(
                            (r) => r.lesson_filename === filename,
                        );
                        resolve(row ? {status: row.status, current_step: row.current_step} : null);
                    };
                    all.onerror = () => {
                        db.close();
                        resolve(null);
                    };
                };
            }),
        LESSON,
    );
}

test.describe("Lesson pause position (#3075)", () => {
    // Onboarding + assessment + set download + a few steps per test.
    test.describe.configure({timeout: 120_000});

    test.beforeEach(async ({page}) => {
        // The content tab waits for the live registry; pin it to an empty
        // list (#1653) so the spec reaches the bundled set without network.
        await page.route("**/recommended-repos.json", (route) =>
            route.fulfill({status: 200, body: '{"repos":[]}'}),
        );
        await page.route("**/books.yaml", (route) =>
            route.fulfill({status: 200, body: "domains: {}\n"}),
        );
        await createTestUser(page);
        await openFirstLesson(page);
    });

    test("theory steps only, reload: the position survives", async ({page}) => {
        await nextStep(page);
        const second = await nextStep(page);
        await expect.poll(() => progressRow(page), {timeout: 5_000}).toMatchObject({
            current_step: 2,
        });

        await page.reload();
        await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
        // The reload paused the run (beforeunload), so the resume dialog
        // asks first; "continue" lands on the step that was open.
        await expect(page.getByTestId("lesson-resume-dialog")).toBeVisible({timeout: 10_000});
        await page.getByTestId("lesson-resume-continue").click();
        await expect(page.locator(`[data-testid="${second}"]`)).toBeVisible({timeout: 10_000});
    });

    test("theory steps only, pause glyph: it pauses instead of leaving silently", async ({page}) => {
        await nextStep(page);
        await page.getByTestId("lesson-pause-btn").click();
        await expect(page.getByTestId("lesson-exit-dialog")).toBeVisible({timeout: 5_000});
        await page.getByTestId("lesson-exit-pause").click();
        await expect.poll(() => progressRow(page), {timeout: 5_000}).toMatchObject({
            status: "paused",
            current_step: 1,
        });
    });

    test("in-app navigation pauses at the last step and the dashboard resumes there", async ({page}) => {
        // Answer the first exercise (step index 2) so a graded result
        // exists BELOW the final position, then move on past it.
        await nextStep(page);
        await nextStep(page);
        await expect(page.getByTestId("matching-exercise")).toBeVisible({timeout: 10_000});
        const lefts = page.getByTestId(/^matching-left-\d+$/);
        const n = await lefts.count();
        for (let i = 0; i < n; i++) {
            await page.getByTestId(`matching-left-${i}`).click();
            await page.getByTestId(`matching-right-${i}`).click();
        }
        await page.getByTestId("lesson-check").click();
        const last = await nextStep(page);
        expect(last).not.toBe("");

        await page.locator("a.nav-brand").click();
        await page.waitForURL("**/dashboard");
        await expect.poll(() => progressRow(page), {timeout: 5_000}).toMatchObject({
            status: "paused",
            current_step: 3,
        });

        // The dashboard's cards land asynchronously (the same ready
        // contract the visual suite's settleDashboard waits for); the
        // paused card resolves a title per row after the progress read.
        await expect(page.getByTestId("dashboard")).toBeVisible({timeout: 20_000});
        await expect(page.getByTestId("continue-learning")).toBeVisible({timeout: 30_000});
        await expect(page.getByTestId("paused-lessons-card")).toBeVisible({timeout: 30_000});
        await page.locator('[data-testid^="paused-lesson-resume-"]').first().click();
        await expect(page.getByTestId("lesson-resume-dialog")).toBeVisible({timeout: 20_000});
        await page.getByTestId("lesson-resume-continue").click();
        await expect(page.locator(`[data-testid="${last}"]`)).toBeVisible({timeout: 10_000});
    });
});
