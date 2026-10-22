/**
 * Lesson read-aloud (TTS) smoke - Dexie build, no backend.
 *
 * Opens the bundled French-A1-for-English set's first lesson
 * (01-greetings, a theory step) and exercises the read-aloud surface:
 *
 *   - the auto-read toggle + the theory "Read aloud" control render;
 *   - clicking the theory control speaks the body and surfaces the
 *     floating mini-player;
 *   - the mini-player's X ends playback;
 *   - pressing "R" toggles read-aloud from the keyboard;
 *   - auto-read speaks each step on display, and the X ends it for the
 *     current lesson only (the next step stays silent, a fresh load reads
 *     again, #3760);
 *   - every one of them reads with the voice on the device, although the
 *     engine lists an online voice for the language first, also on a cold
 *     start where the device voice is listed only after the online one
 *     (#3805: an online voice sends the text to its provider).
 *
 * speechSynthesis is INJECTED before the app loads so the run does not
 * depend on voices being installed in headless chromium.
 *
 * #165 - flake fix: the set is downloaded ONCE in ``beforeAll`` (a shared
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

/** The part of a ``SpeechSynthesisVoice`` the app reads. */
interface FakeVoice {
    name: string;
    lang: string;
    localService: boolean;
    default: boolean;
    voiceURI: string;
}

/** Both voices speak the lesson's language. The online one is listed first,
 *  as Chrome lists its "Google ..." voices on some systems (#3805). */
const ONLINE_VOICE: FakeVoice = {
    name: "Google français",
    lang: "fr-FR",
    localService: false,
    default: true,
    voiceURI: "Google français",
};
const DEVICE_VOICE: FakeVoice = {
    name: "French (device)",
    lang: "fr-FR",
    localService: true,
    default: false,
    voiceURI: "French (device)",
};

interface FakeSpeechOptions {
    /** List only the online voice at first and the device voice once the
     *  page listens for ``voiceschanged``: a cold start on a browser that
     *  lists its device voices after its online ones (#3805). */
    deviceVoiceLate?: boolean;
}

/** Install a deterministic speechSynthesis before any app code runs. It
 *  records the text and the voice name of every utterance it is handed. */
async function injectFakeSpeech(
    page: Page,
    options: FakeSpeechOptions = {},
): Promise<void> {
    const voiceSetup = {
        online: ONLINE_VOICE,
        device: DEVICE_VOICE,
        deviceVoiceLate: options.deviceVoiceLate ?? false,
    };
    await page.addInitScript(({online, device, deviceVoiceLate}) => {
        const w = window as unknown as {
            __ttsSpoken: string[];
            __ttsVoices: (string | null)[];
            speechSynthesis: unknown;
            SpeechSynthesisUtterance: unknown;
        };
        w.__ttsSpoken = [];
        w.__ttsVoices = [];
        let voices = deviceVoiceLate ? [online] : [online, device];
        const voicesChangedListeners = new Set<() => void>();
        let deviceVoiceScheduled = false;
        /** The device voice arrives 200 ms after the page first listens. */
        const scheduleDeviceVoice = () => {
            if (!deviceVoiceLate || deviceVoiceScheduled) return;
            deviceVoiceScheduled = true;
            setTimeout(() => {
                voices = [online, device];
                [...voicesChangedListeners].forEach((listener) => listener());
            }, 200);
        };
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
            getVoices: () => voices,
            // Record + keep "speaking" (do NOT auto-fire onend) so the
            // UI's speaking state is stable for assertions.
            speak: (u: FakeUtterance) => {
                w.__ttsSpoken.push(u.text);
                w.__ttsVoices.push(
                    u.voice ? (u.voice as {name: string}).name : null,
                );
            },
            cancel: () => {},
            pause: () => {},
            resume: () => {},
            speaking: false,
            pending: false,
            addEventListener: (type: string, listener: () => void) => {
                if (type !== "voiceschanged") return;
                voicesChangedListeners.add(listener);
                scheduleDeviceVoice();
            },
            removeEventListener: (type: string, listener: () => void) => {
                if (type === "voiceschanged") voicesChangedListeners.delete(listener);
            },
        };
        // ``window.speechSynthesis`` is a read-only accessor - a plain
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
    }, voiceSetup);
}

/** The voice name of every utterance handed to the engine so far (null:
 *  no voice set, the browser would choose). */
async function spokenVoices(page: Page): Promise<(string | null)[]> {
    return page.evaluate(
        () => (window as unknown as {__ttsVoices: (string | null)[]}).__ttsVoices,
    );
}

