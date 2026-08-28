/**
 * Mentor-notes store (#2768) — mode-agnostic per-step authoring notes.
 *
 * One localStorage-backed source of truth (the ``set-status-store`` /
 * ``dismissed-sets`` pattern), identical in API and Dexie mode, so the
 * #2053 "works in one storage mode only" class cannot recur. Tests run
 * against REAL ``localStorage`` (happy-dom), no storage mock; the backup
 * pin proves the key rides the ``.alb`` localStorage snapshot.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    getMentorNote,
    listLessonMentorNotes,
    removeMentorNote,
    storeMentorNote,
    type MentorNoteRef,
} from "./mentor-notes-store";
import {
    captureLocalStorageSnapshot,
    isExcludedLocalStorageKey,
} from "../backup/localStorageSnapshot";

const KEY = "adaptive-learner.mentor-notes";

const REF: MentorNoteRef = {
    source: "user-generated",
    setId: "my-set",
    filename: "01.json",
    stepId: "s-ex-1",
};

beforeEach(() => {
    localStorage.clear();
});

describe("mentor-notes store (#2768)", () => {
    it("stores a note and reads it back after a 'reload'", () => {
        storeMentorNote(REF, {category: "typo", text: "Umlaut fehlt"});
        const note = getMentorNote(REF);
        expect(note?.category).toBe("typo");
        expect(note?.text).toBe("Umlaut fehlt");
        expect(note?.created_at).toBeTruthy();
    });

    it("updates an existing note in place and removes it again", () => {
        storeMentorNote(REF, {category: "typo", text: "alt"});
        storeMentorNote(REF, {category: "unclear", text: "neu"});
        expect(getMentorNote(REF)?.text).toBe("neu");
        expect(getMentorNote(REF)?.category).toBe("unclear");

        removeMentorNote(REF);
        expect(getMentorNote(REF)).toBeNull();
        expect(listLessonMentorNotes(REF)).toEqual([]);
    });

    it("lists only the notes of the requested lesson, keyed by step", () => {
        storeMentorNote(REF, {category: "typo", text: "a"});
        storeMentorNote(
            {...REF, stepId: "s-ex-2"},
            {category: "too_easy", text: "b"},
        );
        storeMentorNote(
            {...REF, filename: "02.json", stepId: "s-ex-1"},
            {category: "other", text: "andere Lektion"},
        );
        const rows = listLessonMentorNotes(REF);
        expect(rows.map((r) => r.stepId).sort()).toEqual(["s-ex-1", "s-ex-2"]);
        expect(rows.every((r) => r.note.text !== "andere Lektion")).toBe(true);
    });

    it("tolerates corrupt storage and filters invalid entries", () => {
        localStorage.setItem(KEY, "{not json");
        expect(getMentorNote(REF)).toBeNull();
        expect(listLessonMentorNotes(REF)).toEqual([]);

        localStorage.setItem(
            KEY,
            JSON.stringify({
                "user-generated::my-set::01.json::s-ex-1": {
                    category: "not-a-category",
                    text: "x",
                    created_at: "2026-01-01T00:00:00Z",
                },
            }),
        );
        expect(getMentorNote(REF)).toBeNull();
    });

    it("rides the .alb backup's localStorage snapshot (not excluded)", () => {
        storeMentorNote(REF, {category: "typo", text: "backup me"});
        expect(isExcludedLocalStorageKey(KEY)).toBe(false);
        const snapshot = captureLocalStorageSnapshot();
        expect(snapshot[KEY]).toContain("backup me");
    });
});
