/**
 * Pure-helper tests for the TTS wrapper (Phase 31A).
 *
 * happy-dom doesn't ship ``window.speechSynthesis`` so we
 * mount a small mock on ``window`` for the tests that exercise
 * the API surface, and confirm the helpers short-circuit
 * cleanly when ``speechSynthesis`` is absent.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    currentVoices,
    DEVICE_VOICE_WAIT_MS,
    isSpeaking,
    isSpeechSynthesisSupported,
    loadVoices,
    pause,
    pickVoice,
    resolveVoice,
    resume,
    speak,
    stop,
    whenDeviceVoicesKnown,
} from "./speech-synthesis";

function makeVoice(
    name: string,
    lang: string,
    isDefault = false,
): SpeechSynthesisVoice {
    return {
        name,
        lang,
        default: isDefault,
        localService: true,
        voiceURI: name,
    } as SpeechSynthesisVoice;
}

/** A voice the browser synthesises through a remote service: the text
 *  being read leaves the device (Chrome's "Google ..." voices). */
function makeNetworkVoice(name: string, lang: string): SpeechSynthesisVoice {
    return {...makeVoice(name, lang), localService: false} as SpeechSynthesisVoice;
}

interface MockSynth {
    voices: SpeechSynthesisVoice[];
    speaking: boolean;
    pending: boolean;
    listeners: Map<string, Array<() => void>>;
    getVoices: () => SpeechSynthesisVoice[];
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    addEventListener: (ev: string, cb: () => void) => void;
    removeEventListener: (ev: string, cb: () => void) => void;
}

function mountMockSynth(initialVoices: SpeechSynthesisVoice[] = []): MockSynth {
    const listeners = new Map<string, Array<() => void>>();
    const mock: MockSynth = {
        voices: initialVoices,
        speaking: false,
        pending: false,
        listeners,
        getVoices() {
            return this.voices;
        },
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        addEventListener(ev: string, cb: () => void) {
            const arr = listeners.get(ev) ?? [];
            arr.push(cb);
            listeners.set(ev, arr);
        },
        removeEventListener(ev: string, cb: () => void) {
            const arr = listeners.get(ev) ?? [];
            listeners.set(
                ev,
                arr.filter((x) => x !== cb),
            );
        },
    };
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        speechSynthesis: mock as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: class {
            text: string;
            lang = "";
            rate = 1;
            pitch = 1;
            voice: SpeechSynthesisVoice | null = null;
            onstart?: () => void;
            onend?: () => void;
            onerror?: () => void;
            onboundary?: () => void;
            constructor(text: string) {
                this.text = text;
            }
        } as unknown as typeof SpeechSynthesisUtterance,
    } as Window & typeof globalThis;
    (globalThis as unknown as {SpeechSynthesisUtterance: unknown}).SpeechSynthesisUtterance = (
        globalThis as unknown as {window: {SpeechSynthesisUtterance: unknown}}
    ).window.SpeechSynthesisUtterance;
    return mock;
}

function unmountSynth(): void {
    const w = (globalThis as unknown as {window: typeof window}).window;
    if (w) {
        delete (w as {speechSynthesis?: SpeechSynthesis}).speechSynthesis;
    }
}

beforeEach(() => {
    unmountSynth();
});

// --- Support detection -----------------------------------------------

describe("isSpeechSynthesisSupported", () => {
    it("returns false when window.speechSynthesis is absent", () => {
        expect(isSpeechSynthesisSupported()).toBe(false);
    });

    it("returns true after mounting", () => {
        mountMockSynth();
        expect(isSpeechSynthesisSupported()).toBe(true);
    });
});

// --- pickVoice -------------------------------------------------------

describe("pickVoice", () => {
    const voices = [
        makeVoice("Alice EN-US", "en-US"),
        makeVoice("Bob EN-GB", "en-GB"),
        makeVoice("Charlie DE", "de-DE"),
    ];

    it("returns null when no voices are available", () => {
        expect(pickVoice([], "en-US")).toBeNull();
    });

    it("matches exact lang code first", () => {
        const v = pickVoice(voices, "en-US");
        expect(v?.name).toBe("Alice EN-US");
    });

    it("falls back to lang prefix when no exact match", () => {
        // No "en-AU"; prefix "en" matches "en-US" (first wins).
        const v = pickVoice(voices, "en-AU");
        expect(v?.name).toBe("Alice EN-US");
    });

    it("matches across case", () => {
        const v = pickVoice(voices, "EN-us");
        expect(v?.name).toBe("Alice EN-US");
    });

    it("returns null when no language family matches", () => {
        expect(pickVoice(voices, "fr-FR")).toBeNull();
    });
});

