/**
 * Tests for the atomic learner-data deletion (#1445 Parts B + C). Deletion is
 * user-scoped + isolated (other repos'/users' rows survive), spans both tables
 * in one transaction, and returns real counts.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { _resetDbForTests, getDb } from "../dexie/db";
import { recordElementAttemptsDexie } from "./element-errors-dexie";
import { upsertLessonProgressDexie } from "./lesson-progress-dexie";
import { deleteLearningDataDexie } from "./orphan-data-dexie";
import type { ElementAttempt } from "../types";

const USER = "user-1";

function attempt(overrides: Partial<ElementAttempt> = {}): ElementAttempt {
  return {
    set_id: "waehrung",
    lesson_id: "01.json",
    exercise_id: "ex-1",
    element_key: "geld",
    element_type: "vocabulary",
    user_answer: "x",
    correct_answer: "y",
    correct: false,
    ...overrides,
  };
}

async function seedProgress(source: string, setId: string, filename: string) {
  return upsertLessonProgressDexie(USER, {
    source,
    set_id: setId,
    lesson_filename: filename,
    mark_paused: true,
  });
}

beforeEach(async () => {
  const db = getDb();
  try {
    await db.lessonProgress.clear();
    await db.elementErrors.clear();
  } catch {
    /* fresh DB */
  }
  await _resetDbForTests();
});

describe("deleteLearningDataDexie (#1445)", () => {
  it("deletes the given progress rows + cards atomically and reports counts", async () => {
    const p1 = await seedProgress("jane/repo", "waehrung", "01.json");
    const p2 = await seedProgress("jane/repo", "waehrung", "02.json");
    await recordElementAttemptsDexie(USER, [
      attempt({set_id: "waehrung", element_key: "geld"}),
      attempt({set_id: "waehrung", element_key: "wert"}),
    ]);

    const result = await deleteLearningDataDexie(USER, {
      lessonProgressIds: [p1.id, p2.id],
      setIds: ["waehrung"],
    });

    expect(result.lessonsDeleted).toBe(2);
    expect(result.cardsDeleted).toBeGreaterThanOrEqual(2);
    const db = getDb();
    expect(await db.lessonProgress.count()).toBe(0);
    expect(await db.elementErrors.count()).toBe(0);
  });

  it("is ISOLATED — another repo's progress + cards survive (#1445 critical)", async () => {
    const gone = await seedProgress("jane/repo", "waehrung", "01.json");
    await seedProgress("bob/keep", "other-set", "01.json");
    await recordElementAttemptsDexie(USER, [
      attempt({set_id: "waehrung", element_key: "geld"}),
      attempt({set_id: "other-set", element_key: "keep-me"}),
    ]);

    await deleteLearningDataDexie(USER, {
      lessonProgressIds: [gone.id],
      setIds: ["waehrung"],
    });

    const db = getDb();
    const survivingProgress = await db.lessonProgress.toArray();
    expect(survivingProgress.map((r) => r.set_id)).toEqual(["other-set"]);
    const survivingCards = await db.elementErrors.toArray();
    expect(survivingCards.every((c) => c.set_id === "other-set")).toBe(true);
    expect(survivingCards.length).toBeGreaterThan(0);
  });

  it("never touches ANOTHER user's rows", async () => {
    const mine = await seedProgress("jane/repo", "waehrung", "01.json");
    await upsertLessonProgressDexie("user-2", {
      source: "jane/repo",
      set_id: "waehrung",
      lesson_filename: "01.json",
      mark_paused: true,
    });
    await recordElementAttemptsDexie("user-2", [
      attempt({set_id: "waehrung", element_key: "geld"}),
    ]);

    await deleteLearningDataDexie(USER, {
      lessonProgressIds: [mine.id],
      setIds: ["waehrung"],
    });

    const db = getDb();
    // user-2's progress + card remain despite sharing source + set id.
    const others = await db.lessonProgress
      .where("user_id")
      .equals("user-2")
      .count();
    expect(others).toBe(1);
    const otherCards = await db.elementErrors
      .where("user_id")
      .equals("user-2")
      .count();
    expect(otherCards).toBeGreaterThan(0);
  });

  it("is a no-op with empty inputs", async () => {
    const result = await deleteLearningDataDexie(USER, {
      lessonProgressIds: [],
      setIds: [],
    });
    expect(result).toEqual({lessonsDeleted: 0, cardsDeleted: 0});
  });
});

