/**
 * Mode-agnostic display-order persistence for the lessons inside a content set
 * (#2172).
 *
 * The hard constraint these tests pin: reordering lessons changes ONLY the
 * display order, never a lesson's identity. Lesson progress
 * (``LessonProgress`` keys on ``lesson_filename``) and SRS rows
 * (``ElementError`` key on ``lesson_id`` = filename) must stay attached after
 * a move - the order store keys BY the filename and never mutates it, so a
 * reorder is a pure permutation of the existing identities. Renumbering (which
 * WOULD orphan progress, the #2128 / EXP-045 hazard) is impossible here by
 * construction.
 *
 * These tests run against REAL ``localStorage`` (happy-dom) - no storage
 * mock - mirroring ``set-status-store`` (#2053), and model a "reload" as a
 * fresh filename array each time (what ``listLessons`` produces on remount).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  applyStoredLessonOrder,
  getLessonOrder,
  moveLessonOrder,
  readLessonOrders,
  storeLessonOrder,
} from "./lesson-order-store";
import {
  applyLocalStorageSnapshot,
  captureLocalStorageSnapshot,
  isExcludedLocalStorageKey,
} from "../../backup/localStorageSnapshot";

const KEY = "adaptive-learner.lesson-order";
const SRC = "user-generated";
const SET = "mein-buch";

/** The book set from the device report: alphabetical read-order puts the
 *  epilogue first, then chapters 1-5, then 7 (chapter 6 absent - a separate
 *  concern). The learner wants reading order. */
const BOOK_ORDER = [
  "epilog.json",
  "kapitel-1.json",
  "kapitel-2.json",
  "kapitel-3.json",
  "kapitel-4.json",
  "kapitel-5.json",
  "kapitel-7.json",
];

beforeEach(() => {
  localStorage.clear();
});

describe("lesson-order-store - persistence", () => {
  it("defaults to no stored order", () => {
    expect(getLessonOrder(SRC, SET)).toBeNull();
    expect(readLessonOrders()).toEqual({});
  });

  it("persists an explicit order", () => {
    storeLessonOrder(SRC, SET, BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toEqual(BOOK_ORDER);
    expect(readLessonOrders()).toEqual({ [`${SRC}::${SET}`]: BOOK_ORDER });
  });

  it("scopes order by source::set (same set id in two sources is independent)", () => {
    storeLessonOrder(SRC, SET, ["b.json", "a.json"]);
    storeLessonOrder("other/repo", SET, ["a.json", "b.json"]);
    expect(getLessonOrder(SRC, SET)).toEqual(["b.json", "a.json"]);
    expect(getLessonOrder("other/repo", SET)).toEqual(["a.json", "b.json"]);
  });
});

describe("lesson-order-store - read overlay (applyStoredLessonOrder)", () => {
  it("returns the natural order (same array reference) when nothing is stored", () => {
    const natural = [...BOOK_ORDER];
    // Referential stability: no override -> the caller's array is returned
    // as-is, so [lessons]-keyed effects stay stable and existing sets show
    // their current order (no silent resort).
    expect(applyStoredLessonOrder(natural, SRC, SET)).toBe(natural);
  });

  it("reorders the current filenames by the stored order", () => {
    const desired = ["kapitel-1.json", "kapitel-2.json", "epilog.json"];
    storeLessonOrder(SRC, SET, desired);
    const natural = ["epilog.json", "kapitel-1.json", "kapitel-2.json"];
    expect(applyStoredLessonOrder(natural, SRC, SET)).toEqual(desired);
  });

  it("appends a new (unknown) filename at the end in natural order (self-healing)", () => {
    storeLessonOrder(SRC, SET, ["b.json", "a.json"]);
    // "c.json" was added to the set after the order was stored.
    const natural = ["a.json", "b.json", "c.json"];
    expect(applyStoredLessonOrder(natural, SRC, SET)).toEqual([
      "b.json",
      "a.json",
      "c.json",
    ]);
  });

  it("drops a stored filename that is no longer present (self-healing)", () => {
    storeLessonOrder(SRC, SET, ["a.json", "gone.json", "b.json"]);
    const natural = ["a.json", "b.json"];
    expect(applyStoredLessonOrder(natural, SRC, SET)).toEqual(["a.json", "b.json"]);
  });
});

describe("lesson-order-store - move (immediately persistent)", () => {
  it("moves a lesson up, persists, and returns the new order", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-1.json", "up");
    expect(next.slice(0, 2)).toEqual(["kapitel-1.json", "epilog.json"]);
    // Persisted immediately - a reload overlay sees the new order.
    expect(applyStoredLessonOrder(BOOK_ORDER, SRC, SET)).toEqual(next);
  });

  it("moves a lesson down, persists, and returns the new order", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "epilog.json", "down");
    expect(next.slice(0, 2)).toEqual(["kapitel-1.json", "epilog.json"]);
    expect(getLessonOrder(SRC, SET)).toEqual(next);
  });

  it("is a no-op moving the first lesson up (edge, nothing persisted)", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "epilog.json", "up");
    expect(next).toEqual(BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toBeNull();
  });

  it("is a no-op moving the last lesson down (edge, nothing persisted)", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-7.json", "down");
    expect(next).toEqual(BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toBeNull();
  });

  it("is a no-op for an unknown filename", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "ghost.json", "up");
    expect(next).toEqual(BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toBeNull();
  });
});