// #3805: a network voice sends the text being read to its provider (Chrome:
// GET www.google.com/speech-api/v2/synthesize?text=...). The shape below is
// the one measured in Google Chrome 155 on Linux with speech-dispatcher:
// "Google Deutsch" (de-DE, network) next to "German espeak-ng" (de, local).
describe("pickVoice prefers local voices (#3805)", () => {
    const googleDeutsch = makeNetworkVoice("Google Deutsch", "de-DE");
    const espeakGerman = makeVoice("German espeak-ng", "de");

    it("picks the local voice for the language although a network voice matches exactly and is listed first", () => {
        expect(pickVoice([googleDeutsch, espeakGerman], "de-DE")).toBe(
            espeakGerman,
        );
    });

    it.each([
        {match: "exact", local: makeVoice("Local de-DE", "de-DE")},
        {match: "prefix", local: makeVoice("Local de-AT", "de-AT")},
        {match: "bare", local: makeVoice("Local de", "de")},
    ])("a local $match match beats an exact network match", ({local}) => {
        expect(pickVoice([googleDeutsch, local], "de-DE")).toBe(local);
    });

    it("keeps exact before prefix before bare among the local voices", () => {
        const prefix = makeVoice("Local de-AT", "de-AT");
        const bare = makeVoice("Local de", "de");
        const exact = makeVoice("Local de-DE", "de-DE");
        expect(pickVoice([prefix, bare, exact], "de-DE")).toBe(exact);
        expect(pickVoice([bare, prefix], "de-DE")).toBe(prefix);
    });

    it("falls back to a network voice when no local voice matches the language", () => {
        const espeakEnglish = makeVoice("English espeak-ng", "en-US");
        expect(pickVoice([espeakEnglish, googleDeutsch], "de")).toBe(
            googleDeutsch,
        );
    });

    it("uses the network voice when the browser offers nothing else (Chrome on Linux by default)", () => {
        expect(pickVoice([googleDeutsch], "de")).toBe(googleDeutsch);
    });

    it("counts a voice as local only when localService is true", () => {
        const unknown = {
            ...makeVoice("Unknown de", "de"),
            localService: undefined,
        } as unknown as SpeechSynthesisVoice;
        expect(pickVoice([unknown, espeakGerman], "de")).toBe(espeakGerman);
        expect(pickVoice([unknown], "de")).toBe(unknown);
    });
});

describe("resolveVoice: an explicit choice wins (#3805)", () => {
    const googleDeutsch = makeNetworkVoice("Google Deutsch", "de-DE");
    const espeakGerman = makeVoice("German espeak-ng", "de");
    const offered = [googleDeutsch, espeakGerman];

    it("uses the voice the learner chose in Settings, even a network voice", () => {
        expect(resolveVoice(offered, "de", "Google Deutsch")).toBe(
            googleDeutsch,
        );
    });

    it("without a stored choice, takes the local-first pick", () => {
        expect(resolveVoice(offered, "de", "")).toBe(espeakGerman);
    });

    it("a stored choice the browser no longer offers falls back to the local-first pick", () => {
        expect(resolveVoice(offered, "de", "Microsoft Hedda")).toBe(
            espeakGerman,
        );
    });

    it("returns null when nothing matches and nothing was chosen", () => {
        expect(resolveVoice(offered, "fr", "")).toBeNull();
    });
});

// --- currentVoices ---------------------------------------------------

// Chrome hands out its voices in batches: on Linux with speech-dispatcher
// the 19 network voices are listed at once, the local voices about a second
// later. A list loaded once at mount then lacks the local voices (#3805,
// measured).
describe("currentVoices", () => {
    it("returns what the browser offers now, not the list loaded earlier", () => {
        const loadedAtMount = [makeNetworkVoice("Google Deutsch", "de-DE")];
        const synth = mountMockSynth([
            ...loadedAtMount,
            makeVoice("German espeak-ng", "de"),
        ]);
        expect(currentVoices(loadedAtMount)).toEqual(synth.voices);
    });

    it("keeps the loaded list while the browser's list is still empty", () => {
        mountMockSynth([]);
        const loaded = [makeVoice("German espeak-ng", "de")];
        expect(currentVoices(loaded)).toBe(loaded);
    });

    it("returns the loaded list when speech synthesis is unavailable", () => {
        const loaded = [makeVoice("German espeak-ng", "de")];
        expect(currentVoices(loaded)).toBe(loaded);
    });
});

