/**
 * SpeechButton tests (Phase 31A).
 *
 * Covers the two visibility gates (no support → no render,
 * pref off → no render) and the click toggle.
 */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../../hooks/ui/useI18n";
import {VOICE_PREF_KEYS} from "../../lib/voice/voicePref";

import SpeechButton from "./SpeechButton";

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

beforeEach(() => {
    localStorage.clear();
    unsetSynth();
});

describe("SpeechButton visibility gates", () => {
    it("renders nothing when speechSynthesis is unavailable", () => {
        // Default window has no synthesis (we just unset it).
        const {container} = render(
            <I18nProvider>
                <SpeechButton text="hello" />
            </I18nProvider>,
        );
        expect(container.querySelector('[data-testid="speech-button"]')).toBeNull();
    });

    it("renders nothing when TTS is disabled in Settings", () => {
        setMockSynth();
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "false");
        const {container} = render(
            <I18nProvider>
                <SpeechButton text="hello" />
            </I18nProvider>,
        );
        expect(container.querySelector('[data-testid="speech-button"]')).toBeNull();
    });

    it("renders the button when supported + enabled", () => {
        setMockSynth();
        render(
            <I18nProvider>
                <SpeechButton text="hello" testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("speech-button-t1");
        expect(btn).toBeTruthy();
        expect(btn.getAttribute("data-speaking")).toBe("false");
    });
});

describe("SpeechButton click", () => {
    it("calls speechSynthesis.speak with the message text", () => {
        const {speak} = setMockSynth();
        render(
            <I18nProvider>
                <SpeechButton text="hello world" testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("speech-button-t1");
        fireEvent.click(btn);
        expect(speak).toHaveBeenCalledTimes(1);
        // The first arg is a SpeechSynthesisUtterance carrying
        // the text.
        const utter = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
        expect(utter.text).toBe("hello world");
    });

    it("flips data-speaking after click + back after a second click (stop)", () => {
        const {cancel} = setMockSynth();
        render(
            <I18nProvider>
                <SpeechButton text="hello" testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("speech-button-t1");
        fireEvent.click(btn);
        expect(btn.getAttribute("data-speaking")).toBe("true");
        fireEvent.click(btn);
        expect(btn.getAttribute("data-speaking")).toBe("false");
        // First click cancels prior + queues; second click cancels.
        expect(cancel).toHaveBeenCalled();
    });
});

// #3805: a network voice sends the text read aloud to its provider. Chrome's
// network voice "Google Deutsch" next to a local espeak-ng voice.
describe("SpeechButton voice choice (#3805)", () => {
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
        render(
            <I18nProvider>
                <SpeechButton text="Hallo Welt" lang="de-DE" testId="t1" />
            </I18nProvider>,
        );
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        fireEvent.click(screen.getByTestId("speech-button-t1"));
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
