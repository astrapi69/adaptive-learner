/**
 * Lesson read-aloud (TTS) smoke — Dexie build, no backend.
 *
 * Downloads the bundled French-A1-for-English set and opens its
 * first lesson (01-greetings), which starts on a theory step, then
 * exercises the read-aloud surface end to end:
 *
 *   - the auto-read toggle + the theory "Read aloud" control render;
 *   - clicking the theory control speaks the body, swaps in the
 *     follow-along view, and surfaces the floating mini-player;
 *   - the mini-player's Stop ends playback (player + follow-along
 *     disappear);
 *   - pressing "R" toggles read-aloud from the keyboard.
 *
 * speechSynthesis is INJECTED before the app loads so the run does
 * not depend on voices being installed in headless chromium (which
 * would otherwise end utterances immediately and make the UI state
 * non-deterministic). The fake keeps an utterance "speaking" until
 * cancelled and records spoken text on ``window.__ttsSpoken``.
 */

import {expect, test, type Page} from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Install a deterministic speechSynthesis before any app code runs. */
async function injectFakeSpeech(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const w = window as unknown as {
            __ttsSpoken: string[];
            speechSynthesis: unknown;
            SpeechSynthesisUtterance: unknown;
        };
        w.__ttsSpoken = [];
        class FakeUtterance {
            text: string;
            lang = "";
            rate = 1;
            pitch = 1;
            voice: unknown = null;
            onstart: (() => void) | null = null;
            onend: (() => void) | null = null;
            onerror: (() => void) | null = null;
            onboundary: ((e: unknown) => void) | null = null;
            constructor(text: string) {
                this.text = text;
            }
        }
        const fakeSynth = {
            getVoices: () => [
                {name: "Fake FR", lang: "fr-FR", default: true} as unknown,
            ],
            // Record + keep "speaking" (do NOT auto-fire onend) so the
            // UI's speaking state is stable for assertions.
            speak: (u: FakeUtterance) => {
                w.__ttsSpoken.push(u.text);
            },
            cancel: () => {},
            pause: () => {},
            resume: () => {},
            speaking: false,
            pending: false,
            addEventListener: () => {},
            removeEventListener: () => {},
        };
        w.speechSynthesis = fakeSynth;
        w.SpeechSynthesisUtterance =
            FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    });
}

async function openFirstLesson(page: Page): Promise<void> {
    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({
        timeout: 15000,
    });
    await page.getByTestId("content-other-toggle").click();
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible();
    await action.click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 20000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({
        timeout: 15000,
    });
}

test.describe("Lesson read-aloud (TTS)", () => {
    test("theory read-aloud: controls, follow-along, mini-player, stop", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await injectFakeSpeech(page);
        await openFirstLesson(page);

        // First step is theory -> the auto-read toggle + theory control
        // are present.
        await expect(page.getByTestId("lesson-tts-autoread")).toBeVisible();
        const theoryBtn = page.getByTestId("read-aloud-theory");
        await expect(theoryBtn).toBeVisible();
        await expect(theoryBtn).toHaveAttribute("data-speaking", "false");

        // Read it: follow-along view swaps in + the mini-player appears.
        await theoryBtn.click();
        await expect(theoryBtn).toHaveAttribute("data-speaking", "true");
        await expect(page.getByTestId("lesson-read-along")).toBeVisible();
        await expect(page.getByTestId("lesson-tts-player")).toBeVisible();

        // Something was actually handed to the engine.
        const spoken = await page.evaluate(
            () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken,
        );
        expect(spoken.length).toBeGreaterThan(0);
        expect(spoken[0].length).toBeGreaterThan(0);

        // Stop from the mini-player: player + follow-along disappear.
        await page.getByTestId("lesson-tts-player-stop").click();
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);
        await expect(page.getByTestId("lesson-read-along")).toHaveCount(0);
        await expect(theoryBtn).toHaveAttribute("data-speaking", "false");

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("keyboard shortcut R starts + stops read-aloud", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await injectFakeSpeech(page);
        await openFirstLesson(page);

        await expect(page.getByTestId("read-aloud-theory")).toBeVisible();
        // R reads the current step.
        await page.keyboard.press("r");
        await expect(page.getByTestId("lesson-tts-player")).toBeVisible();
        await expect(page.getByTestId("read-aloud-theory")).toHaveAttribute(
            "data-speaking",
            "true",
        );
        // R again stops.
        await page.keyboard.press("r");
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("auto-read mode reads each step on display", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await injectFakeSpeech(page);
        await openFirstLesson(page);

        // Turn auto-read on, then move to the next step: it should be
        // spoken automatically.
        await page.getByTestId("lesson-tts-autoread").click();
        await expect(page.getByTestId("lesson-tts-autoread")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        const before = await page.evaluate(
            () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken.length,
        );
        await page.getByTestId("lesson-next").click();
        await expect
            .poll(async () =>
                page.evaluate(
                    () =>
                        (window as unknown as {__ttsSpoken: string[]})
                            .__ttsSpoken.length,
                ),
            )
            .toBeGreaterThan(before);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