// --- whenDeviceVoicesKnown --------------------------------------------

// Measured on a cold start of Chrome 155 on Linux with speech-dispatcher
// (#3805): the network voices came at ~30 ms, auto-read spoke at ~450 ms,
// the device voices came in one batch at ~550 ms. Auto-read therefore read
// its first step with "Google Deutsch" although the device had a German voice.
describe("whenDeviceVoicesKnown (#3805)", () => {
    const googleDeutsch = makeNetworkVoice("Google Deutsch", "de-DE");
    const espeakGerman = makeVoice("German espeak-ng", "de");

    /** Add ``voices`` to the browser's list and fire ``voiceschanged``. */
    function deliver(synth: MockSynth, ...voices: SpeechSynthesisVoice[]): void {
        synth.voices = [...synth.voices, ...voices];
        (synth.listeners.get("voiceschanged") ?? []).forEach((cb) => cb());
    }

    beforeEach(() => {
        vi.useFakeTimers();
        return () => vi.useRealTimers();
    });

    it("calls back at once when the browser lists a device voice", () => {
        mountMockSynth([googleDeutsch, espeakGerman]);
        const onReady = vi.fn();
        whenDeviceVoicesKnown("", onReady);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("calls back at once when the chosen voice is listed, even a network voice", () => {
        mountMockSynth([googleDeutsch]);
        const onReady = vi.fn();
        whenDeviceVoicesKnown("Google Deutsch", onReady);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it.each([
        {listed: "no voice yet", initial: []},
        {listed: "only network voices", initial: [googleDeutsch]},
    ])("waits while the browser lists $listed and calls back when the device voices arrive", ({initial}) => {
        const synth = mountMockSynth([...initial]);
        const onReady = vi.fn();
        whenDeviceVoicesKnown("", onReady);
        deliver(synth, googleDeutsch);
        vi.advanceTimersByTime(100);
        expect(onReady).not.toHaveBeenCalled();
        deliver(synth, espeakGerman);
        expect(onReady).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(DEVICE_VOICE_WAIT_MS);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(synth.listeners.get("voiceschanged")).toEqual([]);
    });

    it("calls back when device voices arrive, also when none of them speaks the lesson language", () => {
        const synth = mountMockSynth([googleDeutsch]);
        const onReady = vi.fn();
        whenDeviceVoicesKnown("", onReady);
        deliver(synth, makeVoice("English espeak-ng", "en-US"));
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("calls back after the wait when no device voice comes, and does not wait again on that page", () => {
        mountMockSynth([googleDeutsch]);
        const first = vi.fn();
        whenDeviceVoicesKnown("", first);
        vi.advanceTimersByTime(DEVICE_VOICE_WAIT_MS - 1);
        expect(first).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(first).toHaveBeenCalledTimes(1);
        const second = vi.fn();
        whenDeviceVoicesKnown("", second);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("never calls back once cancelled", () => {
        const synth = mountMockSynth([googleDeutsch]);
        const onReady = vi.fn();
        const cancel = whenDeviceVoicesKnown("", onReady);
        cancel();
        deliver(synth, espeakGerman);
        vi.advanceTimersByTime(DEVICE_VOICE_WAIT_MS);
        expect(onReady).not.toHaveBeenCalled();
        expect(synth.listeners.get("voiceschanged")).toEqual([]);
    });

    it("calls back at once when speech synthesis is unavailable", () => {
        const onReady = vi.fn();
        whenDeviceVoicesKnown("", onReady);
        expect(onReady).toHaveBeenCalledTimes(1);
    });
});

// --- loadVoices ------------------------------------------------------

describe("loadVoices", () => {
    it("returns the synchronously-available list when non-empty", async () => {
        const voices = [makeVoice("X", "en-US")];
        mountMockSynth(voices);
        const result = await loadVoices();
        expect(result).toHaveLength(1);
    });

    it("waits for voiceschanged when initial getVoices() returns []", async () => {
        const synth = mountMockSynth([]);
        // After 20ms, drop a voice in + fire the event.
        setTimeout(() => {
            synth.voices = [makeVoice("Late", "fr-FR")];
            (synth.listeners.get("voiceschanged") ?? []).forEach((cb) => cb());
        }, 20);
        const result = await loadVoices();
        expect(result).toHaveLength(1);
    });

    it("returns [] when SpeechSynthesis is absent", async () => {
        expect(await loadVoices()).toEqual([]);
    });
});

// --- speak / stop / isSpeaking --------------------------------------

describe("speak", () => {
    it("short-circuits when synthesis is unavailable", () => {
        expect(speak("hello")).toBeNull();
    });

    it("short-circuits on empty / whitespace text", () => {
        mountMockSynth();
        expect(speak("")).toBeNull();
        expect(speak("   ")).toBeNull();
    });

    it("cancels prior utterance before queuing the new one", () => {
        const synth = mountMockSynth();
        speak("hello", {lang: "en-US"});
        expect(synth.cancel).toHaveBeenCalled();
        expect(synth.speak).toHaveBeenCalledTimes(1);
    });

    it("clamps rate + pitch to [0.5, 2.0]", () => {
        const synth = mountMockSynth();
        const u = speak("hello", {rate: 5, pitch: 0.1});
        expect(u).not.toBeNull();
        expect(u!.rate).toBe(2.0);
        expect(u!.pitch).toBe(0.5);
        // Sanity: the cancelled+spoken path was hit.
        expect(synth.speak).toHaveBeenCalled();
    });

    it("attaches onEnd / onError handlers", () => {
        mountMockSynth();
        const onEnd = vi.fn();
        const onError = vi.fn();
        const u = speak("hello", {onEnd, onError});
        expect(u!.onend).toBe(onEnd);
        expect(u!.onerror).toBe(onError);
    });

    it("reports boundaries to the caller (lesson read-aloud follow-along)", () => {
        // QA B1 — the highlight (C5) + continuous auto-advance (C7)
        // depend on this being wired; pin it so removing it fails the
        // voice-lib suite, not just an indirect page test.
        //
        // Since #1928 the handler is a WRAPPER (it shifts charIndex by the
        // chunk offset), so this asserts the reported VALUES rather than
        // callback identity.
        mountMockSynth();
        const onBoundary = vi.fn();
        const u = speak("hello world", {onBoundary});
        const attached = (u as unknown as {
            onboundary?: (e: {name: string; charIndex: number}) => void;
        }).onboundary;
        expect(attached).toBeTypeOf("function");
        attached!({name: "word", charIndex: 6});
        expect(onBoundary).toHaveBeenCalledWith({name: "word", charIndex: 6});
    });

    // #1928 — the load-bearing invariant: a boundary inside a LATER chunk is
    // reported in the original text's coordinates, not the chunk's. Without
    // the offset, useLessonAutoRead would advance to the wrong theory step.
    it("shifts a later chunk's charIndex into the original text's coordinates", () => {
        const synth = mountMockSynth();
        const onBoundary = vi.fn();
        // Two sentences well over the chunk budget: forces >= 2 utterances.
        const sentence = "Dies ist ein ausreichend langer Satz zum Testen. ";
        speak(sentence.repeat(12), {onBoundary});

        const spoken = synth.speak.mock.calls.map(
            (c: unknown[]) => c[0] as {
                text: string;
                onboundary?: (e: {name: string; charIndex: number}) => void;
            },
        );
        expect(spoken.length).toBeGreaterThan(1);

        // Fire a boundary at index 3 of the SECOND chunk.
        spoken[1].onboundary!({name: "word", charIndex: 3});
        const reported = onBoundary.mock.calls[0][0] as {charIndex: number};
        expect(reported.charIndex).toBe(spoken[0].text.length + 3);
    });

    it("leaves onBoundary unset when no handler is passed", () => {
        mountMockSynth();
        const u = speak("hello");
        expect(
            (u as unknown as {onboundary?: unknown}).onboundary,
        ).toBeUndefined();
    });
});

describe("stop / pause / resume / isSpeaking", () => {
    it("stop() calls speechSynthesis.cancel", () => {
        const synth = mountMockSynth();
        stop();
        expect(synth.cancel).toHaveBeenCalled();
    });

    it("pause() / resume() pass through", () => {
        const synth = mountMockSynth();
        pause();
        resume();
        expect(synth.pause).toHaveBeenCalled();
        expect(synth.resume).toHaveBeenCalled();
    });

    it("isSpeaking reflects synth.speaking || pending", () => {
        const synth = mountMockSynth();
        expect(isSpeaking()).toBe(false);
        synth.speaking = true;
        expect(isSpeaking()).toBe(true);
        synth.speaking = false;
        synth.pending = true;
        expect(isSpeaking()).toBe(true);
    });

    it("all stop/pause/resume/isSpeaking are safe when unavailable", () => {
        expect(() => {
            stop();
            pause();
            resume();
            expect(isSpeaking()).toBe(false);
        }).not.toThrow();
    });
});
