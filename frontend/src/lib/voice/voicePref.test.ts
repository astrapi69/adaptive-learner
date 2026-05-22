/**
 * voicePref localStorage tests (Phase 31D).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    readVoicePrefs,
    VOICE_PREF_KEYS,
    writeAutoPlayAi,
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
});

describe("setters persist + clamp", () => {
    it("writeTtsEnabled persists boolean", () => {
        writeTtsEnabled(false);
        expect(localStorage.getItem(VOICE_PREF_KEYS.ttsEnabled)).toBe("false");
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
});

describe("malformed values fall through to defaults", () => {
    it("non-numeric rate → default 1.0", () => {
        localStorage.setItem(VOICE_PREF_KEYS.rate, "not-a-number");
        expect(readVoicePrefs().ttsRate).toBe(1.0);
    });

    it("out-of-range rate → default 1.0", () => {
        // The reader rejects values outside [0.5, 2.0] AND falls
        // back to the default — the clamping only happens on
        // write.
        localStorage.setItem(VOICE_PREF_KEYS.rate, "100");
        expect(readVoicePrefs().ttsRate).toBe(1.0);
    });

    it("unknown boolean string → default", () => {
        localStorage.setItem(VOICE_PREF_KEYS.ttsEnabled, "maybe");
        expect(readVoicePrefs().ttsEnabled).toBe(true); // default
    });
});
