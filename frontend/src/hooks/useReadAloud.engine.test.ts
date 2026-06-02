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
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useReadAloud, type ReadAloudController} from "./useReadAloud";

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

beforeEach(() => {
    localStorage.clear();
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
        expect(
            localStorage.getItem("adaptive-learner.voice.lesson_speed"),
        ).toBe("1.25");
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
});
