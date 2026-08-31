/**
 * Pure-helper tests for the MediaRecorder wrapper (engine#68 idea 3:
 * speak-and-record).
 *
 * happy-dom doesn't ship MediaRecorder/getUserMedia. We mount mocks on
 * ``navigator``/``window`` so the start/stop/auto-stop path can be
 * exercised end-to-end without a real browser or microphone, mirroring
 * ``speech-recognition.test.ts``'s approach for the Web Speech API.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
    blobToBase64,
    isMediaRecordingSupported,
    startRecording,
    MAX_RECORDING_DURATION_MS,
} from "./audio-recording";

interface MockTrack {
    stop: ReturnType<typeof vi.fn>;
}

interface MockStream {
    getTracks: () => MockTrack[];
}

interface MockRecorderInstance {
    state: "recording" | "inactive";
    ondataavailable: ((event: {data: {size: number}}) => void) | null;
    onstop: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
}

const instances: MockRecorderInstance[] = [];
const tracks: MockTrack[] = [];
const constructorOptions: MediaRecorderOptions[] = [];
let typeSupported = true;
let nextStartThrows = false;

function mountMediaRecorder(): void {
    instances.length = 0;
    tracks.length = 0;
    constructorOptions.length = 0;
    typeSupported = true;
    nextStartThrows = false;

    class MockMediaRecorder {
        state: "recording" | "inactive" = "recording";
        ondataavailable: ((event: {data: {size: number}}) => void) | null = null;
        onstop: (() => void) | null = null;
        start = vi.fn(() => {
            if (nextStartThrows) throw new Error("start-failed");
        });
        stop = vi.fn(() => {
            this.state = "inactive";
            this.ondataavailable?.({data: {size: 3}});
            this.onstop?.();
        });
        constructor(_stream: unknown, options: MediaRecorderOptions = {}) {
            constructorOptions.push(options);
            instances.push(this as unknown as MockRecorderInstance);
        }
        static isTypeSupported(): boolean {
            return typeSupported;
        }
    }

    (window as unknown as {MediaRecorder: unknown}).MediaRecorder = MockMediaRecorder;
}

function mountGetUserMedia(
    resolve: MockStream | null,
    rejectName: string | null = null,
): ReturnType<typeof vi.fn> {
    const track: MockTrack = {stop: vi.fn()};
    tracks.push(track);
    const stream: MockStream = resolve ?? {getTracks: () => [track]};
    const fn = vi.fn(() =>
        rejectName
            ? Promise.reject(Object.assign(new Error(rejectName), {name: rejectName}))
            : Promise.resolve(stream),
    );
    (navigator as unknown as {mediaDevices: {getUserMedia: unknown}}).mediaDevices = {
        getUserMedia: fn,
    };
    return fn;
}

function unmount(): void {
    delete (window as unknown as Record<string, unknown>).MediaRecorder;
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
}

beforeEach(() => {
    unmount();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("isMediaRecordingSupported", () => {
    it("returns false when neither API is present", () => {
        expect(isMediaRecordingSupported()).toBe(false);
    });

    it("returns true when both MediaRecorder and getUserMedia exist", () => {
        mountMediaRecorder();
        mountGetUserMedia(null);
        expect(isMediaRecordingSupported()).toBe(true);
    });

    it("returns false when only one of the two exists", () => {
        mountMediaRecorder();
        expect(isMediaRecordingSupported()).toBe(false);
    });
});

describe("startRecording()", () => {
    it("returns null when the API is unsupported", async () => {
        const handle = await startRecording({});
        expect(handle).toBeNull();
    });

    it("requests the microphone and starts the recorder", async () => {
        mountMediaRecorder();
        const getUserMedia = mountGetUserMedia(null);
        const handle = await startRecording({});
        expect(handle).not.toBeNull();
        expect(getUserMedia).toHaveBeenCalledWith({audio: true});
        expect(instances).toHaveLength(1);
        expect(instances[0].start).toHaveBeenCalled();
    });

    it("maps a permission-denied getUserMedia rejection to not-allowed", async () => {
        mountMediaRecorder();
        mountGetUserMedia(null, "NotAllowedError");
        const onError = vi.fn();
        const handle = await startRecording({onError});
        expect(handle).toBeNull();
        expect(onError).toHaveBeenCalledWith("not-allowed");
    });

    it("maps a no-device getUserMedia rejection to no-device", async () => {
        mountMediaRecorder();
        mountGetUserMedia(null, "NotFoundError");
        const onError = vi.fn();
        const handle = await startRecording({onError});
        expect(handle).toBeNull();
        expect(onError).toHaveBeenCalledWith("no-device");
    });

    it("fires onStop with the captured clip on handle.stop()", async () => {
        mountMediaRecorder();
        mountGetUserMedia(null);
        const onStop = vi.fn();
        const handle = await startRecording({onStop});
        handle!.stop();
        expect(onStop).toHaveBeenCalledTimes(1);
        const clip = onStop.mock.calls[0][0];
        expect(clip.blob).toBeInstanceOf(Blob);
        expect(clip.mimeType).toBe("audio/webm;codecs=opus");
        expect(typeof clip.durationMs).toBe("number");
    });

    it("stops every microphone track when the recording stops", async () => {
        mountMediaRecorder();
        mountGetUserMedia(null);
        const handle = await startRecording({});
        handle!.stop();
        expect(tracks[0].stop).toHaveBeenCalled();
    });

    it("falls back to a generic mime type when the preferred one is unsupported", async () => {
        mountMediaRecorder();
        typeSupported = false;
        mountGetUserMedia(null);
        const onStop = vi.fn();
        const handle = await startRecording({onStop});
        handle!.stop();
        expect(onStop.mock.calls[0][0].mimeType).toBe("audio/webm");
    });

    it("requests a voice-optimized bitrate, not the browser default (storage footprint)", async () => {
        mountMediaRecorder();
        mountGetUserMedia(null);
        await startRecording({});
        expect(constructorOptions[0].audioBitsPerSecond).toBe(24_000);
    });

    it("still requests the voice-optimized bitrate when the preferred mime type is unsupported", async () => {
        mountMediaRecorder();
        typeSupported = false;
        mountGetUserMedia(null);
        await startRecording({});
        expect(constructorOptions[0].audioBitsPerSecond).toBe(24_000);
        expect(constructorOptions[0].mimeType).toBeUndefined();
    });

    it("auto-stops at MAX_RECORDING_DURATION_MS", async () => {
        vi.useFakeTimers();
        mountMediaRecorder();
        mountGetUserMedia(null);
        const onStop = vi.fn();
        await startRecording({onStop});
        vi.advanceTimersByTime(MAX_RECORDING_DURATION_MS);
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it("does not double-stop an already-inactive recorder at the auto-stop cap", async () => {
        vi.useFakeTimers();
        mountMediaRecorder();
        mountGetUserMedia(null);
        const onStop = vi.fn();
        const handle = await startRecording({onStop});
        handle!.stop();
        vi.advanceTimersByTime(MAX_RECORDING_DURATION_MS);
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it("maps a MediaRecorder construction/start failure to start-failed", async () => {
        mountMediaRecorder();
        nextStartThrows = true;
        mountGetUserMedia(null);
        const onError = vi.fn();
        const handle = await startRecording({onError});
        expect(handle).toBeNull();
        expect(onError).toHaveBeenCalledWith("start-failed");
    });
});

describe("blobToBase64", () => {
    it("resolves to bare base64 with no data: prefix", async () => {
        const blob = new Blob(["hello"], {type: "audio/webm"});
        const encoded = await blobToBase64(blob);
        expect(encoded.startsWith("data:")).toBe(false);
        expect(encoded).toBe(btoa("hello"));
    });

    it("round-trips an empty blob to an empty string", async () => {
        const blob = new Blob([], {type: "audio/webm"});
        const encoded = await blobToBase64(blob);
        expect(encoded).toBe("");
    });
});
