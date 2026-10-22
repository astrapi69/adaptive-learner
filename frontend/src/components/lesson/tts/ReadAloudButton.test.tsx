/**
 * ReadAloudButton tests (TTS feature C1).
 *
 * Visibility gates (no support / pref off / empty text → no render),
 * the play/stop click toggle, and that the saved lesson speed
 * multiplies the utterance rate.
 */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../../../hooks/ui/useI18n";
import {VOICE_PREF_KEYS} from "../../../lib/voice/voicePref";

import ReadAloudButton from "./ReadAloudButton";

function setMockSynth(voices: SpeechSynthesisVoice[] = []): {
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
} {
    const speak = vi.fn();
    const cancel = vi.fn();
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        speechSynthesis: {
            getVoices: () => [...voices],
            speak,
            cancel,
            pause: vi.fn(),
            resume: vi.fn(),
            speaking: false,
            pending: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as SpeechSynthesis,
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
    return {speak, cancel};
}

function unsetSynth(): void {
    const w = (globalThis as unknown as {window: typeof window}).window;
    if (w) {
        delete (w as {speechSynthesis?: SpeechSynthesis}).speechSynthesis;
    }
}

function renderBtn(props: {text: string; lang?: string; testId?: string}) {
    return render(
        <I18nProvider>
            <ReadAloudButton {...props} />
        </I18nProvider>,
    );
}

beforeEach(() => {
    localStorage.clear();
    unsetSynth();
});

describe("ReadAloudButton visibility gates", () => {
    it("renders nothing when speechSynthesis is unavailable", () => {
        const {container} = renderBtn({text: "hola"});
        expect(
            container.querySelector('[data-testid="read-aloud"]'),
        ).toBeNull();
    });

    it("renders nothing when TTS is disabled in Settings", () => {
        setMockSynth();
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "false");
        const {container} = renderBtn({text: "hola"});
        expect(
            container.querySelector('[data-testid="read-aloud"]'),
        ).toBeNull();
    });

    it("renders nothing for empty / whitespace text", () => {
        setMockSynth();
        const {container} = renderBtn({text: "   "});
        expect(
            container.querySelector('[data-testid="read-aloud"]'),
        ).toBeNull();
    });

    it("renders the button when supported + enabled + has text", () => {
        setMockSynth();
        renderBtn({text: "hola", testId: "t1"});
        const btn = screen.getByTestId("read-aloud-t1");
        expect(btn).toBeTruthy();
        expect(btn.getAttribute("data-speaking")).toBe("false");
    });
});

describe("ReadAloudButton click", () => {
    it("speaks the text and flips data-speaking, second click stops", () => {
        const {speak, cancel} = setMockSynth();
        renderBtn({text: "hola mundo", lang: "es", testId: "t1"});
        const btn = screen.getByTestId("read-aloud-t1");
        fireEvent.click(btn);
        expect(speak).toHaveBeenCalledTimes(1);
        const utter = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
        expect(utter.text).toBe("hola mundo");
        expect(utter.lang).toBe("es");
        expect(btn.getAttribute("data-speaking")).toBe("true");
        fireEvent.click(btn);
        expect(btn.getAttribute("data-speaking")).toBe("false");
        expect(cancel).toHaveBeenCalled();
    });

    it("multiplies the utterance rate by the saved lesson speed", () => {
        const {speak} = setMockSynth();
        // Saved rate 1.0 (default) x 1.25 lesson speed = 1.25.
        localStorage.setItem("adaptive-learner.voice.lesson_speed", "1.25");
        renderBtn({text: "hola", testId: "t1"});
        fireEvent.click(screen.getByTestId("read-aloud-t1"));
        const utter = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
        expect(utter.rate).toBeCloseTo(1.25);
    });
});

// #3805: a network voice sends the text read aloud to its provider. Chrome's
// network voice "Google Deutsch" next to a local espeak-ng voice.
describe("ReadAloudButton voice choice (#3805)", () => {
    const googleDeutsch = {
        name: "Google Deutsch",
        lang: "de-DE",
        localService: false,
    } as SpeechSynthesisVoice;
    const espeakGerman = {
        name: "German espeak-ng",
        lang: "de",
        localService: true,
    } as SpeechSynthesisVoice;

    /** Click the button once the voice list has loaded; return the voice
     *  the utterance was given. */
    async function voiceSpokenWith(): Promise<SpeechSynthesisVoice | null> {
        const {speak} = setMockSynth([googleDeutsch, espeakGerman]);
        renderBtn({text: "Hallo Welt", lang: "de-DE", testId: "t1"});
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        fireEvent.click(screen.getByTestId("read-aloud-t1"));
        const utter = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
        return utter.voice;
    }

    it("speaks with the local voice when a network voice for the language is listed first", async () => {
        expect(await voiceSpokenWith()).toBe(espeakGerman);
    });

    it("keeps the voice the learner chose in Settings, even a network voice", async () => {
        localStorage.setItem(VOICE_PREF_KEYS.voiceName, "Google Deutsch");
        expect(await voiceSpokenWith()).toBe(googleDeutsch);
    });

    it("falls back to the local-first pick when the chosen voice is no longer offered", async () => {
        localStorage.setItem(VOICE_PREF_KEYS.voiceName, "Microsoft Hedda");
        expect(await voiceSpokenWith()).toBe(espeakGerman);
    });
});
