/**
 * useReadAloud — the lesson read-aloud engine (TTS feature C1).
 *
 * A thin React layer over the existing voice lib
 * (``lib/voice/speech-synthesis`` + ``voicePref``) that the
 * Lesson viewer uses to read theory / prompts / answers aloud:
 *
 *   - resolves the voice from the user's saved preference name or,
 *     failing that, the closest match for the requested ``lang``
 *     (so a Spanish lesson speaks with a Spanish voice);
 *   - applies the user's saved rate/pitch PLUS an inline speed
 *     multiplier (0.5/0.75/1/1.25x) that is remembered across
 *     sessions;
 *   - exposes ``boundaryIndex`` (the charIndex of the word the
 *     engine is currently speaking) so a caller can highlight the
 *     text follow-along; and
 *   - tracks ``speaking`` + ``activeId`` so a caller can pulse the
 *     control that started playback and flip a Stop affordance.
 *
 * Inline per-text speaker buttons use the lighter
 * ``ReadAloudButton``; this hook is for the lesson-level engine
 * (theory highlight + auto-read).
 */

import {useCallback, useEffect, useRef, useState} from "react";

import {
    isSpeechSynthesisSupported,
    loadVoices,
    pause as pauseRaw,
    pickVoice,
    resume as resumeRaw,
    speak as speakRaw,
    stop as stopRaw,
} from "../../../lib/voice/speech-synthesis";
import {
    readVoicePrefs,
    writeLessonAutoRead as writeLessonAutoReadPref,
    writeLessonSpeed as writeLessonSpeedPref,
} from "../../../lib/voice/voicePref";

/** Inline speed multipliers offered during playback (C4). */
export const READ_ALOUD_SPEEDS = [0.5, 0.75, 1, 1.25] as const;
export type ReadAloudSpeed = (typeof READ_ALOUD_SPEEDS)[number];

const DEFAULT_SPEED: ReadAloudSpeed = 1;

function isSpeed(value: number): value is ReadAloudSpeed {
    return (READ_ALOUD_SPEEDS as readonly number[]).includes(value);
}

/** Last inline speed the learner chose; 1x default. Clamped to the
 *  offered set so a stale/garbage value can never break playback. Stored in
 *  the consolidated voice-prefs block (#893). */
export function readLessonSpeed(): ReadAloudSpeed {
    const raw = readVoicePrefs().lessonSpeed;
    return isSpeed(raw) ? raw : DEFAULT_SPEED;
}

export function writeLessonSpeed(speed: ReadAloudSpeed): void {
    writeLessonSpeedPref(speed);
}

/** Whether the lesson auto-reads each step on display (C3). Off by
 *  default — manual button clicks are the baseline. Stored in the
 *  consolidated voice-prefs block (#893). */
export function readLessonAutoRead(): boolean {
    return readVoicePrefs().lessonAutoRead;
}

export function writeLessonAutoRead(on: boolean): void {
    writeLessonAutoReadPref(on);
}

export interface SpeakRequest {
    /** BCP-47 language code for voice selection (e.g. "es", "fr-FR"). */
    lang?: string;
    /** Opaque id of the control that started playback so a caller can
     *  pulse exactly that button while others stay idle. */
    id?: string;
}

export interface ReadAloudController {
    /** Browser exposes speechSynthesis. */
    supported: boolean;
    /** Supported AND the user hasn't disabled TTS in Voice Settings. */
    enabled: boolean;
    /** A voice match exists for the most-recently requested lang. When
     *  false the caller can surface a "no voice for {language}" notice
     *  (playback still runs with the engine default). */
    voiceAvailable: boolean;
    speaking: boolean;
    /** True while a stream is paused (still "speaking" to the engine). */
    paused: boolean;
    /** The ``id`` passed to the active ``speak`` call (or null). */
    activeId: string | null;
    /** charIndex of the word the engine is currently speaking, or -1. */
    boundaryIndex: number;
    speed: ReadAloudSpeed;
    setSpeed: (speed: ReadAloudSpeed) => void;
    speak: (text: string, request?: SpeakRequest) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
}

