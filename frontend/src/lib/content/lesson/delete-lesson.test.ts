/**
 * Tests for the pure single-lesson delete helpers (#2064). The content removal
 * is a re-save of the set without the target lesson; siblings keep their ids
 * (no renumbering), and set-level metadata is preserved.
 */

import { describe, expect, it } from "vitest";

import {
  buildUserSetInputFromEntry,
  isUserGeneratedSet,
  lessonFilename,
  removeLessonFromSet,
} from "./delete-lesson";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

function lesson(id: string, title = id): ContentLesson {
  return { id, title, cards: [], steps: [] } as unknown as ContentLesson;
}

function entry(overrides: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "",
    id: "book42",
    title: "Mein Buch",
    title_native: "My Book",
    language: "de",
    target_language: "de",
    source_language: "en",
    level: "A1",
    domain: "imported",
    version: "user",
    lesson_count: 3,
    description: "Aus einem Buch",
    tags: [],
    cover_image: null,
    cached_version: "user",
    update_available: false,
    book: null,
    ...overrides,
  } as ContentSetEntry;
}

describe("lessonFilename", () => {
  it("mirrors the lessons/{id}.json cache layout (bare filename)", () => {
    expect(lessonFilename(lesson("01-intro"))).toBe("01-intro.json");
  });
});

describe("isUserGeneratedSet", () => {
  it("is true only for the user-generated source", () => {
    expect(isUserGeneratedSet(entry())).toBe(true);
    expect(isUserGeneratedSet(entry({ source: "jane/repo" }))).toBe(false);
  });
});

describe("removeLessonFromSet", () => {
  const lessons = [lesson("01-intro"), lesson("02-body"), lesson("03-end")];

  it("removes the target lesson and preserves siblings + set metadata", () => {
    const result = removeLessonFromSet(entry(), lessons, "02-body.json");
    expect(result.found).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.input?.lessons.map((l) => l.id)).toEqual(["01-intro", "03-end"]);
    expect(result.input?.title).toBe("Mein Buch");
    expect(result.input?.level).toBe("A1");
    expect(result.input?.set_id).toBe("book42");
    expect(result.input?.source_language).toBe("en");
  });

  it("does NOT renumber the surviving lessons (keeps their ids/filenames)", () => {
    const result = removeLessonFromSet(entry(), lessons, "01-intro.json");
    expect(result.input?.lessons.map((l) => l.id)).toEqual(["02-body", "03-end"]);
  });

  it("returns input=null when the removed lesson was the last one", () => {
    const result = removeLessonFromSet(entry(), [lesson("only")], "only.json");
    expect(result.found).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.input).toBeNull();
  });

  it("is a no-op (found=false) when the filename matches no lesson", () => {
    const result = removeLessonFromSet(entry(), lessons, "99-missing.json");
    expect(result.found).toBe(false);
    expect(result.input).toBeNull();
    expect(result.remaining).toBe(3);
  });
});

describe("buildUserSetInputFromEntry", () => {
  it("carries the set-level book block (#1743)", () => {
    const book = { title: "Ref", author: "A" } as ContentSetEntry["book"];
    const input = buildUserSetInputFromEntry(entry({ book }), [lesson("01")]);
    expect(input.book).toEqual(book);
  });
});
