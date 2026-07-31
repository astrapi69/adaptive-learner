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
  applyStoredLessonOrderToList,
  getLessonOrder,
  moveLessonOrder,
  readLessonOrders,
  storeImportLessonOrder,
  storeLessonOrder,
} from "./lesson-order-store";
import type { ContentLessonList } from "../../../storage/types";
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

describe("storeImportLessonOrder - source order prepopulation (#2173)", () => {
  it("records the source order when nothing is stored yet", () => {
    // A book import's lessons arrive in document order; the read overlay would
    // otherwise sort them alphabetically (epilog before kapitel-1).
    storeImportLessonOrder(SRC, SET, BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toEqual(BOOK_ORDER);
  });

  it("drives the read overlay so the listing follows the source order", () => {
    storeImportLessonOrder(SRC, SET, BOOK_ORDER);
    // listLessons returns filenames alphabetically sorted; the overlay fixes it.
    const alphabetical = [...BOOK_ORDER].sort();
    expect(applyStoredLessonOrder(alphabetical, SRC, SET)).toEqual(BOOK_ORDER);
  });

  it("is a no-op for an empty lesson list (nothing to order)", () => {
    storeImportLessonOrder(SRC, SET, []);
    expect(getLessonOrder(SRC, SET)).toBeNull();
  });

  it("a re-import (still import-origin, user never touched it) refreshes to the new source order", () => {
    storeImportLessonOrder(SRC, SET, ["a.json", "b.json", "c.json"]);
    // The book was re-imported with its chapters in a different order.
    const reordered = ["c.json", "a.json", "b.json"];
    storeImportLessonOrder(SRC, SET, reordered);
    expect(getLessonOrder(SRC, SET)).toEqual(reordered);
  });
});

describe("storeImportLessonOrder - the user's arrangement wins (#2173 Teil 3)", () => {
  it("does NOT overwrite an order the user set via a move", () => {
    // The user reordered the set by hand.
    const userOrder = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-7.json", "up");
    // A re-import / content update must not clobber that work.
    storeImportLessonOrder(SRC, SET, BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toEqual(userOrder);
  });

  it("does NOT overwrite an explicitly stored user order", () => {
    const userOrder = ["kapitel-7.json", "epilog.json", "kapitel-1.json"];
    storeLessonOrder(SRC, SET, userOrder);
    storeImportLessonOrder(SRC, SET, BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toEqual(userOrder);
  });

  it("treats a legacy bare-array order (pre-#2173, written by #2172 moves) as the user's - never overwrites it", () => {
    // #2172 persisted a bare array; those entries only ever came from a user
    // move, so an import must leave them alone.
    const legacy = ["kapitel-3.json", "kapitel-1.json", "epilog.json"];
    localStorage.setItem(KEY, JSON.stringify({ [`${SRC}::${SET}`]: legacy }));
    storeImportLessonOrder(SRC, SET, BOOK_ORDER);
    expect(getLessonOrder(SRC, SET)).toEqual(legacy);
  });

  it("Case 1: user moved + source adds new lessons -> new lessons land at the end, user order preserved", () => {
    // User arranged the set.
    const userOrder = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-5.json", "up");
    // Re-import brings two NEW lessons; the import write is a no-op (user-origin).
    const withNew = [...BOOK_ORDER, "kapitel-6.json", "anhang.json"];
    storeImportLessonOrder(SRC, SET, withNew);
    const displayed = applyStoredLessonOrder(withNew, SRC, SET);
    // The user's arrangement is intact...
    expect(displayed.slice(0, userOrder.length)).toEqual(userOrder);
    // ...and the new lessons are appended at the end, visible, not interspersed.
    expect(displayed.slice(userOrder.length)).toEqual(["kapitel-6.json", "anhang.json"]);
  });

  it("Case 2: user moved + source removes a lesson -> the remaining order is preserved", () => {
    const userOrder = moveLessonOrder(SRC, SET, BOOK_ORDER, "kapitel-7.json", "up");
    // Re-import without "epilog.json"; the import write is a no-op (user-origin).
    const withoutEpilog = BOOK_ORDER.filter((f) => f !== "epilog.json");
    storeImportLessonOrder(SRC, SET, withoutEpilog);
    const displayed = applyStoredLessonOrder(withoutEpilog, SRC, SET);
    // The dropped lesson is gone; every remaining lesson keeps the user's order.
    expect(displayed).toEqual(userOrder.filter((f) => f !== "epilog.json"));
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

describe("applyStoredLessonOrderToList (#2212) - the listLessons seam", () => {
  const NATURAL: ContentLessonList = {
    set_id: SET,
    source: SRC,
    version: "1.0.0",
    lessons: ["epilog.json", "kapitel-1.json", "kapitel-2.json"],
  };

  it("orders the listing by the stored order, preserving the other fields", () => {
    storeLessonOrder(SRC, SET, ["kapitel-1.json", "kapitel-2.json", "epilog.json"]);
    const out = applyStoredLessonOrderToList(NATURAL);
    expect(out.lessons).toEqual(["kapitel-1.json", "kapitel-2.json", "epilog.json"]);
    expect(out.set_id).toBe(SET);
    expect(out.source).toBe(SRC);
    expect(out.version).toBe("1.0.0");
  });

  it("returns the SAME object when the set was never reordered (no silent resort)", () => {
    expect(applyStoredLessonOrderToList(NATURAL)).toBe(NATURAL);
  });

  it("scopes by source::set-id (a stored order for another set does not leak)", () => {
    storeLessonOrder("other", SET, ["kapitel-2.json", "epilog.json", "kapitel-1.json"]);
    expect(applyStoredLessonOrderToList(NATURAL)).toBe(NATURAL);
  });
});
