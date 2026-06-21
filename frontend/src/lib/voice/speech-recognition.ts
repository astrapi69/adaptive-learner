/**
 * Web Speech API — STT wrapper (Phase 31B / v1.18.0).
 *
 * Thin abstraction over ``webkitSpeechRecognition`` /
 * ``SpeechRecognition``. Three browser realities:
 *
 * - **Chrome / Edge** ship ``webkitSpeechRecognition`` and work
 *   well. The cloud backend handles transcription; an internet
 *   connection is required.
 * - **Firefox** does not implement the API at all.
 * - **Safari** ships the API but it's flaky + needs a user-
 *   gesture for each start.
 *
 * The wrapper exposes a tiny callback-driven recogniser:
 *   start({lang, onInterim, onFinal, onError, onEnd})
 *   stop()  // graceful — wait for the next final
 *   abort() // hard cancel — drop the in-flight transcription
 *
 * Callers should gate UI on ``isSpeechRecognitionSupported()``
 * and hide the mic button entirely when false.
 */

// The DOM lib doesn't ship a ``SpeechRecognition`` interface
// (it's a draft spec). We declare the minimal surface we use.
interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
}

/** The browser global, vendor-prefixed or not. */
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether the browser exposes the Web Speech recognition API. Gate
 *  mic UI on this and hide the affordance entirely when false. */
export function isSpeechRecognitionSupported(): boolean {
    return getRecognitionCtor() !== null;
}

export interface RecognitionHandlers {
    /** Interim transcript updated as the user speaks. */
    onInterim?: (text: string) => void;
    /** Final transcript when the recogniser commits a phrase. */
    onFinal?: (text: string) => void;
    /** Error code (e.g. ``"no-speech"``, ``"not-allowed"``). */
    onError?: (error: string) => void;
    /** Fires after the recogniser stops (terminal). */
    onEnd?: () => void;
}

export interface RecognitionHandle {
    /** Gracefully stop — let the recogniser finish the current
     *  phrase and emit a final. */
    stop: () => void;
    /** Hard-abort — drop the in-flight transcription. */
    abort: () => void;
}

export interface StartOptions extends RecognitionHandlers {
    /** BCP-47 language code. Defaults to ``"en-US"``. */
    lang?: string;
    /** Keep listening across pauses until ``stop()`` is called.
     *  Default ``false`` — emit one final and stop. */
    continuous?: boolean;
    /** Emit interim results as the user speaks (default ``true``). */
    interimResults?: boolean;
}

/**
 * Start recognition. Returns a handle for stop/abort, or
 * ``null`` when the browser doesn't support the API. The
 * caller MUST hold onto the handle — the recogniser keeps
 * listening until ``stop`` / ``abort`` / a final + non-
 * continuous mode.
 */
export function start(options: StartOptions = {}): RecognitionHandle | null {
    const Ctor = getRecognitionCtor();
    if (Ctor === null) return null;
    const rec = new Ctor();
    rec.lang = options.lang ?? "en-US";
    rec.continuous = options.continuous ?? false;
    rec.interimResults = options.interimResults ?? true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0]?.transcript ?? "";
            if (result.isFinal) {
                final += transcript;
            } else {
                interim += transcript;
            }
        }
        if (interim && options.onInterim) {
            options.onInterim(interim.trim());
        }
        if (final && options.onFinal) {
            options.onFinal(final.trim());
        }
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (options.onError) options.onError(event.error || "unknown");
    };
    rec.onend = () => {
        if (options.onEnd) options.onEnd();
    };

    try {
        rec.start();
    } catch (err) {
        // Safari throws when you call start() twice in quick
        // succession. The caller treats this as a soft failure.
        if (options.onError) {
            options.onError(
                err instanceof Error ? err.message : "start-failed",
            );
        }
        if (options.onEnd) options.onEnd();
        return null;
    }

    return {
        stop: () => {
            try {
                rec.stop();
            } catch {
                /* idempotent */
            }
        },
        abort: () => {
            try {
                rec.abort();
            } catch {
                /* idempotent */
            }
        },
    };
}
