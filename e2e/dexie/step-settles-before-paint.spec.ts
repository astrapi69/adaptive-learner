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
    expect(motion.to, `${label}: a new step was painted`).not.toBeNull();
    expect(motion.to, `${label}: the step changed`).not.toBe(motion.from);
    expect(motion.tops.length, `${label}: frames sampled`).toBeGreaterThanOrEqual(5);
    const spread = Math.max(...motion.tops) - Math.min(...motion.tops);
    expect(spread, `${label}: control tops per frame ${motion.tops.join(", ")}`).toBeLessThanOrEqual(1);
}

test.describe("#3752 - a step is painted at its final position", () => {
    test.describe.configure({timeout: 180_000});

    test("lesson page: theory to the first exercise, and exercise to exercise", async ({page}) => {
        await openLesson(page, "exam");
        expectAtRest(await sampleNextStepMotion(page), "t1 -> e1");
        await tapOption(page, "Paris", null);
        expectAtRest(await sampleNextStepMotion(page), "e1 -> e2");
    });

    test("opening a lesson: the first step stays where it was painted when the set line arrives late (#3772)", async ({page}) => {
        await openLesson(page, "exam");
        // The set line needs the set listing, which fetches the manifest of
        // every source. Hold that answer back, as a slow connection does.
        await page.route("**/raw.githubusercontent.com/**/main/manifest.yaml", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 900));
            await route.fallback();
        });
        // Sample from the first frame of the reloaded page: the top of the
        // first step, and whether the set line is there yet.
        await page.addInitScript(() => {
            const samples: {top: number; setLine: boolean}[] = [];
            (window as unknown as {__openSamples: typeof samples}).__openSamples = samples;
            const STEP = '[data-testid^="lesson-step-"]:not([data-testid$="-anchor"])';
            const frame = () => {
                const step = document.querySelector(STEP);
                if (step) {
                    samples.push({
                        top: Math.round(step.getBoundingClientRect().top),
                        setLine: document.querySelector('[data-testid="lesson-header-set"]') !== null,
                    });
                }
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
        await page.reload();
        await expect(page.getByTestId("lesson-header-set")).toBeVisible({timeout: 15_000});
        // A few frames after the line has arrived, then read.
        await page.waitForTimeout(300);
        const samples = await page.evaluate(
            () => (window as unknown as {__openSamples: {top: number; setLine: boolean}[]}).__openSamples,
        );

        const before = samples.filter((sample) => !sample.setLine);
        const after = samples.filter((sample) => sample.setLine);
        // The step was on screen before the line came, or the test measured nothing.
        expect(before.length, "frames with the step painted and no set line yet").toBeGreaterThanOrEqual(5);
        expect(after.length, "frames after the set line arrived").toBeGreaterThanOrEqual(3);
        const tops = samples.map((sample) => sample.top);
        const spread = Math.max(...tops) - Math.min(...tops);
        expect(spread, `top of the first step per frame: ${[...new Set(tops)].join(", ")}`).toBeLessThanOrEqual(1);
    });

    test("runner shell (error replay): Schweden to Norwegen", async ({page}) => {
        await openErrorReplayAtSchweden(page);
        await tapOption(page, "Stockholm", true);
        const motion = await sampleNextStepMotion(page);
        expect(motion.to).toBe("error-replay-step-e8");
        expectAtRest(motion, "e7 -> e8");
    });
});
