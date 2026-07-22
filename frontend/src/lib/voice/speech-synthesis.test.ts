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
    isSpeaking,
    isSpeechSynthesisSupported,
    loadVoices,
    pause,
    pickVoice,
    resume,
    speak,
    stop,
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
