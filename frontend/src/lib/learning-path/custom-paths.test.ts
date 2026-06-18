/**
 * Tests for the custom-paths localStorage layer (Curriculum Builder,
 * Option A of #722). Uses an in-memory Storage mock so the suite is
 * deterministic and isolated.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    addLessonToPath,
    createCustomPath,
    customPathProgress,
    deleteCustomPath,
    listCustomPaths,
    moveLessonInPath,
    removeLessonFromPath,
    renameCustomPath,
    type CustomPathLesson,
} from "./custom-paths";
import type {LessonProgress} from "../../storage/types";

/** Minimal in-memory Storage for deterministic, isolated tests. */
function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        key: (i: number) => Array.from(map.keys())[i] ?? null,
        removeItem: (k: string) => map.delete(k),
        setItem: (k: string, v: string) => void map.set(k, v),
    } as Storage;
}

function lesson(over: Partial<CustomPathLesson> = {}): CustomPathLesson {
    return {source: "bundled:x", setId: "fr-a1", filename: "01.json", ...over};
}

function progress(over: Partial<LessonProgress> = {}): LessonProgress {
    return {
        id: "p1",
        user_id: "u1",
        source: "bundled:x",
        set_id: "fr-a1",
        lesson_filename: "01.json",
        status: "completed",
        step_results: {},
        score_correct: 10,
        score_total: 10,
        time_spent_seconds: 0,
        current_step: 0,
        started_at: "2026-06-01T10:00:00.000Z",
        updated_at: "2026-06-01T10:00:00.000Z",
        completed_at: "2026-06-01T10:00:00.000Z",
        paused_at: null,
        abandoned_at: null,
        ...over,
    };
}

let storage: Storage;
beforeEach(() => {
    storage = fakeStorage();
});

describe("create + list + rename + delete", () => {
    it("creates a path and reads it back", () => {
        const created = createCustomPath("My path", "notes", storage);
        expect(created.id).toBeTruthy();
        expect(created.name).toBe("My path");
        expect(created.description).toBe("notes");
        expect(created.lessons).toEqual([]);
        const list = listCustomPaths(storage);
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe(created.id);
    });

    it("trims the name and drops a blank description", () => {
        const created = createCustomPath("  Trimmed  ", "   ", storage);
        expect(created.name).toBe("Trimmed");
        expect(created.description).toBeUndefined();
    });

    it("renames a path and updates the description", () => {
        const created = createCustomPath("Old", undefined, storage);
        const updated = renameCustomPath(
            created.id,
            "New",
            "added",
            storage,
        );
        expect(updated?.name).toBe("New");
        expect(updated?.description).toBe("added");
        expect(listCustomPaths(storage)[0].name).toBe("New");
    });

    it("clears the description when renamed with a blank one", () => {
        const created = createCustomPath("P", "had desc", storage);
        const updated = renameCustomPath(created.id, "P", "  ", storage);
        expect(updated?.description).toBeUndefined();
        expect("description" in (updated ?? {})).toBe(false);
    });

    it("returns null when renaming an unknown id", () => {
        expect(renameCustomPath("nope", "x", undefined, storage)).toBeNull();
    });

    it("deletes a path (idempotent)", () => {
        const created = createCustomPath("P", undefined, storage);
        deleteCustomPath(created.id, storage);
        expect(listCustomPaths(storage)).toHaveLength(0);
        // Deleting again is a no-op.
        expect(deleteCustomPath(created.id, storage)).toEqual([]);
    });

    it("lists newest-created first", () => {
        const a = createCustomPath("A", undefined, storage);
        // Force a later createdAt for the second path.
        const raw = JSON.parse(
            storage.getItem("adaptive-learner.custom-paths")!,
        );
        raw[0].createdAt = "2026-06-01T00:00:00.000Z";
        storage.setItem("adaptive-learner.custom-paths", JSON.stringify(raw));
        const b = createCustomPath("B", undefined, storage);
        const list = listCustomPaths(storage);
        expect(list.map((p) => p.id)).toEqual([b.id, a.id]);
    });
});

describe("add + remove lessons", () => {
    it("adds a lesson to a path", () => {
        const p = createCustomPath("P", undefined, storage);
        const updated = addLessonToPath(p.id, lesson(), storage);
        expect(updated?.lessons).toHaveLength(1);
        expect(updated?.lessons[0]).toEqual(lesson());
    });

    it("does not add a duplicate lesson", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson(), storage);
        const updated = addLessonToPath(p.id, lesson(), storage);
        expect(updated?.lessons).toHaveLength(1);
    });

    it("treats different filenames as distinct lessons", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson({filename: "01.json"}), storage);
        const updated = addLessonToPath(
            p.id,
            lesson({filename: "02.json"}),
            storage,
        );
        expect(updated?.lessons).toHaveLength(2);
    });

    it("removes a lesson by triple", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson({filename: "01.json"}), storage);
        addLessonToPath(p.id, lesson({filename: "02.json"}), storage);
        const updated = removeLessonFromPath(
            p.id,
            lesson({filename: "01.json"}),
            storage,
        );
        expect(updated?.lessons.map((l) => l.filename)).toEqual(["02.json"]);
    });

    it("returns null when adding to an unknown path", () => {
        expect(addLessonToPath("nope", lesson(), storage)).toBeNull();
    });
});

