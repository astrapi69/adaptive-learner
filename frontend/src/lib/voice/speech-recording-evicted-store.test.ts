/**
 * Tests for the speech-recording eviction marker (#2841).
 *
 * Runs against REAL localStorage (happy-dom), mirroring
 * lesson-order-store.test.ts / set-status-store's convention - no
 * storage mock.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    clearSpeechRecordingEvicted,
    markSpeechRecordingEvicted,
    wasSpeechRecordingEvicted,
} from "./speech-recording-evicted-store";

const KEY = "adaptive-learner.speech-recording-evicted";
const ID = "u1#owner--repo#set-1#01.json#ex-1";

beforeEach(() => {
    localStorage.clear();
});

describe("speech-recording-evicted-store", () => {
    it("reports false for a recording never marked evicted", () => {
        expect(wasSpeechRecordingEvicted(ID)).toBe(false);
    });

    it("reports true after marking, false after clearing", () => {
        markSpeechRecordingEvicted(ID);
        expect(wasSpeechRecordingEvicted(ID)).toBe(true);
        clearSpeechRecordingEvicted(ID);
        expect(wasSpeechRecordingEvicted(ID)).toBe(false);
    });

    it("keeps markers for OTHER ids independent", () => {
        markSpeechRecordingEvicted(ID);
        markSpeechRecordingEvicted("u1#owner--repo#set-1#02.json#ex-1");
        clearSpeechRecordingEvicted(ID);
        expect(wasSpeechRecordingEvicted(ID)).toBe(false);
        expect(
            wasSpeechRecordingEvicted("u1#owner--repo#set-1#02.json#ex-1"),
        ).toBe(true);
    });

    it("tolerates corrupt storage instead of throwing", () => {
        localStorage.setItem(KEY, "{not json");
        expect(wasSpeechRecordingEvicted(ID)).toBe(false);
        expect(() => markSpeechRecordingEvicted(ID)).not.toThrow();
    });

    it("clearing an id that was never marked is a no-op", () => {
        expect(() => clearSpeechRecordingEvicted(ID)).not.toThrow();
        expect(wasSpeechRecordingEvicted(ID)).toBe(false);
    });
});