/** Something was read, and every utterance used the device voice (#3805). */
async function expectReadWithDeviceVoice(page: Page): Promise<void> {
    const voices = await spokenVoices(page);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices).toEqual(voices.map(() => DEVICE_VOICE.name));
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
        // headroom: it is paid once for the whole spec, not per test.
        test.setTimeout(90_000);
        context = await browser.newContext();
        page = await context.newPage();
        await injectFakeSpeech(page); // applies to every later navigation
        lessonUrl = await downloadAndOpenFirstLesson(page);
    });

    test.afterAll(async () => {
        await context.close();
    });

    /** Reset to a fresh lesson render from the cached set, no download. */
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
        // ... with the device voice, not the online voice listed first.
        await expectReadWithDeviceVoice(page);

        // End from the mini-player's X (#3760): the player disappears +
        // speaking ends.
        await page.getByTestId("lesson-tts-player-end").click();
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);
        await expect(theoryBtn).toHaveAttribute("data-speaking", "false");

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    // #1928 - iOS Safari silently stops a single utterance after ~15s, which
    // cut a typical theory run (median 1551 chars over the shipped content)
    // off after roughly a tenth of its text. ``speak()`` now hands the engine
    // one utterance PER CHUNK; this pins that it actually happens.
    //
    // Runs under Chromium rather than the WebKit gate on purpose: the
    // chunking is plain JS, and the fake synth above records every utterance,
    // so the mechanism is observable here. What this canNOT show is the iOS
    // cutoff itself: that stays a manual device check.
    test("a theory block is spoken as several chunked utterances", async () => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openLessonOptions(page);
        await page.getByTestId("read-aloud-theory").click();
        await expect(page.getByTestId("lesson-tts-player")).toBeVisible();

        const spoken = await page.evaluate(
            () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken,
        );

        // Precondition: the block is long enough for the question to mean
        // anything. If a future content change makes the first lesson's
        // theory tiny, this fails loudly instead of passing vacuously.
        const total = spoken.join("").length;
        expect(total).toBeGreaterThan(300);

        // The pin: NOT handed over as one long utterance ...
        expect(spoken.length).toBeGreaterThan(1);
        // ... and no single utterance exceeds the chunk budget.
        for (const chunk of spoken) {
            expect(chunk.length).toBeLessThanOrEqual(250);
        }

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
        await expectReadWithDeviceVoice(page);
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
        await expectReadWithDeviceVoice(page);

        // #3760 - the player's X ends read-aloud for THIS lesson: playback
        // stops, auto-read is off here, and the next step is not read again.
        await expect(page.getByTestId("lesson-tts-player")).toBeVisible();
        await page.getByTestId("lesson-tts-player-end").click();
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);
        await expect(page.getByTestId("lesson-tts-autoread")).toHaveAttribute(
            "aria-pressed",
            "false",
        );
        const afterEnd = await page.evaluate(
            () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken.length,
        );
        await page.getByTestId("lesson-next").click();
        await expect(page.getByTestId("lesson-tts-player")).toHaveCount(0);
        expect(
            await page.evaluate(
                () => (window as unknown as {__ttsSpoken: string[]}).__ttsSpoken.length,
            ),
        ).toBe(afterEnd);

        // The saved setting is untouched: a fresh load of the lesson has
        // auto-read on again.
        await page.goto(lessonUrl);
        await expect(page.getByTestId("lesson-page")).toBeVisible();
        await openLessonOptions(page);
        await expect(page.getByTestId("lesson-tts-autoread")).toHaveAttribute(
            "aria-pressed",
            "true",
        );

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    // #3805 - a cold start straight into a lesson with auto-read on: the
    // browser lists only its online voice at first and the device voice a
    // moment later. Auto-read must wait for it instead of reading the first
    // step with the online voice, which would send the text to its provider.
    test("auto-read on a cold start waits for the device voice listed late", async () => {
        // Auto-read on, saved in the preferences the whole context shares.
        await openLessonOptions(page);
        const autoRead = page.getByTestId("lesson-tts-autoread");
        if ((await autoRead.getAttribute("aria-pressed")) !== "true") {
            await autoRead.click();
        }
        await expect(autoRead).toHaveAttribute("aria-pressed", "true");

        const coldPage = await context.newPage();
        const errors: string[] = [];
        coldPage.on("pageerror", (e) => errors.push(e.message));
        try {
            await injectFakeSpeech(coldPage, {deviceVoiceLate: true});
            await coldPage.goto(lessonUrl);
            await expect(coldPage.getByTestId("lesson-page")).toBeVisible();
            await expect
                .poll(async () => (await spokenVoices(coldPage)).length)
                .toBeGreaterThan(0);
            await expectReadWithDeviceVoice(coldPage);
            expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
        } finally {
            await coldPage.close();
        }
    });
});
