/**
 * MediaRecorder wrapper (engine#68 idea 3: speak-and-record).
 *
 * Thin abstraction over ``getUserMedia`` + ``MediaRecorder``, mirroring
 * ``speech-recognition.ts``'s shape: a support gate, a callback-driven
 * start returning a stop handle, error mapped to a friendly code rather
 * than a raw exception.
 *
 * Unlike the Web Speech wrapper this one is genuinely new - there was no
 * MediaRecorder/getUserMedia usage anywhere in the app before this
 * feature, and it stores a data kind nothing here has stored before:
 * audio, orders of magnitude larger per row than the progress/error rows
 * every other exercise type writes. Two controls keep the footprint
 * predictable rather than open-ended:
 *
 * - A hard length cap (``MAX_RECORDING_DURATION_MS``) auto-stops the
 *   recording. There is no existing size-cap precedent for user-recorded
 *   media to reuse (the closest, ``UserSettings.avatar``, caps a resized
 *   image client-side before upload), so this wrapper caps by DURATION
 *   rather than by byte count - simpler to reason about for a live
 *   capture.
 * - An explicit voice-optimized bitrate (``audioBitsPerSecond``, NOT the
 *   browser default): left unset, Chromium's default opus bitrate runs
 *   roughly 128kbps, which turns a 30s clip into a ~625KB base64 string.
 *   At 24kbps, the same 30s clip is under ~120KB - about 5x smaller,
 *   still clearly intelligible speech. This matters twice over: the clip
 *   is stored client-side (mobile browsers evict IndexedDB data under
 *   storage pressure, and a multi-hundred-KB-per-clip footprint invites
 *   that sooner than a few-KB progress row would), and it is included in
 *   every full backup/sync export, where several undersized clips would
 *   otherwise inflate every backup a user takes.
 *
 * Callers should gate UI on ``isMediaRecordingSupported()`` and hide the
 * record button entirely when false.
 */

/** Longest a single recording may run before auto-stopping (engine#68
 *  idea 3 - no existing byte-size cap to reuse, so the control is
 *  duration-based). */
export const MAX_RECORDING_DURATION_MS = 30_000;

/** The mime type requested from ``MediaRecorder``. Opus in a WebM
 *  container: broad browser support, small clips at low bitrate. */
const PREFERRED_MIME_TYPE = "audio/webm;codecs=opus";

function getMediaRecorderCtor(): typeof MediaRecorder | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {MediaRecorder?: typeof MediaRecorder};
    return w.MediaRecorder ?? null;
}

function getUserMediaFn(): typeof navigator.mediaDevices.getUserMedia | null {
    if (typeof navigator === "undefined") return null;
    return navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ?? null;
}

/** Whether the browser exposes both ``getUserMedia`` and
 *  ``MediaRecorder``. Gate record-button UI on this and hide the
 *  affordance entirely when false. */
export function isMediaRecordingSupported(): boolean {
    return getMediaRecorderCtor() !== null && getUserMediaFn() !== null;
}

export interface RecordingHandlers {
    /** Fires once the recording stops (explicit stop, auto-stop at the
     *  duration cap, or the underlying recorder's own end) with the
     *  captured clip and its measured duration. */
    onStop?: (clip: {blob: Blob; mimeType: string; durationMs: number}) => void;
    /** Microphone permission denied, no device, or any other capture
     *  failure. Mapped to a short code, never the raw browser error. */
    onError?: (code: "not-allowed" | "no-device" | "start-failed") => void;
}

export interface RecordingHandle {
    /** Stop early and fire ``onStop`` with the clip captured so far. */
    stop: () => void;
}

/**
 * Request microphone access and start recording. Resolves to a handle for
 * ``stop()``, or ``null`` when the browser doesn't support the API or the
 * user denies microphone permission (``onError`` fires first in that
 * case). Auto-stops at {@link MAX_RECORDING_DURATION_MS}.
 */
export async function startRecording(
    options: RecordingHandlers = {},
): Promise<RecordingHandle | null> {
    const Ctor = getMediaRecorderCtor();
    const getUserMedia = getUserMediaFn();
    if (Ctor === null || getUserMedia === null) return null;

    let stream: MediaStream;
    try {
        stream = await getUserMedia({audio: true});
    } catch (err) {
        const name = err instanceof Error ? err.name : "";
        options.onError?.(
            name === "NotFoundError" || name === "DevicesNotFoundError"
                ? "no-device"
                : "not-allowed",
        );
        return null;
    }

    const mimeType = Ctor.isTypeSupported?.(PREFERRED_MIME_TYPE)
        ? PREFERRED_MIME_TYPE
        : "";
    const chunks: BlobPart[] = [];
    const startedAt = Date.now();
    let stopTimer: ReturnType<typeof setTimeout> | null = null;

    // Voice-optimized bitrate, NOT the browser default: left unset, Chromium's
    // default opus bitrate runs ~128kbps, which turns a 30s clip into a
    // ~470KB blob (~625KB once base64-encoded for storage) - four to five
    // times larger than needed for spoken-word clarity, and this is stored
    // client-side (mobile IndexedDB quota, subject to eviction under
    // pressure) as well as carried in every full backup export. 24kbps opus
    // keeps a 30s clip's base64 form under ~120KB while staying clearly
    // intelligible for speech.
    const recorderOptions: MediaRecorderOptions = {audioBitsPerSecond: 24_000};
    if (mimeType) recorderOptions.mimeType = mimeType;

    let recorder: MediaRecorder;
    try {
        recorder = new Ctor(stream, recorderOptions);
    } catch {
        for (const track of stream.getTracks()) track.stop();
        options.onError?.("start-failed");
        return null;
    }

    recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
        if (stopTimer !== null) clearTimeout(stopTimer);
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunks, {type: mimeType || "audio/webm"});
        options.onStop?.({
            blob,
            mimeType: mimeType || "audio/webm",
            durationMs: Date.now() - startedAt,
        });
    };

    try {
        recorder.start();
    } catch {
        for (const track of stream.getTracks()) track.stop();
        options.onError?.("start-failed");
        return null;
    }

    stopTimer = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
    }, MAX_RECORDING_DURATION_MS);

    return {
        stop: () => {
            if (recorder.state !== "inactive") recorder.stop();
        },
    };
}

/**
 * Encode a recorded clip's ``Blob`` to bare base64 (no ``data:...;base64,``
 * prefix - the mime type already travels as its own column/field
 * everywhere this is stored, so embedding it a second time inside the
 * string would be a duplicate source of truth).
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("audio-recording: unreadable clip"));
                return;
            }
            const comma = result.indexOf(",");
            resolve(comma === -1 ? result : result.slice(comma + 1));
        };
        reader.onerror = () => reject(new Error("audio-recording: unreadable clip"));
        reader.readAsDataURL(blob);
    });
}
