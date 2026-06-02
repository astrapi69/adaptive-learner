/**
 * Web Speech API — TTS wrapper (Phase 31A / v1.18.0).
 *
 * Thin abstraction over ``window.speechSynthesis`` so the
 * SpeechButton component doesn't have to know about the
 * browser's quirks:
 *
 * - **Voice loading is async.** On Chrome/Edge, ``getVoices()``
 *   returns ``[]`` synchronously on first call. The full list
 *   arrives via the ``voiceschanged`` event. ``loadVoices()``
 *   handles both paths.
 * - **No native pause on iOS Safari.** ``pause()`` is a no-op
 *   there; the button falls back to stop + re-speak from the
 *   beginning. We detect this at call time, not feature-check
 *   time, because Safari lies about supporting pause.
 * - **Voice selection.** Match by exact ``lang`` first ("en-US"
 *   for an "en-US" learner), then by lang prefix ("en" matches
 *   any "en-*"), then default voice. Returns ``null`` if the
 *   browser has no voices at all.
 *
 * All functions are safe to call when the browser has no
 * SpeechSynthesis support — they short-circuit. Callers should
 * still gate the UI on ``isSpeechSynthesisSupported()`` so the
 * button doesn't render at all.
 */

export function isSpeechSynthesisSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.speechSynthesis !== "undefined"
    );
}

/**
 * Load the browser's voice list. Resolves immediately when
 * voices are already available; otherwise waits for the
 * ``voiceschanged`` event (with a 2-second timeout so the
 * caller never hangs forever on a broken browser).
 */
export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!isSpeechSynthesisSupported()) return [];
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (voices.length > 0) return voices;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            synth.removeEventListener("voiceschanged", handler);
            resolve(synth.getVoices());
        }, 2000);
        const handler = () => {
            voices = synth.getVoices();
            if (voices.length > 0) {
                clearTimeout(timer);
                synth.removeEventListener("voiceschanged", handler);
                resolve(voices);
            }
        };
        synth.addEventListener("voiceschanged", handler);
    });
}

/**
 * Pick the best available voice for the given BCP-47 language
 * code. Returns ``null`` if no voice matches (caller should
 * fall back to the browser default by passing ``null`` to
 * ``speak``'s utterance).
 */
export function pickVoice(
    voices: SpeechSynthesisVoice[],
    lang: string,
): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;
    // Exact match (e.g. "en-US" === "en-US").
    const exact = voices.find(
        (v) => v.lang.toLowerCase() === lang.toLowerCase(),
    );
    if (exact) return exact;
    // Prefix match (e.g. lang "en" matches "en-US", "en-GB", ...).
    const prefix = lang.split("-")[0].toLowerCase();
    const partial = voices.find((v) =>
        v.lang.toLowerCase().startsWith(prefix + "-"),
    );
    if (partial) return partial;
    // Same prefix without a region suffix ("en" voice).
    const bare = voices.find((v) => v.lang.toLowerCase() === prefix);
    if (bare) return bare;
    return null;
}

export interface SpeakOptions {
    /** BCP-47 language code (e.g. "de", "en-US"). Defaults to
     *  whatever the document is in. */
    lang?: string;
    /** 0.5 = half-speed, 2.0 = double. Default 1.0. */
    rate?: number;
    /** 0.5..2.0; default 1.0. */
    pitch?: number;
    /** Explicit voice override; takes precedence over ``lang``. */
    voice?: SpeechSynthesisVoice | null;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: SpeechSynthesisErrorEvent) => void;
    /** Fired as the engine crosses word/sentence boundaries.
     *  Used by the lesson read-aloud highlight to follow along
     *  (``event.charIndex`` locates the current token in ``text``).
     *  Not all browsers/voices emit boundary events. */
    onBoundary?: (event: SpeechSynthesisEvent) => void;
}

/**
 * Speak ``text`` aloud. Stops any prior utterance first to
 * guarantee a single playing stream — most browsers queue
 * additional ``speak()`` calls which produces overlap when
 * the user clicks twice on the same button.
 *
 * Returns the utterance handle so the caller can pause/cancel it.
 */
export function speak(
    text: string,
    options: SpeakOptions = {},
): SpeechSynthesisUtterance | null {
    if (!isSpeechSynthesisSupported() || !text.trim()) return null;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (options.voice) utter.voice = options.voice;
    if (options.lang) utter.lang = options.lang;
    if (options.rate !== undefined)
        utter.rate = Math.max(0.5, Math.min(2.0, options.rate));
    if (options.pitch !== undefined)
        utter.pitch = Math.max(0.5, Math.min(2.0, options.pitch));
    if (options.onStart) utter.onstart = options.onStart;
    if (options.onEnd) utter.onend = options.onEnd;
    if (options.onError) utter.onerror = options.onError;
    if (options.onBoundary) utter.onboundary = options.onBoundary;
    synth.speak(utter);
    return utter;
}

/** Pause the currently-speaking utterance. No-op on iOS Safari. */
export function pause(): void {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.pause();
}

/** Resume after pause. */
export function resume(): void {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.resume();
}

/** Cancel the queue + the currently-speaking utterance. */
export function stop(): void {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
}

/** ``true`` iff something is mid-speech (or paused). */
export function isSpeaking(): boolean {
    if (!isSpeechSynthesisSupported()) return false;
    return (
        window.speechSynthesis.speaking || window.speechSynthesis.pending
    );
}
