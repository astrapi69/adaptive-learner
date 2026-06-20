/**
 * Tests for user-generated sets ("My Lessons") in Dexie mode
 * (Phase 59B/C / v1.42.0). Saves a generated lesson into the same
 * IndexedDB tables as downloaded sets and verifies it lists, plays,
 * overwrites, and deletes. No network: ``listSetsDexie([])`` skips
 * upstream sources and surfaces the user-generated rows directly.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSetDexie,
  getLessonDexie,
  listLessonsDexie,
  listSetsDexie,
  saveUserSetDexie,
} from "./content/content-loader-dexie";
import { _resetDbForTests } from "./db/db";
import { USER_GENERATED_SOURCE } from "./types";
import { generateLessonFromAnalysis } from "../lib/content/analysis-to-lesson";
import type { ConversationAnalysisResult } from "../types/domain";

const ANALYSIS: ConversationAnalysisResult = {
  topic: "Spanish travel",
  summary: "Ordering food and directions.",
  vocabulary: [
    {
      word: "la cuenta",
      translation: "the bill",
      example: "La cuenta, por favor.",
    },
    { word: "el agua", translation: "the water", example: "Quiero el agua." },
    {
      word: "la calle",
      translation: "the street",
      example: "La calle esta cerca.",
    },
    { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
    { word: "gracias", translation: "thank you" },
  ],
};

function lesson(id = "conv-1") {
  return generateLessonFromAnalysis(ANALYSIS, { id });
}

function saveInput(overrides: Record<string, unknown> = {}) {
  return {
    set_id: "conv-1",
    title: "Spanish travel",
    language: "es",
    level: "beginner",
    origin: "analysis" as const,
    lessons: [lesson()],
    ...overrides,
  };
}

describe("user-generated sets (Dexie / My Lessons)", () => {
  beforeEach(async () => {
    await _resetDbForTests();
  });

  it("saves, lists, and plays a user-generated lesson", async () => {
    const entry = await saveUserSetDexie(saveInput(), "2026-05-29T00:00:00Z");
    expect(entry.source).toBe(USER_GENERATED_SOURCE);
    expect(entry.id).toBe("conv-1");
    expect(entry.domain).toBe("analysis");
    expect(entry.lesson_count).toBe(1);

    // Appears in listSets (no upstream sources consulted).
    const list = await listSetsDexie([]);
    expect(
      list.sets.some(
        (s) => s.source === USER_GENERATED_SOURCE && s.id === "conv-1",
      ),
    ).toBe(true);

    // Lessons listable + playable via the existing viewer paths.
    const l = lesson();
    const lessons = await listLessonsDexie(USER_GENERATED_SOURCE, "conv-1");
    expect(lessons.lessons).toContain(`${l.id}.json`);
    const got = await getLessonDexie(
      USER_GENERATED_SOURCE,
      "conv-1",
      `${l.id}.json`,
    );
    expect(got.id).toBe(l.id);
    expect(got.steps.length).toBe(l.steps.length);
  });

  it("re-saving overwrites in place (no duplicate sets)", async () => {
    await saveUserSetDexie(saveInput({ title: "Old" }), "t1");
    const e2 = await saveUserSetDexie(saveInput({ title: "New" }), "t2");
    expect(e2.title).toBe("New");
    const list = await listSetsDexie([]);
    const matches = list.sets.filter(
      (s) => s.id === "conv-1" && s.source === USER_GENERATED_SOURCE,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("New");
  });

  it("deletes a user-generated set", async () => {
    await saveUserSetDexie(saveInput(), "t");
    await deleteSetDexie(USER_GENERATED_SOURCE, "conv-1");
    const list = await listSetsDexie([]);
    expect(list.sets.some((s) => s.id === "conv-1")).toBe(false);
  });
});
