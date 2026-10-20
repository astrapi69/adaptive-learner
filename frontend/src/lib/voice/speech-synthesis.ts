/**
 * Web Speech API - TTS wrapper (Phase 31A / v1.18.0).
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
 * - **Voice selection.** A voice the learner chose in Settings
 *   wins while the browser still offers it. Otherwise local voices
 *   (``localService``) come first: a network voice sends the text
 *   being read to its provider (Chrome's "Google ..." voices send it
 *   to Google), so it is used only when no local voice matches the
 *   language (#3805). Within each group: exact ``lang`` first
 *   ("en-US" for an "en-US" learner), then by lang prefix ("en"
 *   matches any "en-*"), then the bare code. Returns ``null`` when
 *   no voice matches; the browser then uses its own default.
 * - **Voices arrive in batches.** Chrome on Linux with speech-dispatcher
 *   lists its network voices at once and adds the local voices about a
 *   second later, so the voice is resolved from the list the browser
 *   offers when speaking (``currentVoices``), not only from the list
 *   loaded at mount.
 *
 * All functions are safe to call when the browser has no
 * SpeechSynthesis support: they short-circuit. Callers should
 * still gate the UI on ``isSpeechSynthesisSupported()`` so the
 * button doesn't render at all.
 */

import {chunkText} from "./chunk-text";

/** Whether the browser exposes ``window.speechSynthesis``. Gate the
 *  read-aloud UI on this so the button never renders unsupported. */
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
 * The voices the browser offers right now, or ``loaded`` while that list
 * is still empty (Chrome answers ``[]`` until its first ``voiceschanged``).
 * Resolve the voice from this when speaking: Chrome adds voices in
 * batches, so a list loaded once at mount can lack the local voices that
 * arrived later (#3805, measured in Chrome 155 on Linux with
 * speech-dispatcher: the network voices at once, the local ones about a
 * second later).
 *
 * @example
 * const voice = resolveVoice(currentVoices(voicesLoadedAtMount), "de", "");
 */
export function currentVoices(
    loaded: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
    if (!isSpeechSynthesisSupported()) return loaded;
    const offered = window.speechSynthesis.getVoices();
    return offered.length > 0 ? offered : loaded;
}

/**
 * The voice to read with: the one the learner chose in Settings
 * (``preferredName``, "" for none) while the browser offers it, even a
 * network voice, because the learner picked it on purpose. Otherwise
 * {@link pickVoice}'s local-first pick for ``lang``. Returns ``null`` when
 * nothing matches.
 *
 * @example
 * resolveVoice(voices, "de", readVoicePrefs().ttsVoiceName);
 */
export function resolveVoice(
    voices: SpeechSynthesisVoice[],
    lang: string,
    preferredName: string,
): SpeechSynthesisVoice | null {
    const chosen = preferredName
        ? voices.find((v) => v.name === preferredName)
        : undefined;
    return chosen ?? pickVoice(voices, lang);
}

/**
 * Pick the best available voice for the given BCP-47 language
 * code, local voices first: a network voice (``localService`` not
 * ``true``) sends the text being read to its provider, so it is
 * picked only when no local voice matches the language (#3805).
 * Returns ``null`` if no voice matches (caller should fall back to
 * the browser default by passing ``null`` to ``speak``'s utterance).
 */
export function pickVoice(
    voices: SpeechSynthesisVoice[],
    lang: string,
): SpeechSynthesisVoice | null {
    const local = voices.filter((v) => v.localService === true);
    const network = voices.filter((v) => v.localService !== true);
    return matchLanguage(local, lang) ?? matchLanguage(network, lang);
}

/** The first voice matching ``lang``: exact code, then same language with
 *  any region, then the bare language code. ``null`` when none matches. */
function matchLanguage(
    voices: SpeechSynthesisVoice[],
    lang: string,
): SpeechSynthesisVoice | null {
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
    return voices.find((v) => v.lang.toLowerCase() === prefix) ?? null;
}

/** The part of a boundary event this module reports to callers. */
export interface SpeechBoundary {
    /** ``"word"`` or ``"sentence"``. */
    name: string;
    /** Position in the ORIGINAL text, chunk offsets already applied. */
    charIndex: number;
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
    /**
     * Fired as the engine crosses word/sentence boundaries. Not all
     * browsers/voices emit them. ``charIndex`` is in the
     * ORIGINAL text's coordinates even though the text is spoken in chunks
     * (#1928) — callers that map a position back onto their own content
     * (e.g. advancing to the next theory step) can rely on it directly.
     */
    onBoundary?: (event: SpeechBoundary) => void;
}

/**
 * Speak ``text`` aloud. Stops any prior utterance first to
 * guarantee a single playing stream — most browsers queue
 * additional ``speak()`` calls which produces overlap when
 * the user clicks twice on the same button.
 *
 * Long texts are spoken as a queue of chunked utterances (#1928) rather than
 * one long one, because iOS Safari silently stops a long utterance after
 * ~15 seconds. Callers see the same single start/end pair either way.
 *
 * Returns the FIRST utterance handle; pause/stop act on the engine, not on a
 * single utterance, so that handle is only informational.
 */
export function speak(
    text: string,
    options: SpeakOptions = {},
): SpeechSynthesisUtterance | null {
    if (!isSpeechSynthesisSupported() || !text.trim()) return null;
    const synth = window.speechSynthesis;
    synth.cancel();

    // #1928 — one utterance per chunk instead of one for the whole text: iOS
    // Safari silently stops a long utterance after ~15s, which cut a typical
    // theory run off after roughly a tenth of its content. The engine queues
    // the utterances itself, so speaking them in order plays as one stream.
    const chunks = chunkText(text);
    if (chunks.length === 0) return null;

    let first: SpeechSynthesisUtterance | null = null;
    chunks.forEach((chunk, index) => {
        const utter = new SpeechSynthesisUtterance(chunk.text);
        if (options.voice) utter.voice = options.voice;
        if (options.lang) utter.lang = options.lang;
        if (options.rate !== undefined)
            utter.rate = Math.max(0.5, Math.min(2.0, options.rate));
        if (options.pitch !== undefined)
            utter.pitch = Math.max(0.5, Math.min(2.0, options.pitch));
        // Start fires on the FIRST chunk, end/error only on the LAST, so a
        // caller still sees exactly one start and one end for the whole text.
        if (index === 0 && options.onStart) utter.onstart = options.onStart;
        if (index === chunks.length - 1) {
            if (options.onEnd) utter.onend = options.onEnd;
            if (options.onError) utter.onerror = options.onError;
        }
        // Boundary positions are reported in the ORIGINAL text's coordinates
        // by adding the chunk's offset — ``useLessonAutoRead`` maps that
        // charIndex onto a theory step, so a per-chunk index would advance the
        // lesson to the wrong step.
        if (options.onBoundary) {
            const {onBoundary} = options;
            utter.onboundary = (event) => {
                onBoundary({
                    name: event.name,
                    charIndex: event.charIndex + chunk.offset,
                });
            };
        }
        synth.speak(utter);
        if (index === 0) first = utter;
    });
    return first;
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
