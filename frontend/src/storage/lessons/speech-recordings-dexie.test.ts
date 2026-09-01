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
    wasEvictedDexie,
} from "./speech-recordings-dexie";
import {_resetDbForTests, getDb} from "../dexie/db";
import {
    wasSpeechRecordingEvicted,
    markSpeechRecordingEvicted,
} from "../../lib/voice/speech-recording-evicted-store";

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
    localStorage.clear();
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

// #2841 — a tiny cap override (bytes, not the real 20 MB default) keeps
// these fast: eviction is exercised with 2-3 rows, not the ~170 real
// max-length recordings a 20 MB cap would actually take to trigger.
describe("Dexie speechRecordings: storage-cap eviction (#2841)", () => {
    it("evicts the OLDEST row (by recorded_at) once a save exceeds the cap", async () => {
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-old", audio_base64: "A".repeat(10)}),
            15,
        );
        await new Promise((r) => setTimeout(r, 2));
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-new", audio_base64: "B".repeat(10)}),
            15,
        );
        const oldRow = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, "ex-old");
        const newRow = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, "ex-new");
        expect(oldRow).toBeNull();
        expect(newRow).not.toBeNull();
    });

    it("marks an evicted row so wasEvicted reports true afterwards", async () => {
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-old", audio_base64: "A".repeat(10)}),
            15,
        );
        await new Promise((r) => setTimeout(r, 2));
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-new", audio_base64: "B".repeat(10)}),
            15,
        );
        const evicted = await wasEvictedDexie(USER, SOURCE, SET_ID, LESSON, "ex-old");
        expect(evicted).toBe(true);
        const notEvicted = await wasEvictedDexie(USER, SOURCE, SET_ID, LESSON, "ex-new");
        expect(notEvicted).toBe(false);
    });

    it("only evicts THIS user's rows, never another user's", async () => {
        await saveSpeechRecordingDexie(
            "other-user",
            upsertBody({exercise_id: "ex-other", audio_base64: "A".repeat(10)}),
            20,
        );
        await new Promise((r) => setTimeout(r, 2));
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-mine", audio_base64: "B".repeat(10)}),
            20,
        );
        const otherRow = await getSpeechRecordingDexie(
            "other-user",
            SOURCE,
            SET_ID,
            LESSON,
            "ex-other",
        );
        expect(otherRow).not.toBeNull();
    });

    it("does not evict when under the cap", async () => {
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-1", audio_base64: "A".repeat(5)}),
            1_000_000,
        );
        await saveSpeechRecordingDexie(
            USER,
            upsertBody({exercise_id: "ex-2", audio_base64: "B".repeat(5)}),
            1_000_000,
        );
        const row1 = await getSpeechRecordingDexie(USER, SOURCE, SET_ID, LESSON, "ex-1");
        expect(row1).not.toBeNull();
    });

    it("clears a prior eviction marker when the exercise is re-recorded", async () => {
        const key = `${USER}#${SOURCE.replace(/\//g, "--")}#${SET_ID}#${LESSON}#ex-old`;
        markSpeechRecordingEvicted(key);
        expect(wasSpeechRecordingEvicted(key)).toBe(true);

        await saveSpeechRecordingDexie(USER, upsertBody({exercise_id: "ex-old"}));

        expect(wasSpeechRecordingEvicted(key)).toBe(false);
    });
});
