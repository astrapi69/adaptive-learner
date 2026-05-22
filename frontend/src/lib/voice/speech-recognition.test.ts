/**
 * Pure-helper tests for the STT wrapper (Phase 31B).
 *
 * happy-dom doesn't ship SpeechRecognition. We mount a mock
 * constructor on ``window`` so the start/stop/abort path can
 * be exercised end-to-end without a real browser.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    isSpeechRecognitionSupported,
    start as startRecognition,
} from "./speech-recognition";

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

function mountMockRecognition(): typeof instances {
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
    return instances;
}

function unmount(): void {
    const w = (globalThis as unknown as {window: typeof window}).window;
    if (w) {
        delete (w as unknown as Record<string, unknown>).SpeechRecognition;
        delete (w as unknown as Record<string, unknown>).webkitSpeechRecognition;
    }
}

function makeResultEvent(
    results: Array<{transcript: string; isFinal: boolean}>,
    resultIndex = 0,
): unknown {
    return {
        resultIndex,
        results: results.map((r) => {
            const item = [{transcript: r.transcript}];
            (item as unknown as {isFinal: boolean}).isFinal = r.isFinal;
            return item;
        }),
    };
}

beforeEach(() => {
    unmount();
});

describe("isSpeechRecognitionSupported", () => {
    it("returns false when neither global is present", () => {
        expect(isSpeechRecognitionSupported()).toBe(false);
    });

    it("returns true when the vendor-prefixed global exists", () => {
        mountMockRecognition();
        expect(isSpeechRecognitionSupported()).toBe(true);
    });
});

describe("start()", () => {
    it("returns null when SpeechRecognition is unavailable", () => {
        const handle = startRecognition({lang: "en-US"});
        expect(handle).toBeNull();
    });

    it("returns a handle when start succeeds + invokes .start()", () => {
        mountMockRecognition();
        const handle = startRecognition({lang: "es-ES"});
        expect(handle).not.toBeNull();
        expect(instances).toHaveLength(1);
        expect(instances[0].lang).toBe("es-ES");
        expect(instances[0].start).toHaveBeenCalled();
    });

    it("fires onInterim for non-final results", () => {
        mountMockRecognition();
        const onInterim = vi.fn();
        startRecognition({onInterim});
        instances[0].onresult?.(
            makeResultEvent([{transcript: "Hola", isFinal: false}]),
        );
        expect(onInterim).toHaveBeenCalledWith("Hola");
    });

    it("fires onFinal for final results", () => {
        mountMockRecognition();
        const onFinal = vi.fn();
        startRecognition({onFinal});
        instances[0].onresult?.(
            makeResultEvent([{transcript: "Hola mundo", isFinal: true}]),
        );
        expect(onFinal).toHaveBeenCalledWith("Hola mundo");
    });

    it("fires onError with the event's error code", () => {
        mountMockRecognition();
        const onError = vi.fn();
        startRecognition({onError});
        instances[0].onerror?.({error: "not-allowed"});
        expect(onError).toHaveBeenCalledWith("not-allowed");
    });

    it("handles missing error code gracefully", () => {
        mountMockRecognition();
        const onError = vi.fn();
        startRecognition({onError});
        instances[0].onerror?.({});
        expect(onError).toHaveBeenCalledWith("unknown");
    });

    it("fires onEnd when recognition stops", () => {
        mountMockRecognition();
        const onEnd = vi.fn();
        startRecognition({onEnd});
        instances[0].onend?.();
        expect(onEnd).toHaveBeenCalled();
    });

    it("handle.stop() forwards to recognition.stop", () => {
        mountMockRecognition();
        const h = startRecognition({});
        h!.stop();
        expect(instances[0].stop).toHaveBeenCalled();
    });

    it("handle.abort() forwards to recognition.abort", () => {
        mountMockRecognition();
        const h = startRecognition({});
        h!.abort();
        expect(instances[0].abort).toHaveBeenCalled();
    });

    it("stop/abort are idempotent when recognition.stop throws", () => {
        mountMockRecognition();
        const h = startRecognition({});
        instances[0].stop.mockImplementation(() => {
            throw new Error("already-stopped");
        });
        expect(() => h!.stop()).not.toThrow();
        instances[0].abort.mockImplementation(() => {
            throw new Error("already-aborted");
        });
        expect(() => h!.abort()).not.toThrow();
    });

    it("if .start() throws (Safari double-start), onError + onEnd fire", () => {
        // Mount, then make the next .start() throw.
        mountMockRecognition();
        // Patch the constructor so the next instance's start
        // throws synchronously inside the wrapper.
        const w = (globalThis as unknown as {
            window: {SpeechRecognition: new () => MockRec};
        }).window;
        const ThrowingCtor = class {
            lang = "en-US";
            continuous = false;
            interimResults = true;
            maxAlternatives = 1;
            onresult = null;
            onerror = null;
            onend = null;
            stop = vi.fn();
            abort = vi.fn();
            start() {
                throw new Error("already-running");
            }
        };
        w.SpeechRecognition = ThrowingCtor as unknown as new () => MockRec;
        const onError = vi.fn();
        const onEnd = vi.fn();
        const h = startRecognition({onError, onEnd});
        expect(h).toBeNull();
        expect(onError).toHaveBeenCalledWith("already-running");
        expect(onEnd).toHaveBeenCalled();
    });
});
