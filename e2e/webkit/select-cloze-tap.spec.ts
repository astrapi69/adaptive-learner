/**
 * #3752 - a tap on a select-cloze option records exactly that option, under
 * the WebKit engine with touch input.
 *
 * Reported on an iPhone: in the error replay of the control set
 * ``evaluation-pilot-control-from-de`` the learner tapped "Oslo" on
 * "Die Hauptstadt von Norwegen ist ___" and the app recorded "Stockholm".
 * The two select clozes e7 (Sweden) and e8 (Norway) carry each other's
 * answer as a distractor, and their seeded option orders differ, so a tap
 * that lands on the previous step's layout (or a delayed click after the
 * step changes) records exactly the reported value. Chromium never showed
 * it; this spec runs the same flow under Playwright's WebKit with the
 * iPhone profile's touch context and taps (``locator.tap``) every option.
 *
 * The lesson is the real authored control lesson, vendored as
 * ``fixtures/evaluation-pilot-control.lesson.json`` and served through a
 * page.route-mocked content repo (no network).
 *
 * On the way it pins #3749 / #3765: the iOS install hint is absent on the
 * lesson (it lives on the dashboard now), without being dismissed.
 *
 * Asserted per tapped option: it is the checked radio right after the tap,
 * and after "check" it is graded correct with no option marked wrong; the
 * stored ``raw_answer`` of the run matches the tapped value.
 *
 * The cause, found later (#3752): after every step change the options slid
 * about 165 px for some 250 ms (reset to the top, then a smooth scroll to
 * the step anchor). The last test samples their position per frame.
 */

import {expect, test} from "@playwright/test";

import {
    ALL_CORRECT,
    openErrorReplayAtSchweden,
    openLesson,
    playRun,
    sampleNextStepMotion,
    storedAnswers,
    tapOption,
} from "../helpers/control-lesson";

// The mocked repo is served by page.route, which does not see requests a
// service worker makes outside Chromium; the app's worker must not take
// them over.
test.use({serviceWorkers: "block"});

test.describe("#3752 - a tapped select-cloze option is the recorded one (WebKit, touch)", () => {
    test.describe.configure({timeout: 180_000});

    test("exam: every option tapped correctly scores 10 of 10", async ({page}) => {
        await openLesson(page, "exam");
        await playRun(page, ALL_CORRECT, true);
        await expect(page.getByTestId("lesson-exam-result-score")).toContainText("10");
        const stored = JSON.stringify(await storedAnswers(page));
        expect(stored, "e7 stored").toContain("Stockholm");
        expect(stored, "e8 stored").toContain("Oslo");
    });

    test("error replay: Stockholm on e7, then Oslo on e8, both graded correct", async ({page}) => {
        await openLesson(page, "practice");
        // First pass: e7 and e8 wrong, as in the report's exam, the rest right.
        await playRun(page, {...ALL_CORRECT, e7: ["Oslo", "Stockholm"], e8: ["Stockholm", "Oslo"]}, false);
        await expect(page.getByTestId("lesson-summary")).toBeVisible();
        // "Fehler korrigieren", then "Alle Übungen erneut": the ErrorReplay
        // page, as in the report.
        await page.getByTestId("lesson-summary-fix-mistakes").tap();
        const replay = page.getByTestId("lesson-correction-replay");
        await expect(replay).toBeVisible({timeout: 10_000});
        await replay.tap();
        await expect(page.getByRole("radiogroup")).toBeVisible({timeout: 15_000});
        const tapped = await playRun(page, {e7: ["Stockholm"], e8: ["Oslo"]}, false);
        expect(tapped).toEqual(["e7:Stockholm", "e8:Oslo"]);
        await expect(page.getByTestId("error-replay-summary-score")).toContainText("2");
    });

    // #3752 - the cause: after "Weiter" the options slid about 165 px for
    // some 250 ms, so a tap on what was painted first hit the neighbour.
    // Positions are sampled per frame; a tap would wait for rest and hide it.
    test("error replay: Norwegen is painted where it stays", async ({page}) => {
        await openErrorReplayAtSchweden(page);
        await tapOption(page, "Stockholm", true);
        const motion = await sampleNextStepMotion(page);
        expect(motion.to).toBe("error-replay-step-e8");
        expect(motion.tops.length).toBeGreaterThanOrEqual(5);
        const spread = Math.max(...motion.tops) - Math.min(...motion.tops);
        expect(spread, `control tops per frame ${motion.tops.join(", ")}`).toBeLessThanOrEqual(1);
    });
});
