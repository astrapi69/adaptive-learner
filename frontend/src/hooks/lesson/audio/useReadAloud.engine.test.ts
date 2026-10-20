/**
 * useReadAloud — direct engine hook tests (QA C1g + B2).
 *
 * The pure speed helpers are pinned in ``useReadAloud.test.ts``; this
 * file exercises the hook itself (previously covered only indirectly
 * through the Lesson page): voice resolution + the voiceAvailable
 * fallback branch, onBoundary -> boundaryIndex, setSpeed mid-playback
 * re-speak, pause/resume, and stop reset.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {readLessonSpeed, useReadAloud, type ReadAloudController} from "./useReadAloud";

interface RecordedUtterance {
    text: string;
    lang: string;
    rate: number;
    pitch: number;
    voice: SpeechSynthesisVoice | null;
    onboundary?: (e: {name: string; charIndex: number}) => void;
    onend?: () => void;
    onerror?: () => void;
}

let spoken: RecordedUtterance[];
let cancel: ReturnType<typeof vi.fn>;
let pauseFn: ReturnType<typeof vi.fn>;
let resumeFn: ReturnType<typeof vi.fn>;

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
    return {
        name,
        lang,
        default: false,
        localService: true,
        voiceURI: name,
    } as SpeechSynthesisVoice;
}

/** Mock synth whose getVoices returns ``voices`` immediately so
 *  loadVoices() resolves on the first microtask. */
function setMockSynth(voices: SpeechSynthesisVoice[]): void {
    spoken = [];
    cancel = vi.fn();
    pauseFn = vi.fn();
    resumeFn = vi.fn();
    (window as unknown as {speechSynthesis: SpeechSynthesis}).speechSynthesis =
        {
            getVoices: () => voices,
            speak: (u: RecordedUtterance) => spoken.push(u),
            cancel,
            pause: pauseFn,
            resume: resumeFn,
            speaking: false,
            pending: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as SpeechSynthesis;
    class FakeUtterance {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        voice: SpeechSynthesisVoice | null = null;
        onboundary?: (e: {name: string; charIndex: number}) => void;
        onend?: () => void;
        onerror?: () => void;
        constructor(text: string) {
            this.text = text;
        }
    }
    (
        globalThis as unknown as {SpeechSynthesisUtterance: unknown}
    ).SpeechSynthesisUtterance = FakeUtterance;
    (
        window as unknown as {SpeechSynthesisUtterance: unknown}
    ).SpeechSynthesisUtterance = FakeUtterance;
}

/** Render the hook AND flush loadVoices() so the voice list is
 *  populated before the test speaks. */
async function renderReady(): Promise<{current: () => ReadAloudController}> {
    const {result} = renderHook(() => useReadAloud());
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
    return {current: () => result.current};
}

/** Mount a mock ``navigator.wakeLock`` so the hook's wake-lock effect
 *  (#2666) has something to request against. */
function mountMockWakeLock(): {
    request: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
} {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({
        release,
        released: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    });
    (navigator as unknown as {wakeLock: {request: typeof request}}).wakeLock = {
        request,
    };
    return {request, release};
}

/** Flush the microtask queue so async effects (wake-lock request) settle. */
async function flush(): Promise<void> {
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    delete (navigator as unknown as {wakeLock?: unknown}).wakeLock;
});

