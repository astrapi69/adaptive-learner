/**
 * MicButton render tests (Phase 31B).
 *
 * Covers the visibility gates (unsupported / disabled →
 * nothing renders) + the click-toggle path.
 */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../hooks/useI18n";
import {VOICE_PREF_KEYS} from "../lib/voice/voicePref";

const notifyError = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        error: (...args: unknown[]) => notifyError(...args),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

import MicButton from "./MicButton";

interface MockRec {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((ev: unknown) => void) | null;
    onerror: ((ev: unknown) => void) | null;
    onend: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
}

const instances: MockRec[] = [];

function mountRec(): void {
    instances.length = 0;
    class Ctor {
        lang = "en-US";
        continuous = false;
        interimResults = true;
        maxAlternatives = 1;
        onresult: ((ev: unknown) => void) | null = null;
        onerror: ((ev: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start = vi.fn();
        stop = vi.fn();
        abort = vi.fn();
        constructor() {
            instances.push(this as unknown as MockRec);
        }
    }
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        SpeechRecognition: Ctor as unknown,
        webkitSpeechRecognition: Ctor as unknown,
    } as unknown as Window & typeof globalThis;
}

function unmount(): void {
    const w = (globalThis as unknown as {window: typeof window}).window;
    if (w) {
        delete (w as unknown as Record<string, unknown>).SpeechRecognition;
        delete (w as unknown as Record<string, unknown>).webkitSpeechRecognition;
    }
}

beforeEach(() => {
    localStorage.clear();
    unmount();
    notifyError.mockReset();
});

describe("MicButton visibility gates", () => {
    it("renders nothing when SpeechRecognition is unavailable", () => {
        const {container} = render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} />
            </I18nProvider>,
        );
        expect(container.querySelector('[data-testid="mic-button"]')).toBeNull();
    });

    it("renders nothing when STT disabled in Settings", () => {
        mountRec();
        localStorage.setItem(VOICE_PREF_KEYS.sttEnabled, "false");
        const {container} = render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} />
            </I18nProvider>,
        );
        expect(container.querySelector('[data-testid="mic-button"]')).toBeNull();
    });

    it("renders when supported + enabled", () => {
        mountRec();
        render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        expect(screen.getByTestId("mic-button-t1")).toBeTruthy();
    });
});

describe("MicButton click toggle + transcript", () => {
    it("first click starts recognition + flips data-listening", () => {
        mountRec();
        render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("mic-button-t1");
        expect(btn.getAttribute("data-listening")).toBe("false");
        fireEvent.click(btn);
        expect(btn.getAttribute("data-listening")).toBe("true");
        expect(instances).toHaveLength(1);
        expect(instances[0].start).toHaveBeenCalled();
    });

    it("second click stops the recogniser", () => {
        mountRec();
        render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("mic-button-t1");
        fireEvent.click(btn);
        fireEvent.click(btn);
        expect(instances[0].stop).toHaveBeenCalled();
    });

    it("forwards interim + final transcripts to onTranscript", () => {
        mountRec();
        const onTranscript = vi.fn();
        render(
            <I18nProvider>
                <MicButton onTranscript={onTranscript} testId="t1" />
            </I18nProvider>,
        );
        fireEvent.click(screen.getByTestId("mic-button-t1"));
        // Interim
        instances[0].onresult?.({
            resultIndex: 0,
            results: [
                Object.assign(
                    [{transcript: "Hola"}],
                    {isFinal: false},
                ),
            ],
        });
        expect(onTranscript).toHaveBeenCalledWith("Hola", false);
        // Final
        instances[0].onresult?.({
            resultIndex: 0,
            results: [
                Object.assign(
                    [{transcript: "Hola mundo"}],
                    {isFinal: true},
                ),
            ],
        });
        expect(onTranscript).toHaveBeenCalledWith("Hola mundo", true);
    });

    it("shows a friendly message for audio-capture (no raw error code)", () => {
        mountRec();
        render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        fireEvent.click(screen.getByTestId("mic-button-t1"));
        act(() => {
            instances[0].onerror?.({error: "audio-capture"});
        });
        expect(notifyError).toHaveBeenCalledTimes(1);
        const msg = String(notifyError.mock.calls[0][0]);
        // Friendly, and never the raw Web Speech error code.
        expect(msg).not.toContain("audio-capture");
        expect(msg.length).toBeGreaterThan(0);
    });

    it("stays silent on benign no-speech / aborted errors", () => {
        mountRec();
        render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        fireEvent.click(screen.getByTestId("mic-button-t1"));
        act(() => {
            instances[0].onerror?.({error: "no-speech"});
        });
        expect(notifyError).not.toHaveBeenCalled();
    });

    it("resets to idle when recogniser fires onend", () => {
        mountRec();
        const {getByTestId} = render(
            <I18nProvider>
                <MicButton onTranscript={() => {}} testId="t1" />
            </I18nProvider>,
        );
        const btn = getByTestId("mic-button-t1");
        fireEvent.click(btn);
        expect(btn.getAttribute("data-listening")).toBe("true");
        // Fire onend inside act() to flush the state update
        // synchronously (React 18 batches but act() drains the
        // pending work before returning).
        act(() => {
            instances[0].onend?.();
        });
        expect(
            getByTestId("mic-button-t1").getAttribute("data-listening"),
        ).toBe("false");
    });
});
