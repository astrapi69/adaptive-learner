/**
 * Voice preferences (Phase 31 / v1.18.0; consolidated #893).
 *
 * Persists user-toggleable voice settings in localStorage. These are
 * presentation-only — the SpeechButton + MicButton + read-aloud engine read
 * them to decide visibility + rate/pitch/voice/speed; the app's core flow
 * doesn't care.
 *
 * Storage layout (#893): a SINGLE consolidated key
 * (``adaptive-learner.voice.prefs``) holding a JSON object, instead of the
 * 10 loose per-setting keys the Offline audit flagged. The legacy keys are
 * migrated into the block on first access and then cleaned up (see
 * ``loadBlock`` / ``LEGACY_KEYS``). Reads are pure for a clean install (no
 * write side effect); a write only happens when there is legacy data to
 * migrate or a setter is called.
 *
 * Both storage modes use the same block: voice prefs are purely client-side
 * (localStorage), with no Dexie / backend mirror. The ``.alb`` backup picks
 * the block up automatically because it lives under the ``adaptive-learner.``
 * namespace that ``captureLocalStorageSnapshot`` snapshots wholesale.
 *
 * Defaults:
 *   - ttsEnabled: true (speech buttons render when the browser supports
 *     speechSynthesis)
 *   - sttEnabled: true
 *   - autoPlayAi: false (don't surprise the user with sound)
 *   - ttsRate: 1.0  (Web Speech default)
 *   - ttsPitch: 1.0
 *   - ttsVoiceName: ""  (empty = use ``pickVoice(lang)`` default)
 *   - sttLangOverride: ""  (empty = use project / user lang)
 *   - pronunciationEnabled: true (the page hides anyway if the project
 *     isn't a language project)
 *   - lessonSpeed: 1.0  (inline read-aloud speed multiplier)
 *   - lessonAutoRead: false (manual button clicks are the baseline)
 */

/** The single consolidated localStorage key (#893). */
export const VOICE_PREF_BLOCK_KEY = "adaptive-learner.voice.prefs";

/**
 * Legacy per-setting keys, kept ONLY for the one-time migration into
 * {@link VOICE_PREF_BLOCK_KEY}. Exported as ``VOICE_PREF_KEYS`` for
 * backwards compatibility with callers/tests that seed a legacy value.
 */
const LEGACY_KEYS = {
    ttsEnabled: "adaptive-learner.voice.tts_enabled",
    sttEnabled: "adaptive-learner.voice.stt_enabled",
    autoPlay: "adaptive-learner.voice.auto_play_ai",
    rate: "adaptive-learner.voice.tts_rate",
    pitch: "adaptive-learner.voice.tts_pitch",
    voiceName: "adaptive-learner.voice.tts_voice_name",
    sttLang: "adaptive-learner.voice.stt_lang_override",
    pronunciation: "adaptive-learner.voice.pronunciation_enabled",
    lessonSpeed: "adaptive-learner.voice.lesson_speed",
    lessonAutoRead: "adaptive-learner.voice.lesson_autoread",
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
    lessonSpeed: number;
    lessonAutoRead: boolean;
}

function defaults(): VoicePrefs {
    return {
        ttsEnabled: true,
        sttEnabled: true,
        autoPlayAi: false,
        ttsRate: 1.0,
        ttsPitch: 1.0,
        ttsVoiceName: "",
        sttLangOverride: "",
        pronunciationEnabled: true,
        lessonSpeed: 1.0,
        lessonAutoRead: false,
    };
}

function coerceBool(value: unknown, fallback: boolean): boolean {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return fallback;
}

function coerceNumber(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
        return parsed;
    }
    return fallback;
}

function coerceString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

/**
 * Validate an arbitrary record into a complete {@link VoicePrefs}, falling
 * back to the documented default for any missing / out-of-range / malformed
 * field. Shared by the block parser and the legacy migration so both apply
 * identical validation.
 */
function coercePrefs(raw: Record<string, unknown>): VoicePrefs {
    const base = defaults();
    return {
        ttsEnabled: coerceBool(raw.ttsEnabled, base.ttsEnabled),
        sttEnabled: coerceBool(raw.sttEnabled, base.sttEnabled),
        autoPlayAi: coerceBool(raw.autoPlayAi, base.autoPlayAi),
        ttsRate: coerceNumber(raw.ttsRate, base.ttsRate, 0.5, 2.0),
        ttsPitch: coerceNumber(raw.ttsPitch, base.ttsPitch, 0.5, 2.0),
        ttsVoiceName: coerceString(raw.ttsVoiceName, base.ttsVoiceName),
        sttLangOverride: coerceString(raw.sttLangOverride, base.sttLangOverride),
        pronunciationEnabled: coerceBool(
            raw.pronunciationEnabled,
            base.pronunciationEnabled,
        ),
        lessonSpeed: coerceNumber(raw.lessonSpeed, base.lessonSpeed, 0.1, 4.0),
        lessonAutoRead: coerceBool(raw.lessonAutoRead, base.lessonAutoRead),
    };
}

