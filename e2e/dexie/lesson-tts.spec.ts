/**
 * Lesson read-aloud (TTS) smoke — Dexie build, no backend.
 *
 * Opens the bundled French-A1-for-English set's first lesson
 * (01-greetings, a theory step) and exercises the read-aloud surface:
 *
 *   - the auto-read toggle + the theory "Read aloud" control render;
 *   - clicking the theory control speaks the body and surfaces the
 *     floating mini-player;
 *   - the mini-player's Stop ends playback;
 *   - pressing "R" toggles read-aloud from the keyboard;
 *   - auto-read speaks each step on display.
 *
 * speechSynthesis is INJECTED before the app loads so the run does not
 * depend on voices being installed in headless chromium.
 *
 * #165 — flake fix: the set is downloaded ONCE in ``beforeAll`` (a shared
 * serial context), out of the per-test critical path; each test
 * re-navigates to the already-cached lesson, which is fast and
 * deterministic. The previous spec re-ran the full UI download (content
 * tree -> download -> lesson render) in EVERY test, and on a loaded
 * headless runner those serial waits intermittently approached the
 * per-test timeout. That was masked with ``retries: 2`` + a 60s timeout
 * (a retry hides the latency cliff). One download with generous setup
 * headroom + no retries makes a real regression fail on every attempt,
 * while removing the per-test download that caused the flake.
 */

import {expect, test, type BrowserContext, type Page} from "@playwright/test";

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
        // ``window.speechSynthesis`` is a read-only accessor — a plain
        // assignment silently no-ops, leaving the REAL synth in place
        // while ``SpeechSynthesisUtterance`` (writable) gets replaced by
        // the fake. The real synth then rejects the fake utterance
        // ("parameter 1 is not of type 'SpeechSynthesisUtterance'") and
        // crashes the app. Define BOTH so the fake actually takes effect
        // (TTS-E2E-HEADLESS-GUARD-01).
        Object.defineProperty(window, "speechSynthesis", {
            configurable: true,
            value: fakeSynth,
        });
        Object.defineProperty(window, "SpeechSynthesisUtterance", {
            configurable: true,
            writable: true,
            value: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        });
    });
}

/** Expand the collapsible lesson-options panel (#1628) so the wrapped
 *  controls (auto-read toggle, mode toggle, favorite) become visible.
 *  Idempotent: only clicks the trigger while the panel is collapsed. */
async function openLessonOptions(page: Page): Promise<void> {
    const toggle = page.getByTestId("lesson-options-toggle");
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
    }
    await expect(page.getByTestId("lesson-options-body")).toBeVisible();
}

/** UI-download the set once and land on the first lesson; returns the
 *  resolved lesson URL so later navigations skip the download. */
async function downloadAndOpenFirstLesson(page: Page): Promise<string> {
    await page.goto("/content?tab=my");
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
    return page.url();
}

test.describe("Lesson read-aloud (TTS)", () => {
    test.describe.configure({mode: "serial"});

    let context: BrowserContext;
    let page: Page;
    let lessonUrl: string;

    test.beforeAll(async ({browser}) => {
        // One-time setup: the only place the set is downloaded. Give it
        // headroom — it is paid once for the whole spec, not per test.
        test.setTimeout(90_000);
        context = await browser.newContext();
        page = await context.newPage();
        await injectFakeSpeech(page); // applies to every later navigation
        lessonUrl = await downloadAndOpenFirstLesson(page);
    });

    test.afterAll(async () => {
        await context.close();
    });

    /** Reset to a fresh lesson render from the cached set — no download. */
    test.beforeEach(async () => {
        await page.goto(lessonUrl);
        await expect(page.getByTestId("lesson-page")).toBeVisible();
    });

    test("theory read-aloud: controls, mini-player, stop", async () => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // First step is theory -> the auto-read toggle (inside the
        // collapsible options panel since #1628) + theory control are
        // present.
        await openLessonOptions(page);
        await expect(page.getByTestId("lesson-tts-autoread")).toBeVisible();
        const theoryBtn = page.getByTestId("read-aloud-theory");
        await expect(theoryBtn).toBeVisible();
        await expect(theoryBtn).toHaveAttribute("data-speaking", "false");

        // Read it: the rendered Markdown stays in place (no follow-along
        // swap since #147) and the mini-player appears while speaking.
        await theoryBtn.click();
        await expect(theoryBtn).toHaveAttribute("data-speaking", "true");
        await expect(page.getByTestId("lesson-tts-player")).toBeVisible();

        // Something was actually handed to the engine.
        const spoken = await page.evaluate(
            () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken,
        );
        expect(spoken.length).toBeGreaterThan(0);
        expect(spoken[0].length).toBeGreaterThan(0);

        // Stop from the mini-player: the player disappears + speaking ends.
        await page.getByTestId("lesson-tts-player-stop").click();
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);
        await expect(theoryBtn).toHaveAttribute("data-speaking", "false");

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("keyboard shortcut R starts + stops read-aloud", async () => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

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

    test("auto-read mode reads each step on display", async () => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // Turn auto-read on, then move to the next step: it should be
        // spoken automatically. The toggle lives inside the collapsible
        // options panel (#1628), so expand it first.
        await openLessonOptions(page);
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