describe("deleteLearningDataDexie lessonCards (#2064 single-lesson delete)", () => {
  it("deletes only the target lesson's cards, keeping sibling lessons", async () => {
    const p1 = await seedProgress("user-generated", "book42", "01-intro.json");
    await seedProgress("user-generated", "book42", "02-body.json");
    await recordElementAttemptsDexie(USER, [
      attempt({set_id: "book42", lesson_id: "01-intro.json", element_key: "a"}),
      attempt({set_id: "book42", lesson_id: "01-intro.json", element_key: "b"}),
      attempt({set_id: "book42", lesson_id: "02-body.json", element_key: "c"}),
    ]);

    const result = await deleteLearningDataDexie(USER, {
      lessonProgressIds: [p1.id],
      setIds: [],
      lessonCards: [{set_id: "book42", lesson_id: "01-intro.json"}],
    });

    expect(result.lessonsDeleted).toBe(1);
    expect(result.cardsDeleted).toBe(2);
    const db = getDb();
    // Sibling lesson's progress + card survive.
    const progress = await db.lessonProgress.toArray();
    expect(progress.map((r) => r.lesson_filename)).toEqual(["02-body.json"]);
    const cards = await db.elementErrors.toArray();
    expect(cards.every((c) => c.lesson_id === "02-body.json")).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("never touches another user's cards for the same set+lesson", async () => {
    await recordElementAttemptsDexie(USER, [
      attempt({set_id: "book42", lesson_id: "01-intro.json", element_key: "a"}),
    ]);
    await recordElementAttemptsDexie("user-2", [
      attempt({set_id: "book42", lesson_id: "01-intro.json", element_key: "a"}),
    ]);

    await deleteLearningDataDexie(USER, {
      lessonProgressIds: [],
      setIds: [],
      lessonCards: [{set_id: "book42", lesson_id: "01-intro.json"}],
    });

    const db = getDb();
    const mine = await db.elementErrors.where("user_id").equals(USER).count();
    const theirs = await db.elementErrors.where("user_id").equals("user-2").count();
    expect(mine).toBe(0);
    expect(theirs).toBe(1);
  });
});

describe("deleteLearningDataDexie lessonCards (#2065 bulk multi-lesson delete)", () => {
  it("deletes SEVERAL lessons' progress + cards in one atomic call, keeping a non-selected sibling", async () => {
    const p1 = await seedProgress("user-generated", "book42", "01-intro.json");
    const p2 = await seedProgress("user-generated", "book42", "02-body.json");
    await seedProgress("user-generated", "book42", "03-keep.json");
    await recordElementAttemptsDexie(USER, [
      attempt({set_id: "book42", lesson_id: "01-intro.json", element_key: "a"}),
      attempt({set_id: "book42", lesson_id: "02-body.json", element_key: "b"}),
      attempt({set_id: "book42", lesson_id: "02-body.json", element_key: "c"}),
      attempt({set_id: "book42", lesson_id: "03-keep.json", element_key: "d"}),
    ]);

    // One call carrying the whole selection (two lessons) — mirrors the
    // aggregated plan the orchestrator builds.
    const result = await deleteLearningDataDexie(USER, {
      lessonProgressIds: [p1.id, p2.id],
      setIds: [],
      lessonCards: [
        {set_id: "book42", lesson_id: "01-intro.json"},
        {set_id: "book42", lesson_id: "02-body.json"},
      ],
    });

    expect(result.lessonsDeleted).toBe(2);
    expect(result.cardsDeleted).toBe(3); // 1 (01) + 2 (02)
    const db = getDb();
    // The non-selected sibling keeps BOTH its progress row and its card.
    const progress = await db.lessonProgress.toArray();
    expect(progress.map((r) => r.lesson_filename)).toEqual(["03-keep.json"]);
    const cards = await db.elementErrors.toArray();
    expect(cards.every((c) => c.lesson_id === "03-keep.json")).toBe(true);
    expect(cards.length).toBe(1);
  });
});
