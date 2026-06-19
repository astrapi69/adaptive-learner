/**
 * VoiceSettingsSection smoke tests (Phase 31D).
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../hooks/ui/useI18n";
import {VOICE_PREF_KEYS} from "../lib/voice/voicePref";

import VoiceSettingsSection from "./VoiceSettingsSection";

function mountTtsOnly(): void {
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        speechSynthesis: {
            getVoices: () => [],
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            speak: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            speaking: false,
            pending: false,
        } as unknown as SpeechSynthesis,
    } as unknown as Window & typeof globalThis;
}

function mountSttOnly(): void {
    class Ctor {
        start = vi.fn();
        stop = vi.fn();
        abort = vi.fn();
        lang = "";
        continuous = false;
        interimResults = true;
        maxAlternatives = 1;
        onresult = null;
        onerror = null;
        onend = null;
    }
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        webkitSpeechRecognition: Ctor as unknown,
    } as unknown as Window & typeof globalThis;
}

function unmountAll(): void {
    const w = (globalThis as unknown as {window: typeof window}).window;
    if (w) {
        delete (w as unknown as Record<string, unknown>).speechSynthesis;
        delete (w as unknown as Record<string, unknown>).SpeechRecognition;
        delete (w as unknown as Record<string, unknown>).webkitSpeechRecognition;
    }
}

beforeEach(() => {
    localStorage.clear();
    unmountAll();
});

describe("VoiceSettingsSection visibility", () => {
    it("renders nothing when neither TTS nor STT is supported", () => {
        const {container} = render(
            <I18nProvider>
                <VoiceSettingsSection />
            </I18nProvider>,
        );
        expect(
            container.querySelector('[data-testid="settings-section-voice"]'),
        ).toBeNull();
    });

    it("renders when only TTS is supported (Safari-ish)", () => {
        mountTtsOnly();
        render(
            <I18nProvider>
                <VoiceSettingsSection />
            </I18nProvider>,
        );
        expect(screen.getByTestId("settings-section-voice")).toBeTruthy();
        expect(screen.getByTestId("settings-tts-enabled")).toBeTruthy();
        // STT controls hidden.
        expect(screen.queryByTestId("settings-stt-enabled")).toBeNull();
    });

    it("renders when only STT is supported", () => {
        mountSttOnly();
        render(
            <I18nProvider>
                <VoiceSettingsSection />
            </I18nProvider>,
        );
        expect(screen.getByTestId("settings-section-voice")).toBeTruthy();
        expect(screen.getByTestId("settings-stt-enabled")).toBeTruthy();
        expect(screen.queryByTestId("settings-tts-enabled")).toBeNull();
    });
});

describe("VoiceSettingsSection toggles persist", () => {
    it("flipping TTS toggle writes localStorage", () => {
        mountTtsOnly();
        render(
            <I18nProvider>
                <VoiceSettingsSection />
            </I18nProvider>,
        );
        const checkbox = screen.getByTestId(
            "settings-tts-enabled",
        ) as HTMLInputElement;
        // Default is ON.
        expect(checkbox.checked).toBe(true);
        fireEvent.click(checkbox);
        expect(localStorage.getItem(VOICE_PREF_KEYS.ttsEnabled)).toBe(
            "false",
        );
    });

    it("rate slider clamps + persists", () => {
        mountTtsOnly();
        render(
            <I18nProvider>
                <VoiceSettingsSection />
            </I18nProvider>,
        );
        const slider = screen.getByTestId(
            "settings-tts-rate",
        ) as HTMLInputElement;
        fireEvent.change(slider, {target: {value: "1.75"}});
        expect(localStorage.getItem(VOICE_PREF_KEYS.rate)).toBe("1.75");
    });
});