describe("lesson-order-store - identity invariant (the hard constraint)", () => {
  // A learner has progress + SRS keyed on lesson filenames.
  const progress = BOOK_ORDER.map((f) => ({ lesson_filename: f }));
  const srs = [
    { lesson_id: "kapitel-1.json", exercise_id: "ex-1", element_key: "hallo" },
    { lesson_id: "kapitel-7.json", exercise_id: "ex-2", element_key: "ende" },
  ];

  it("a move is a pure permutation: the filename multiset is unchanged", () => {
    const next = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-5.json", "up");
    expect([...next].sort()).toEqual([...BOOK_ORDER].sort());
    expect(next).toHaveLength(BOOK_ORDER.length);
  });

  it("every progress + SRS row still resolves after a move (no orphan)", () => {
    let order = [...BOOK_ORDER];
    // Simulate several user moves.
    order = moveLessonOrder(SRC, SET, order, "kapitel-1.json", "up");
    order = moveLessonOrder(SRC, SET, order, "kapitel-7.json", "up");
    order = moveLessonOrder(SRC, SET, order, "epilog.json", "down");

    const present = new Set(order);
    for (const row of progress) {
      expect(present.has(row.lesson_filename)).toBe(true);
    }
    for (const row of srs) {
      expect(present.has(row.lesson_id)).toBe(true);
    }
    // No filename was renamed or invented.
    expect([...order].sort()).toEqual([...BOOK_ORDER].sort());
  });

  it("the stored order contains only existing identities (never a renumbered id)", () => {
    moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-3.json", "down");
    const stored = getLessonOrder(SRC, SET) ?? [];
    for (const filename of stored) {
      expect(BOOK_ORDER).toContain(filename);
    }
  });
});

describe("lesson-order-store - corruption tolerance", () => {
  it("returns an empty map on corrupt storage", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readLessonOrders()).toEqual({});
  });

  it("drops non-array values on read", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ [`${SRC}::${SET}`]: "nope", [`${SRC}::ok`]: ["a.json"] }),
    );
    expect(readLessonOrders()).toEqual({ [`${SRC}::ok`]: ["a.json"] });
  });

  it("drops non-string entries inside a stored order", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ [`${SRC}::${SET}`]: ["a.json", 5, null, "b.json"] }),
    );
    expect(getLessonOrder(SRC, SET)).toEqual(["a.json", "b.json"]);
  });
});

describe("lesson-order-store - backup portability (Export -> wipe -> Import)", () => {
  it("is NOT excluded from the backup snapshot (per-device UI state, not a secret)", () => {
    // Regression pin: the store key must never drift into the backup
    // exclusion list, or the lesson order would silently stop surviving a
    // restore / device migration.
    expect(isExcludedLocalStorageKey("adaptive-learner.lesson-order")).toBe(false);
  });

  it("a saved order survives a storage wipe via the .alb localStorage snapshot", () => {
    storeLessonOrder(SRC, SET, BOOK_ORDER);

    const snapshot = captureLocalStorageSnapshot();
    expect(snapshot["adaptive-learner.lesson-order"]).toBeTruthy();

    localStorage.clear();
    expect(getLessonOrder(SRC, SET)).toBeNull();

    applyLocalStorageSnapshot(snapshot);
    expect(getLessonOrder(SRC, SET)).toEqual(BOOK_ORDER);
  });
});