describe("useReadAloud engine", () => {
    it("resolves a voice that matches the requested language", async () => {
        setMockSynth([makeVoice("DE", "de"), makeVoice("ES", "es")]);
        const h = await renderReady();
        act(() => h.current().speak("hola", {lang: "es"}));
        expect(spoken).toHaveLength(1);
        expect(spoken[0].voice?.lang).toBe("es");
        expect(h.current().voiceAvailable).toBe(true);
    });

    it("flags voiceAvailable=false when no voice matches the language (B2)", async () => {
        setMockSynth([makeVoice("DE", "de")]);
        const h = await renderReady();
        act(() => h.current().speak("bonjour", {lang: "fr"}));
        expect(spoken[0].voice).toBeNull();
        expect(h.current().voiceAvailable).toBe(false);
        // Playback still proceeds (engine default voice).
        expect(h.current().speaking).toBe(true);
    });

    it("maps a word boundary event to boundaryIndex", async () => {
        setMockSynth([makeVoice("DE", "de")]);
        const h = await renderReady();
        act(() => h.current().speak("read me", {lang: "de"}));
        expect(h.current().boundaryIndex).toBe(-1);
        act(() => spoken[0].onboundary?.({name: "word", charIndex: 5}));
        expect(h.current().boundaryIndex).toBe(5);
        // Non-word boundaries are ignored.
        act(() => spoken[0].onboundary?.({name: "sentence", charIndex: 0}));
        expect(h.current().boundaryIndex).toBe(5);
    });

    it("setSpeed mid-playback persists + restarts the read at the new rate", async () => {
        setMockSynth([makeVoice("DE", "de")]);
        const h = await renderReady();
        act(() => h.current().speak("read me", {lang: "de"}));
        expect(spoken).toHaveLength(1);
        act(() => h.current().setSpeed(1.25));
        expect(readLessonSpeed()).toBe(1.25);
        // Restarted (one more utterance) at rate base(1.0) x 1.25.
        expect(spoken).toHaveLength(2);
        expect(spoken[1].rate).toBeCloseTo(1.25);
    });

    it("pause/resume pass through + toggle the paused flag", async () => {
        setMockSynth([makeVoice("DE", "de")]);
        const h = await renderReady();
        act(() => h.current().speak("read me", {lang: "de"}));
        act(() => h.current().pause());
        expect(pauseFn).toHaveBeenCalled();
        expect(h.current().paused).toBe(true);
        act(() => h.current().resume());
        expect(resumeFn).toHaveBeenCalled();
        expect(h.current().paused).toBe(false);
    });

    it("stop cancels + resets speaking/active/boundary", async () => {
        setMockSynth([makeVoice("DE", "de")]);
        const h = await renderReady();
        act(() => h.current().speak("read me", {lang: "de", id: "x"}));
        expect(h.current().speaking).toBe(true);
        expect(h.current().activeId).toBe("x");
        act(() => h.current().stop());
        expect(cancel).toHaveBeenCalled();
        expect(h.current().speaking).toBe(false);
        expect(h.current().activeId).toBeNull();
        expect(h.current().boundaryIndex).toBe(-1);
    });

    describe("screen wake lock (#2666)", () => {
        it("requests a screen wake lock while a stream is speaking", async () => {
            setMockSynth([makeVoice("DE", "de")]);
            const {request} = mountMockWakeLock();
            const h = await renderReady();
            act(() => h.current().speak("read me", {lang: "de"}));
            await flush();
            expect(request).toHaveBeenCalledWith("screen");
        });

        it("releases the wake lock when playback is stopped", async () => {
            setMockSynth([makeVoice("DE", "de")]);
            const {release} = mountMockWakeLock();
            const h = await renderReady();
            act(() => h.current().speak("read me", {lang: "de"}));
            await flush();
            act(() => h.current().stop());
            await flush();
            expect(release).toHaveBeenCalled();
        });

        it("releases the wake lock when a stream ends naturally", async () => {
            setMockSynth([makeVoice("DE", "de")]);
            const {release} = mountMockWakeLock();
            const h = await renderReady();
            act(() => h.current().speak("read me", {lang: "de"}));
            await flush();
            act(() => spoken[0].onend?.());
            await flush();
            expect(release).toHaveBeenCalled();
        });

        it("re-acquires the wake lock after the browser released it on an app switch (#3358)", async () => {
            setMockSynth([makeVoice("DE", "de")]);
            const listeners: (() => void)[] = [];
            const sentinel = {
                released: false,
                addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
                removeEventListener: vi.fn(),
                release: vi.fn(async () => {
                    sentinel.released = true;
                    listeners.forEach((listener) => listener());
                }),
            };
            const request = vi.fn().mockResolvedValue(sentinel);
            (navigator as unknown as {wakeLock: {request: typeof request}}).wakeLock = {request};
            const h = await renderReady();
            act(() => h.current().speak("read me", {lang: "de"}));
            await flush();
            const setVisibility = (state: "hidden" | "visible") => {
                Object.defineProperty(document, "visibilityState", {configurable: true, get: () => state});
                document.dispatchEvent(new Event("visibilitychange"));
            };
            await act(async () => {
                setVisibility("hidden");
                await sentinel.release();
            });
            await act(async () => setVisibility("visible"));
            await flush();
            expect(request).toHaveBeenCalledTimes(2);
        });

        it("does not request a wake lock when the API is unsupported", async () => {
            setMockSynth([makeVoice("DE", "de")]);
            const h = await renderReady();
            expect(() => act(() => h.current().speak("read me", {lang: "de"}))).not.toThrow();
            await flush();
            expect(h.current().speaking).toBe(true);
        });
    });
});

