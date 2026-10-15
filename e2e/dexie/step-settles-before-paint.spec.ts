/**
 * The first painted frame of a step is its final position (#3752).
 *
 * After every step change the lesson reset the scroll container to the top
 * and then smooth-scrolled the step anchor into view: the new step's
 * options slid about 165 px over some 250 ms, and a tap on what was on
 * screen first landed on the neighbouring option (Oslo tapped, Stockholm
 * recorded). With "reduce motion" on the device the miss did not occur.
 *
 * This pins the contract on both surfaces that re-anchor: the lesson page
 * and the runner shell (the error replay here; all six runner policies use
 * the same hook). From the first frame the new step is painted in, the
 * rects of its controls do not change, sampled every frame for 400 ms.
 *
 * The real control lesson, served through a mocked repo, at phone size
 * with touch input. Sampling uses the page's own frames, not
 * ``locator.tap()``, because Playwright waits for a resting target.
 */

import {expect, test} from "@playwright/test";

import {
    openErrorReplayAtSchweden,
    openLesson,
    sampleNextStepMotion,
    tapOption,
    type StepMotion,
} from "../helpers/control-lesson";

test.use({serviceWorkers: "block", hasTouch: true});

function expectAtRest(motion: StepMotion, label: string): void {
    expect(motion.to, `${label}: the step changed`).not.toBe(motion.from);
    expect(motion.tops.length, `${label}: frames sampled`).toBeGreaterThanOrEqual(5);
    const spread = Math.max(...motion.tops) - Math.min(...motion.tops);
    expect(spread, `${label}: control tops per frame ${motion.tops.join(", ")}`).toBeLessThanOrEqual(1);
}

test.describe("#3752 - a step is painted at its final position", () => {
    test.describe.configure({timeout: 180_000});

    test("lesson page: theory to the first exercise, and exercise to exercise", async ({page}) => {
        await openLesson(page, "exam");
        // The set line in the header arrives once, asynchronously, after the
        // lesson opens (listSets); it is not a step change. Measure the step
        // change only.
        await expect(page.getByTestId("lesson-header-set")).toBeVisible({timeout: 10_000});
        expectAtRest(await sampleNextStepMotion(page), "t1 -> e1");
        await tapOption(page, "Paris", null);
        expectAtRest(await sampleNextStepMotion(page), "e1 -> e2");
    });

    test("runner shell (error replay): Schweden to Norwegen", async ({page}) => {
        await openErrorReplayAtSchweden(page);
        await tapOption(page, "Stockholm", true);
        const motion = await sampleNextStepMotion(page);
        expect(motion.to).toBe("error-replay-step-e8");
        expectAtRest(motion, "e7 -> e8");
    });
});
