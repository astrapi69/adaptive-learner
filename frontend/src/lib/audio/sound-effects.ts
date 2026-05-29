/**
 * Synthesized sound effects (EXP-008 / Phase 55F).
 *
 * Sounds are SUPPLEMENTARY - every piece of information they
 * convey is also visible. They are OFF by default; the user opts
 * in via Settings > Interface, never surprised by audio.
 *
 * Zero audio files: each effect is rendered at runtime into a
 * mono ``AudioBuffer`` from a small additive-synthesis recipe
 * (sine partials + a touch of noise), so there is no bundle or
 * network cost. The ``AudioContext`` is created lazily on the
 * first ``playSound`` call (which always happens inside a user
 * gesture - a button click or an answer submit), satisfying the
 * browser autoplay policy.
 *
 * The pure ``renderSamples`` is the unit-testable core; playback
 * routes it through a BufferSource -> GainNode (master volume)
 * -> destination.
 */

import {readSoundEnabled, readSoundVolume} from "../feedback/feedbackPref";

export type SoundName =
    | "correct_answer"
    | "wrong_answer"
    | "star_earned"
    | "confetti"
    | "badge_earned"
    | "level_up";

interface Tone {
    /** Frequency in Hz. Ignored for noise. */
    freq: number;
    /** Start offset within the effect, ms. */
    startMs: number;
    /** Tone duration, ms. */
    durMs: number;
    /** Per-tone amplitude 0..1 before the master volume. */
    gain: number;
    noise?: boolean;
}

interface Recipe {
    totalMs: number;
    tones: Tone[];
}

// Equal-temperament note frequencies used by the recipes.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const RECIPES: Record<SoundName, Recipe> = {
    // Short high "ding".
    correct_answer: {
        totalMs: 130,
        tones: [{freq: 880, startMs: 0, durMs: 110, gain: 0.5}],
    },
    // Short low "thud".
    wrong_answer: {
        totalMs: 100,
        tones: [{freq: 220, startMs: 0, durMs: 80, gain: 0.5}],
    },
    // Ascending three-note chime C5-E5-G5.
    star_earned: {
        totalMs: 260,
        tones: [
            {freq: C5, startMs: 0, durMs: 100, gain: 0.45},
            {freq: E5, startMs: 80, durMs: 100, gain: 0.45},
            {freq: G5, startMs: 160, durMs: 100, gain: 0.45},
        ],
    },
    // Brief, very quiet noise sparkle.
    confetti: {
        totalMs: 60,
        tones: [{freq: 0, startMs: 0, durMs: 50, gain: 0.12, noise: true}],
    },
    // Five ascending notes "jingle".
    badge_earned: {
        totalMs: 420,
        tones: [
            {freq: C5, startMs: 0, durMs: 90, gain: 0.4},
            {freq: D5, startMs: 80, durMs: 90, gain: 0.4},
            {freq: E5, startMs: 160, durMs: 90, gain: 0.4},
            {freq: G5, startMs: 240, durMs: 90, gain: 0.4},
            {freq: C6, startMs: 320, durMs: 100, gain: 0.45},
        ],
    },
    // Triumphant major triad (C-E-G together).
    level_up: {
        totalMs: 520,
        tones: [
            {freq: C5, startMs: 0, durMs: 500, gain: 0.32},
            {freq: E5, startMs: 0, durMs: 500, gain: 0.32},
            {freq: G5, startMs: 0, durMs: 500, gain: 0.32},
        ],
    },
};

/** Quick-attack / exponential-decay envelope, 0..1. */
function envelope(tSec: number, durSec: number): number {
    const attack = 0.006;
    if (tSec < 0 || tSec > durSec) return 0;
    const a = tSec < attack ? tSec / attack : 1;
    // Decay so the tail is near-silent by the end of the tone.
    const decay = Math.exp((-3.5 * tSec) / durSec);
    return a * decay;
}

/**
 * Render an effect into mono PCM samples. Pure + deterministic
 * except for the noise component (confetti). Exposed for unit
 * tests and reused by ``playSound``.
 */
export function renderSamples(
    name: SoundName,
    sampleRate = 44100,
): Float32Array {
    const recipe = RECIPES[name];
    const length = Math.max(1, Math.round((recipe.totalMs / 1000) * sampleRate));
    const out = new Float32Array(length);
    for (const tone of recipe.tones) {
        const start = Math.round((tone.startMs / 1000) * sampleRate);
        const durSec = tone.durMs / 1000;
        const toneLen = Math.round(durSec * sampleRate);
        for (let i = 0; i < toneLen; i++) {
            const idx = start + i;
            if (idx >= length) break;
            const tSec = i / sampleRate;
            const env = envelope(tSec, durSec) * tone.gain;
            const sample = tone.noise
                ? (Math.random() * 2 - 1) * env
                : Math.sin(2 * Math.PI * tone.freq * tSec) * env;
            out[idx] += sample;
        }
    }
    // Clamp to [-1, 1] in case overlapping partials sum above 1.
    for (let i = 0; i < length; i++) {
        if (out[i] > 1) out[i] = 1;
        else if (out[i] < -1) out[i] = -1;
    }
    return out;
}

type AnyAudioContext = typeof AudioContext;

function resolveAudioContextCtor(): AnyAudioContext | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
        AudioContext?: AnyAudioContext;
        webkitAudioContext?: AnyAudioContext;
    };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;

/** Lazily create (and resume) the shared AudioContext. Returns
 *  null when Web Audio is unavailable. Must be called from within
 *  a user gesture the first time. */
function getAudioContext(): AudioContext | null {
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;
    if (!ctx) {
        try {
            ctx = new Ctor();
        } catch {
            return null;
        }
    }
    if (ctx.state === "suspended") {
        void ctx.resume();
    }
    return ctx;
}

/**
 * Play a sound effect. No-op (returns false) when sounds are
 * disabled, the master volume is 0, or Web Audio is unavailable.
 * Returns true when playback was started.
 */
export function playSound(name: SoundName): boolean {
    if (!readSoundEnabled()) return false;
    const volume = readSoundVolume() / 100;
    if (volume <= 0) return false;
    const audio = getAudioContext();
    if (!audio) return false;
    try {
        const samples = renderSamples(name, audio.sampleRate);
        const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
        buffer.getChannelData(0).set(samples);
        const source = audio.createBufferSource();
        source.buffer = buffer;
        const gain = audio.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(audio.destination);
        source.start();
        return true;
    } catch {
        return false;
    }
}

/** Test hook: drop the cached AudioContext. */
export function _resetAudioContextForTests(): void {
    ctx = null;
}
