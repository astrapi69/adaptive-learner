/**
 * Voice preferences (Phase 31 / v1.18.0).
 *
 * Persists user-toggleable voice settings in localStorage.
 * These are presentation-only — the SpeechButton + MicButton
 * read them to decide visibility + rate/pitch/voice; the apps's
 * core flow doesn't care.
 *
 * Defaults:
 *   - tts_enabled: true (speech buttons render when the browser
 *     supports speechSynthesis)
 *   - stt_enabled: true
 *   - auto_play_ai: false (don't surprise the user with sound)
 *   - tts_rate: 1.0  (Web Speech default)
 *   - tts_pitch: 1.0
 *   - tts_voice_name: ""  (empty = use ``pickVoice(lang)`` default)
 *   - stt_lang_override: ""  (empty = use project / user lang)
 *   - pronunciation_enabled: true (the page hides anyway if the
 *     project isn't a language project)
 */

const K = {
    ttsEnabled: "adaptive-learner.voice.tts_enabled",
    sttEnabled: "adaptive-learner.voice.stt_enabled",
    autoPlay: "adaptive-learner.voice.auto_play_ai",
    rate: "adaptive-learner.voice.tts_rate",
    pitch: "adaptive-learner.voice.tts_pitch",
    voiceName: "adaptive-learner.voice.tts_voice_name",
    sttLang: "adaptive-learner.voice.stt_lang_override",
    pronunciation: "adaptive-learner.voice.pronunciation_enabled",
} as const;

export interface VoicePrefs {
    ttsEnabled: boolean;
    sttEnabled: boolean;
    autoPlayAi: boolean;
    ttsRate: number;
    ttsPitch: number;
    ttsVoiceName: string;
    sttLangOverride: string;
    pronunciationEnabled: boolean;
}

function readBool(key: string, fallback: boolean): boolean {
    try {
        const raw = localStorage.getItem(key);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return fallback;
}

function readNumber(key: string, fallback: number, min: number, max: number): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            return parsed;
        }
    } catch {
        /* no-op */
    }
    return fallback;
}

function readString(key: string, fallback: string): string {
    try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return raw;
    } catch {
        /* no-op */
    }
    return fallback;
}

export function readVoicePrefs(): VoicePrefs {
    return {
        ttsEnabled: readBool(K.ttsEnabled, true),
        sttEnabled: readBool(K.sttEnabled, true),
        autoPlayAi: readBool(K.autoPlay, false),
        ttsRate: readNumber(K.rate, 1.0, 0.5, 2.0),
        ttsPitch: readNumber(K.pitch, 1.0, 0.5, 2.0),
        ttsVoiceName: readString(K.voiceName, ""),
        sttLangOverride: readString(K.sttLang, ""),
        pronunciationEnabled: readBool(K.pronunciation, true),
    };
}

export function writeTtsEnabled(v: boolean): void {
    try { localStorage.setItem(K.ttsEnabled, v ? "true" : "false"); } catch { /* localStorage unavailable — best effort */ }
}
export function writeSttEnabled(v: boolean): void {
    try { localStorage.setItem(K.sttEnabled, v ? "true" : "false"); } catch { /* localStorage unavailable — best effort */ }
}
export function writeAutoPlayAi(v: boolean): void {
    try { localStorage.setItem(K.autoPlay, v ? "true" : "false"); } catch { /* localStorage unavailable — best effort */ }
}
export function writeTtsRate(v: number): void {
    const clamped = Math.max(0.5, Math.min(2.0, v));
    try { localStorage.setItem(K.rate, String(clamped)); } catch { /* localStorage unavailable — best effort */ }
}
export function writeTtsPitch(v: number): void {
    const clamped = Math.max(0.5, Math.min(2.0, v));
    try { localStorage.setItem(K.pitch, String(clamped)); } catch { /* localStorage unavailable — best effort */ }
}
export function writeTtsVoiceName(v: string): void {
    try { localStorage.setItem(K.voiceName, v); } catch { /* localStorage unavailable — best effort */ }
}
export function writeSttLangOverride(v: string): void {
    try { localStorage.setItem(K.sttLang, v); } catch { /* localStorage unavailable — best effort */ }
}
export function writePronunciationEnabled(v: boolean): void {
    try { localStorage.setItem(K.pronunciation, v ? "true" : "false"); } catch { /* localStorage unavailable — best effort */ }
}

export const VOICE_PREF_KEYS = K;
