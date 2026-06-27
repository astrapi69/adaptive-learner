/**
 * voicePref localStorage tests (Phase 31D; consolidation #893).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    readVoicePrefs,
    VOICE_PREF_BLOCK_KEY,
    VOICE_PREF_KEYS,
    writeAutoPlayAi,
    writeLessonAutoRead,
    writeLessonSpeed,
    writePronunciationEnabled,
    writeSttEnabled,
    writeSttLangOverride,
    writeTtsEnabled,
    writeTtsPitch,
    writeTtsRate,
    writeTtsVoiceName,
} from "./voicePref";

beforeEach(() => {
    localStorage.clear();
});

/** Parse the consolidated block back into an object (or {} if absent). */
function readBlock(): Record<string, unknown> {
    const raw = localStorage.getItem(VOICE_PREF_BLOCK_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Record<string, unknown>);
}

describe("readVoicePrefs defaults", () => {
    it("ttsEnabled defaults to true", () => {
        expect(readVoicePrefs().ttsEnabled).toBe(true);
    });

    it("sttEnabled defaults to true", () => {
        expect(readVoicePrefs().sttEnabled).toBe(true);
    });

    it("autoPlayAi defaults to false (no surprise sound)", () => {
        expect(readVoicePrefs().autoPlayAi).toBe(false);
    });

    it("ttsRate + ttsPitch default to 1.0", () => {
        const p = readVoicePrefs();
        expect(p.ttsRate).toBe(1.0);
        expect(p.ttsPitch).toBe(1.0);
    });

    it("ttsVoiceName + sttLangOverride default to empty string", () => {
        const p = readVoicePrefs();
        expect(p.ttsVoiceName).toBe("");
        expect(p.sttLangOverride).toBe("");
    });

    it("pronunciationEnabled defaults to true", () => {
        expect(readVoicePrefs().pronunciationEnabled).toBe(true);
    });

    it("lessonSpeed defaults to 1.0, lessonAutoRead to false", () => {
        const p = readVoicePrefs();
        expect(p.lessonSpeed).toBe(1.0);
        expect(p.lessonAutoRead).toBe(false);
    });

    it("a pure read on a clean install does not write the block", () => {
        readVoicePrefs();
        expect(localStorage.getItem(VOICE_PREF_BLOCK_KEY)).toBeNull();
    });
});

describe("setters persist into the consolidated block + clamp", () => {
    it("writeTtsEnabled persists to the block (not a legacy key)", () => {
        writeTtsEnabled(false);
        expect(localStorage.getItem(VOICE_PREF_KEYS.ttsEnabled)).toBeNull();
        expect(readBlock().ttsEnabled).toBe(false);
        expect(readVoicePrefs().ttsEnabled).toBe(false);
    });

    it("writeSttEnabled persists boolean", () => {
        writeSttEnabled(false);
        expect(readVoicePrefs().sttEnabled).toBe(false);
    });

    it("writeAutoPlayAi persists boolean", () => {
        writeAutoPlayAi(true);
        expect(readVoicePrefs().autoPlayAi).toBe(true);
    });

    it("writeTtsRate clamps to [0.5, 2.0]", () => {
        writeTtsRate(5);
        expect(readVoicePrefs().ttsRate).toBe(2.0);
        writeTtsRate(0.1);
        expect(readVoicePrefs().ttsRate).toBe(0.5);
        writeTtsRate(1.5);
        expect(readVoicePrefs().ttsRate).toBe(1.5);
    });

    it("writeTtsPitch clamps to [0.5, 2.0]", () => {
        writeTtsPitch(10);
        expect(readVoicePrefs().ttsPitch).toBe(2.0);
    });

    it("writeTtsVoiceName persists string", () => {
        writeTtsVoiceName("Alice EN-US");
        expect(readVoicePrefs().ttsVoiceName).toBe("Alice EN-US");
    });

    it("writeSttLangOverride persists string", () => {
        writeSttLangOverride("es-ES");
        expect(readVoicePrefs().sttLangOverride).toBe("es-ES");
    });

    it("writePronunciationEnabled persists boolean", () => {
        writePronunciationEnabled(false);
        expect(readVoicePrefs().pronunciationEnabled).toBe(false);
    });

    it("writeLessonSpeed + writeLessonAutoRead persist", () => {
        writeLessonSpeed(0.75);
        writeLessonAutoRead(true);
        const p = readVoicePrefs();
        expect(p.lessonSpeed).toBe(0.75);
        expect(p.lessonAutoRead).toBe(true);
    });

    it("a setter merges (does not clobber) other fields", () => {
        writeTtsVoiceName("Bob");
        writeTtsRate(1.5);
        const p = readVoicePrefs();
        expect(p.ttsVoiceName).toBe("Bob");
        expect(p.ttsRate).toBe(1.5);
    });
});