describe("reorder", () => {
    function threeLesson() {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson({filename: "01.json"}), storage);
        addLessonToPath(p.id, lesson({filename: "02.json"}), storage);
        addLessonToPath(p.id, lesson({filename: "03.json"}), storage);
        return p;
    }

    it("moves a lesson up", () => {
        const p = threeLesson();
        const updated = moveLessonInPath(p.id, 1, "up", storage);
        expect(updated?.lessons.map((l) => l.filename)).toEqual([
            "02.json",
            "01.json",
            "03.json",
        ]);
    });

    it("moves a lesson down", () => {
        const p = threeLesson();
        const updated = moveLessonInPath(p.id, 1, "down", storage);
        expect(updated?.lessons.map((l) => l.filename)).toEqual([
            "01.json",
            "03.json",
            "02.json",
        ]);
    });

    it("is a no-op moving the first lesson up (lower bound)", () => {
        const p = threeLesson();
        const updated = moveLessonInPath(p.id, 0, "up", storage);
        expect(updated?.lessons.map((l) => l.filename)).toEqual([
            "01.json",
            "02.json",
            "03.json",
        ]);
    });

    it("is a no-op moving the last lesson down (upper bound)", () => {
        const p = threeLesson();
        const updated = moveLessonInPath(p.id, 2, "down", storage);
        expect(updated?.lessons.map((l) => l.filename)).toEqual([
            "01.json",
            "02.json",
            "03.json",
        ]);
    });

    it("is a no-op for an out-of-range index", () => {
        const p = threeLesson();
        const updated = moveLessonInPath(p.id, 9, "up", storage);
        expect(updated?.lessons).toHaveLength(3);
    });
});

describe("customPathProgress", () => {
    it("counts completed lessons and finds the next", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson({filename: "01.json"}), storage);
        addLessonToPath(p.id, lesson({filename: "02.json"}), storage);
        addLessonToPath(p.id, lesson({filename: "03.json"}), storage);
        const path = listCustomPaths(storage)[0];
        const rows = [
            progress({lesson_filename: "01.json", status: "completed"}),
            progress({lesson_filename: "02.json", status: "in_progress"}),
        ];
        const result = customPathProgress(path, rows);
        expect(result.done).toBe(1);
        expect(result.total).toBe(3);
        expect(result.nextLesson?.filename).toBe("02.json");
    });

    it("returns null nextLesson when fully completed", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(p.id, lesson({filename: "01.json"}), storage);
        const path = listCustomPaths(storage)[0];
        const rows = [
            progress({lesson_filename: "01.json", status: "completed"}),
        ];
        const result = customPathProgress(path, rows);
        expect(result.done).toBe(1);
        expect(result.total).toBe(1);
        expect(result.nextLesson).toBeNull();
    });

    it("returns null nextLesson and zero totals for an empty path", () => {
        const p = createCustomPath("Empty", undefined, storage);
        const path = listCustomPaths(storage).find((x) => x.id === p.id)!;
        const result = customPathProgress(path, []);
        expect(result).toEqual({done: 0, total: 0, nextLesson: null});
    });

    it("matches completion by full source+set+filename triple", () => {
        const p = createCustomPath("P", undefined, storage);
        addLessonToPath(
            p.id,
            lesson({setId: "fr-a1", filename: "01.json"}),
            storage,
        );
        const path = listCustomPaths(storage)[0];
        // A completed row for a DIFFERENT set with the same filename
        // must NOT count.
        const rows = [
            progress({
                set_id: "es-a1",
                lesson_filename: "01.json",
                status: "completed",
            }),
        ];
        const result = customPathProgress(path, rows);
        expect(result.done).toBe(0);
        expect(result.nextLesson?.filename).toBe("01.json");
    });
});

describe("resilience", () => {
    it("returns an empty list for corrupt storage", () => {
        storage.setItem("adaptive-learner.custom-paths", "{not json");
        expect(listCustomPaths(storage)).toEqual([]);
    });

    it("ignores malformed entries", () => {
        storage.setItem(
            "adaptive-learner.custom-paths",
            JSON.stringify([{nope: true}, {bad: 1}]),
        );
        expect(listCustomPaths(storage)).toEqual([]);
    });
});
