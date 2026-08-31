/**
 * Tests for the Dexie-mode speech-recordings store
 * (engine#68 idea 3: speak-and-record).
 *
 * Mirrors ``lesson-progress-dexie.test.ts``'s setup, one composite-key
 * level deeper (``exercise_id``).
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {
    deleteSpeechRecordingDexie,
    getSpeechRecordingDexie,
    saveSpeechRecordingDexie,
} from "./speech-recordings-dexie";
import {_resetDbForTests, getDb} from "../dexie/db";

const USER = "user-1";
const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "language-fr-a1";
const LESSON = "01-greetings.json";
const EXERCISE = "ex-speak-1";
const AUDIO_B64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEA";

beforeEach(async () => {
    const db = getDb();
    try {
        await db.speechRecordings.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

function upsertBody(overrides: Partial<Parameters<typeof saveSpeechRecordingDexie>[1]> = {}) {
    return {
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON,
        exercise_id: EXERCISE,
        audio_base64: AUDIO_B64,
        mime_type: "audio/webm",
        duration_ms: 2500,
        ...overrides,
    };
}

describe("Dexie speechRecordings: get on empty DB", () => {
    it("returns null when no row exists", async () => {
        const row = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, EXERCISE);
        expect(row).toBeNull();
    });
});

describe("Dexie speechRecordings: save", () => {
    it("creates a new row on first call", async () => {
        const row = await saveSpeechRecordingDexie(USER, upsertBody());
        expect(row.user_id).toBe(USER);
        expect(row.exercise_id).toBe(EXERCISE);
        expect(row.audio_base64).toBe(AUDIO_B64);
        expect(row.duration_ms).toBe(2500);
        expect(row.recorded_at).toBeTruthy();
        expect(row.updated_at).toBeTruthy();
    });

    it("round-trips through get", async () => {
        await saveSpeechRecordingDexie(USER, upsertBody());
        const row = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, EXERCISE);
        expect(row?.mime_type).toBe("audio/webm");
    });

    it("re-recording overwrites the same row (id + recorded_at unchanged, content updated)", async () => {
        const first = await saveSpeechRecordingDexie(USER, upsertBody({duration_ms: 1000}));
        const second = await saveSpeechRecordingDexie(
            USER,
            upsertBody({duration_ms: 3000, audio_base64: "c2Vjb25kIGNsaXA="}),
        );
        expect(second.id).toBe(first.id);
        expect(second.recorded_at).toBe(first.recorded_at);
        expect(second.duration_ms).toBe(3000);
        expect(second.audio_base64).toBe("c2Vjb25kIGNsaXA=");
    });

    it("two exercises in the same lesson get independent rows", async () => {
        await saveSpeechRecordingDexie(USER, upsertBody({exercise_id: "ex-speak-1", duration_ms: 2500}));
        await saveSpeechRecordingDexie(USER, upsertBody({exercise_id: "ex-speak-2", duration_ms: 500}));
        const row1 = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, "ex-speak-1");
        const row2 = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, "ex-speak-2");
        expect(row1?.duration_ms).toBe(2500);
        expect(row2?.duration_ms).toBe(500);
    });
});

describe("Dexie speechRecordings: delete", () => {
    it("removes an existing row", async () => {
        await saveSpeechRecordingDexie(USER, upsertBody());
        await deleteSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, EXERCISE);
        const row = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, EXERCISE);
        expect(row).toBeNull();
    });

    it("is a no-op when nothing exists at that key", async () => {
        await expect(
            deleteSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, EXERCISE),
        ).resolves.not.toThrow();
    });
});