/** A voice whose synthesis runs at a remote service: the text read aloud
 *  leaves the device (Chrome's "Google ..." voices). */
function makeNetworkVoice(name: string, lang: string): SpeechSynthesisVoice {
    return {...makeVoice(name, lang), localService: false} as SpeechSynthesisVoice;
}

/** Like a real browser, ``getVoices()`` returns a fresh array of whatever
 *  ``offered`` holds at call time, so voices added after the hook loaded its
 *  list stay out of that list. */
function offerVoices(initial: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
    const offered = [...initial];
    setMockSynth(initial);
    (window.speechSynthesis as unknown as {getVoices: () => SpeechSynthesisVoice[]}).getVoices =
        () => [...offered];
    return offered;
}

// #3805: the read-aloud text reaches a network voice's provider. Measured
// in Google Chrome 155 on Linux with speech-dispatcher: "Google Deutsch"
// (de-DE, network) and "German espeak-ng" (de, local); the network voices
// arrive first.
describe("useReadAloud voice choice (#3805)", () => {
    const googleDeutsch = makeNetworkVoice("Google Deutsch", "de-DE");
    const espeakGerman = makeVoice("German espeak-ng", "de");

    it("reads with a local voice when a network voice for the same language is listed first", async () => {
        offerVoices([googleDeutsch, espeakGerman]);
        const h = await renderReady();
        act(() => h.current().speak("Hallo Welt", {lang: "de-DE"}));
        expect(spoken[0].voice).toBe(espeakGerman);
    });

    it("uses the voices the browser offers when speaking, not only those loaded at mount", async () => {
        const offered = offerVoices([googleDeutsch]);
        const h = await renderReady();
        offered.push(espeakGerman);
        act(() => h.current().speak("Hallo Welt", {lang: "de"}));
        expect(spoken[0].voice).toBe(espeakGerman);
    });

    it("falls back to the network voice when the browser offers no local voice for the language", async () => {
        offerVoices([googleDeutsch, makeVoice("English espeak-ng", "en-US")]);
        const h = await renderReady();
        act(() => h.current().speak("Hallo Welt", {lang: "de"}));
        expect(spoken[0].voice).toBe(googleDeutsch);
        expect(h.current().voiceAvailable).toBe(true);
    });

    it("keeps the learner's explicit voice choice, even a network voice", async () => {
        localStorage.setItem(
            "adaptive-learner.voice.prefs",
            JSON.stringify({ttsVoiceName: "Google Deutsch"}),
        );
        offerVoices([googleDeutsch, espeakGerman]);
        const h = await renderReady();
        act(() => h.current().speak("Hallo Welt", {lang: "de"}));
        expect(spoken[0].voice).toBe(googleDeutsch);
    });
});