export function useReadAloud(): ReadAloudController {
    const [supported] = useState(() => isSpeechSynthesisSupported());
    // Read once at mount: matches the existing SpeechButton contract
    // (a Settings change takes effect on the next lesson open).
    const enabledRef = useRef(supported && readVoicePrefs().ttsEnabled);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [speaking, setSpeaking] = useState(false);
    const [paused, setPaused] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [boundaryIndex, setBoundaryIndex] = useState(-1);
    const [voiceAvailable, setVoiceAvailable] = useState(true);
    const [speed, setSpeedState] = useState<ReadAloudSpeed>(() =>
        readLessonSpeed(),
    );
    // Speed + speaking are mirrored into refs so ``setSpeed`` can read
    // the live value and re-speak the current text immediately (the
    // Web Speech API can't change an in-flight utterance's rate).
    const speedRef = useRef(speed);
    const speakingRef = useRef(false);
    const lastRef = useRef<{text: string; request?: SpeakRequest} | null>(
        null,
    );

    useEffect(() => {
        if (!supported) return;
        let cancelled = false;
        loadVoices().then((vs) => {
            if (!cancelled) setVoices(vs);
        });
        return () => {
            cancelled = true;
        };
    }, [supported]);

    // Stop any in-flight speech when the consumer unmounts (navigating
    // away from the lesson must not keep talking).
    useEffect(() => {
        return () => stopRaw();
    }, []);

    const reset = useCallback(() => {
        speakingRef.current = false;
        setSpeaking(false);
        setPaused(false);
        setActiveId(null);
        setBoundaryIndex(-1);
    }, []);

    const speak = useCallback(
        (text: string, request?: SpeakRequest) => {
            if (!supported || !enabledRef.current || !text.trim()) return;
            const prefs = readVoicePrefs();
            const lang = request?.lang || "en";
            const named =
                prefs.ttsVoiceName.length > 0
                    ? (voices.find((v) => v.name === prefs.ttsVoiceName) ?? null)
                    : null;
            const matched = named ?? pickVoice(voices, lang);
            // "Unavailable" only when we have a voice list loaded yet
            // nothing matched the requested language (and the user
            // didn't pin a named voice).
            setVoiceAvailable(
                named !== null || voices.length === 0 || matched !== null,
            );
            lastRef.current = {text, request};
            speakingRef.current = true;
            setSpeaking(true);
            setPaused(false);
            setActiveId(request?.id ?? null);
            setBoundaryIndex(-1);
            speakRaw(text, {
                lang,
                voice: matched,
                // Inline speed multiplies the saved rate; speak() clamps
                // the product to [0.5, 2.0]. Read from the ref so a
                // speed change mid-playback uses the latest value.
                rate: prefs.ttsRate * speedRef.current,
                pitch: prefs.ttsPitch,
                onBoundary: (event) => {
                    if (event.name === "word") {
                        setBoundaryIndex(event.charIndex);
                    }
                },
                onEnd: reset,
                onError: reset,
            });
        },
        [supported, voices, reset],
    );

    const setSpeed = useCallback(
        (next: ReadAloudSpeed) => {
            speedRef.current = next;
            setSpeedState(next);
            writeLessonSpeed(next);
            // If a stream is currently playing, restart it from the top
            // at the new rate (the API has no live rate change).
            if (speakingRef.current && lastRef.current) {
                speak(lastRef.current.text, lastRef.current.request);
            }
        },
        [speak],
    );

    const pause = useCallback(() => {
        if (!speakingRef.current) return;
        pauseRaw();
        setPaused(true);
    }, []);

    const resume = useCallback(() => {
        resumeRaw();
        setPaused(false);
    }, []);

    const stop = useCallback(() => {
        stopRaw();
        lastRef.current = null;
        reset();
    }, [reset]);

    return {
        supported,
        enabled: supported && enabledRef.current,
        voiceAvailable,
        speaking,
        paused,
        activeId,
        boundaryIndex,
        speed,
        setSpeed,
        speak,
        pause,
        resume,
        stop,
    };
}