/**
 * Read the legacy per-setting keys into a {@link VoicePrefs}. Returns the
 * built prefs plus whether ANY legacy key was present (so the caller knows
 * if there is something to migrate + clean up).
 */
function readLegacyPrefs(): {prefs: VoicePrefs; found: boolean} {
    let found = false;
    const raw: Record<string, unknown> = {};
    const pick = (field: keyof VoicePrefs, key: string) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            found = true;
            raw[field] = value;
        }
    };
    pick("ttsEnabled", LEGACY_KEYS.ttsEnabled);
    pick("sttEnabled", LEGACY_KEYS.sttEnabled);
    pick("autoPlayAi", LEGACY_KEYS.autoPlay);
    pick("ttsRate", LEGACY_KEYS.rate);
    pick("ttsPitch", LEGACY_KEYS.pitch);
    pick("ttsVoiceName", LEGACY_KEYS.voiceName);
    pick("sttLangOverride", LEGACY_KEYS.sttLang);
    pick("pronunciationEnabled", LEGACY_KEYS.pronunciation);
    pick("lessonSpeed", LEGACY_KEYS.lessonSpeed);
    pick("lessonAutoRead", LEGACY_KEYS.lessonAutoRead);
    return {prefs: coercePrefs(raw), found};
}

function removeLegacyKeys(): void {
    for (const key of Object.values(LEGACY_KEYS)) {
        localStorage.removeItem(key);
    }
}

function persistBlock(prefs: VoicePrefs): void {
    try {
        localStorage.setItem(VOICE_PREF_BLOCK_KEY, JSON.stringify(prefs));
    } catch {
        /* localStorage unavailable — best effort */
    }
}

/**
 * Load the consolidated voice-prefs block, migrating the legacy keys on
 * first access. The migration is idempotent: once the block exists the
 * legacy keys are gone and never consulted again; a clean install (no block,
 * no legacy keys) returns the defaults WITHOUT writing. Never throws.
 */
function loadBlock(): VoicePrefs {
    try {
        const rawBlock = localStorage.getItem(VOICE_PREF_BLOCK_KEY);
        if (rawBlock !== null) {
            const parsed = JSON.parse(rawBlock) as Record<string, unknown>;
            return coercePrefs(parsed ?? {});
        }
        const {prefs, found} = readLegacyPrefs();
        if (found) {
            persistBlock(prefs);
            removeLegacyKeys();
        }
        return prefs;
    } catch {
        return defaults();
    }
}

/**
 * Read all voice preferences, falling back to the documented defaults for
 * any unset / invalid field. Migrates the legacy per-setting keys into the
 * consolidated block on first access.
 */
export function readVoicePrefs(): VoicePrefs {
    return loadBlock();
}

/** Update a single field in the consolidated block (read-merge-write). */
function patch<K extends keyof VoicePrefs>(field: K, value: VoicePrefs[K]): void {
    const block = loadBlock();
    block[field] = value;
    persistBlock(block);
}

export function writeTtsEnabled(v: boolean): void {
    patch("ttsEnabled", v);
}
/** Persist whether STT (voice dictation) is enabled. */
export function writeSttEnabled(v: boolean): void {
    patch("sttEnabled", v);
}
/** Persist whether AI replies are auto-played aloud. */
export function writeAutoPlayAi(v: boolean): void {
    patch("autoPlayAi", v);
}
/** Persist the TTS speaking rate (clamped to 0.5..2.0). */
export function writeTtsRate(v: number): void {
    patch("ttsRate", Math.max(0.5, Math.min(2.0, v)));
}
/** Persist the TTS pitch (clamped to 0.5..2.0). */
export function writeTtsPitch(v: number): void {
    patch("ttsPitch", Math.max(0.5, Math.min(2.0, v)));
}
/** Persist the preferred TTS voice name ("" = pick a default by lang). */
export function writeTtsVoiceName(v: string): void {
    patch("ttsVoiceName", v);
}
/** Persist the STT language override ("" = use the project / user lang). */
export function writeSttLangOverride(v: string): void {
    patch("sttLangOverride", v);
}
/** Persist whether the pronunciation page is enabled. */
export function writePronunciationEnabled(v: boolean): void {
    patch("pronunciationEnabled", v);
}
/** Persist the inline lesson read-aloud speed multiplier. The read-aloud
 *  engine clamps the value to its offered set; this stores it verbatim. */
export function writeLessonSpeed(v: number): void {
    patch("lessonSpeed", v);
}
/** Persist whether the lesson auto-reads each step on display. */
export function writeLessonAutoRead(v: boolean): void {
    patch("lessonAutoRead", v);
}

/**
 * Legacy per-setting key map. Retained for backwards compatibility (callers
 * that seed a value under an old key; the migration in {@link loadBlock}
 * picks it up). New code should use {@link VOICE_PREF_BLOCK_KEY}.
 */
export const VOICE_PREF_KEYS = LEGACY_KEYS;