describe("malformed block / values fall through to defaults", () => {
    it("non-numeric rate (legacy) → default 1.0", () => {
        localStorage.setItem(VOICE_PREF_KEYS.rate, "not-a-number");
        expect(readVoicePrefs().ttsRate).toBe(1.0);
    });

    it("out-of-range rate (legacy) → default 1.0", () => {
        localStorage.setItem(VOICE_PREF_KEYS.rate, "100");
        expect(readVoicePrefs().ttsRate).toBe(1.0);
    });

    it("unknown boolean string (legacy) → default", () => {
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "maybe");
        expect(readVoicePrefs().ttsEnabled).toBe(true); // default
    });

    it("a corrupt block JSON → all defaults, no crash", () => {
        localStorage.setItem(VOICE_PREF_BLOCK_KEY, "{not valid json");
        const p = readVoicePrefs();
        expect(p.ttsEnabled).toBe(true);
        expect(p.ttsRate).toBe(1.0);
    });
});

describe("legacy-key migration (#893, no silent data loss)", () => {
    /** Seed all 10 legacy keys with non-default values. */
    function seedAllLegacyKeys(): void {
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "false");
        localStorage.setItem(VOICE_PREF_KEYS.sttEnabled, "false");
        localStorage.setItem(VOICE_PREF_KEYS.autoPlay, "true");
        localStorage.setItem(VOICE_PREF_KEYS.rate, "1.5");
        localStorage.setItem(VOICE_PREF_KEYS.pitch, "0.75");
        localStorage.setItem(VOICE_PREF_KEYS.voiceName, "Alice EN-US");
        localStorage.setItem(VOICE_PREF_KEYS.sttLang, "es-ES");
        localStorage.setItem(VOICE_PREF_KEYS.pronunciation, "false");
        localStorage.setItem(VOICE_PREF_KEYS.lessonSpeed, "1.25");
        localStorage.setItem(VOICE_PREF_KEYS.lessonAutoRead, "true");
    }

    it("migrates ALL 10 legacy keys into the block and cleans them up", () => {
        seedAllLegacyKeys();

        const p = readVoicePrefs();

        // Every legacy value landed in the consolidated prefs.
        expect(p).toEqual({
            ttsEnabled: false,
            sttEnabled: false,
            autoPlayAi: true,
            ttsRate: 1.5,
            ttsPitch: 0.75,
            ttsVoiceName: "Alice EN-US",
            sttLangOverride: "es-ES",
            pronunciationEnabled: false,
            lessonSpeed: 1.25,
            lessonAutoRead: true,
        });
        // The block now exists...
        expect(localStorage.getItem(VOICE_PREF_BLOCK_KEY)).not.toBeNull();
        // ...and every legacy key was removed.
        for (const key of Object.values(VOICE_PREF_KEYS)) {
            expect(localStorage.getItem(key)).toBeNull();
        }
    });

    it("is idempotent: a second read does not change the block destructively", () => {
        seedAllLegacyKeys();
        readVoicePrefs();
        const afterFirst = localStorage.getItem(VOICE_PREF_BLOCK_KEY);

        // A later legacy write is ignored (block already authoritative),
        // and the stored block is byte-stable across reads.
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "true");
        const second = readVoicePrefs();
        expect(second.ttsEnabled).toBe(false); // still the migrated value
        expect(localStorage.getItem(VOICE_PREF_BLOCK_KEY)).toBe(afterFirst);
    });

    it("fresh install (no legacy keys) → defaults, no crash, no write", () => {
        const p = readVoicePrefs();
        expect(p).toEqual({
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
        });
        expect(localStorage.getItem(VOICE_PREF_BLOCK_KEY)).toBeNull();
    });

    it("partial legacy state migrates present keys + defaults the rest", () => {
        localStorage.setItem(VOICE_PREF_KEYS.lessonAutoRead, "true");
        localStorage.setItem(VOICE_PREF_KEYS.rate, "1.5");

        const p = readVoicePrefs();
        expect(p.lessonAutoRead).toBe(true); // migrated
        expect(p.ttsRate).toBe(1.5); // migrated
        expect(p.ttsEnabled).toBe(true); // default (absent legacy)
        expect(p.lessonSpeed).toBe(1.0); // default (absent legacy)

        // The two present legacy keys were cleaned up.
        expect(localStorage.getItem(VOICE_PREF_KEYS.lessonAutoRead)).toBeNull();
        expect(localStorage.getItem(VOICE_PREF_KEYS.rate)).toBeNull();
    });
});
