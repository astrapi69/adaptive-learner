/**
 * Unit tests for the pure edit-session helpers (#1971): set-metadata
 * preservation on a multi-lesson save, prefill construction, and the picker
 * label.
 */

import {describe, expect, it} from "vitest";

import {
    buildEditPrefill,
    editSnapshot,
    lessonPickerLabel,
    mergeEditedLessonIntoSet,
    resolveEditLessonIndex,
    withPreservedSetBook,
} from "./edit-session";
import type {
    ContentLesson,
    ContentSetEntry,
    SaveUserSetInput,
} from "../../../../storage/types";

const t = (_k: string, fallback?: string) => fallback ?? _k;

function lesson(id: string, title: string): ContentLesson {
    return {
        id,
        title,
        description: null,
        target_language: "de",
        source_language: "de",
        estimated_minutes: 5,
        cards: [],
        steps: [{id: "th", type: "theory", title: "T", body: "Body"}],
        contributed_by: null,
        contributed_at: null,
    };
}

function entry(): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "main",
        id: "created-buch",
        title: "Set Title",
        title_native: "Set Native",
        language: "de",
        target_language: "de",
        source_language: "de",
        level: "B1",
        domain: "imported",
        version: "1.0.0",
        lesson_count: 2,
        description: "Set description",
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
    } as ContentSetEntry;
}

function baseInput(title: string): SaveUserSetInput {
    return {
        set_id: "created-buch",
        title,
        title_native: title,
        language: "de",
        target_language: "de",
        source_language: "de",
        level: "A1",
        origin: "imported",
        description: null,
        lessons: [lesson("l0", title)],
    };
}

describe("resolveEditLessonIndex (#2210)", () => {
    const lessons = [lesson("epilog", "Epilog"), lesson("kapitel-1", "K1"), lesson("kapitel-2", "K2")];

    it("targets the requested lesson by {id}.json filename, not the first", () => {
        expect(resolveEditLessonIndex(lessons, "kapitel-2.json")).toBe(2);
    });

    it("accepts the bare id too (folded rows carry the id without .json)", () => {
        expect(resolveEditLessonIndex(lessons, "kapitel-1")).toBe(1);
    });

    it("falls back to 0 for an absent, empty, or unknown lesson param (backward compatible)", () => {
        expect(resolveEditLessonIndex(lessons)).toBe(0);
        expect(resolveEditLessonIndex(lessons, "")).toBe(0);
        expect(resolveEditLessonIndex(lessons, null)).toBe(0);
        expect(resolveEditLessonIndex(lessons, "does-not-exist.json")).toBe(0);
    });
});

describe("withPreservedSetBook (#1989)", () => {
    it("carries the entry's book block onto the input", () => {
        const e = entry();
        e.book = {title: "A Book", author: "Someone", url: null, asin: null};
        const out = withPreservedSetBook(baseInput("t"), e);
        expect(out.book).toEqual({
            title: "A Book",
            author: "Someone",
            url: null,
            asin: null,
        });
    });

    it("leaves the input untouched (no forced empty book) when the entry has none", () => {
        const base = baseInput("t");
        expect(withPreservedSetBook(base, entry())).toBe(base);
        expect(withPreservedSetBook(base, undefined)).toBe(base);
        expect(base.book).toBeUndefined();
    });
});

describe("mergeEditedLessonIntoSet (#1971)", () => {
    it("single-lesson set: returns the base input unchanged", () => {
        const edited = lesson("l0", "Edited");
        const base = baseInput("Edited");
        const out = mergeEditedLessonIntoSet(
            base,
            {lessons: [lesson("l0", "orig")], editIndex: 0, entry: entry()},
            edited,
        );
        expect(out).toBe(base);
    });

    it("multi-lesson set: preserves set metadata from the entry and replaces only the edited lesson", () => {
        const lessons = [lesson("l0", "Section A"), lesson("l1", "Section B")];
        const edited = lesson("l1", "Section B edited");
        // base was built from the edited lesson's meta (title "Section B edited").
        const out = mergeEditedLessonIntoSet(
            baseInput("Section B edited"),
            {lessons, editIndex: 1, entry: entry()},
            edited,
        );
        // Set-level metadata comes from the entry, NOT the edited lesson.
        expect(out.title).toBe("Set Title");
        expect(out.title_native).toBe("Set Native");
        expect(out.level).toBe("B1");
        expect(out.description).toBe("Set description");
        // Only the edited lesson is replaced; the sibling survives.
        expect(out.lessons).toHaveLength(2);
        expect(out.lessons[0].title).toBe("Section A");
        expect(out.lessons[1].title).toBe("Section B edited");
    });

    it("multi-lesson set without an entry: keeps the base metadata but still swaps the lesson", () => {
        const lessons = [lesson("l0", "A"), lesson("l1", "B")];
        const edited = lesson("l0", "A edited");
        const out = mergeEditedLessonIntoSet(
            baseInput("A edited"),
            {lessons, editIndex: 0, entry: undefined},
            edited,
        );
        expect(out.title).toBe("A edited");
        expect(out.lessons[0].title).toBe("A edited");
        expect(out.lessons[1].title).toBe("B");
    });
});

describe("buildEditPrefill (#1971)", () => {
    it("derives a cardless prefill + stable snapshot for a theory lesson", () => {
        const l = lesson("l0", "A");
        const p = buildEditPrefill(l, entry(), t);
        expect(p.cardless).toBe(true);
        expect(p.lessonId).toBe("l0");
        expect(p.meta.title).toBe("A");
        expect(p.meta.level).toBe("B1"); // from the entry
        expect(p.snapshot).toBe(editSnapshot(p.meta, p.cards, p.exercises));
    });
});

describe("lessonPickerLabel", () => {
    it("uses the title, falling back to a 1-based index for a blank title", () => {
        expect(lessonPickerLabel(lesson("l0", "Real Title"), 0)).toBe(
            "Real Title",
        );
        expect(lessonPickerLabel(lesson("l1", "   "), 2)).toBe("Lesson 3");
    });
});
