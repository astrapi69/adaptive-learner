/**
 * Tests for content-availability (#1445 Part A). The loadable-set list is the
 * oracle; removed-repo progress + SRS rows are orphaned; official/bundled
 * progress is always available.
 */

import { describe, expect, it } from "vitest";

import {
  buildContentAvailability,
  filterAvailableProgress,
  filterAvailableSetId,
  partitionProgress,
  partitionSetId,
} from "./content-availability";

const SETS = [
  { source: "astrapi69/adaptive-learner-content", id: "psych-a" },
  { source: "bundled:adaptive-learner-content", id: "fr-a1" },
  { source: "jane/repo", id: "waehrung" },
  { source: "user-generated", id: "my-lesson" },
];

describe("buildContentAvailability", () => {
  const a = buildContentAvailability(SETS);

  it("hasSet matches an exact source+id pair", () => {
    expect(a.hasSet("jane/repo", "waehrung")).toBe(true);
    expect(a.hasSet("jane/repo", "other")).toBe(false);
    expect(a.hasSet("someone/else", "waehrung")).toBe(false);
  });

  it("hasSetId matches a bare set id from any source", () => {
    expect(a.hasSetId("waehrung")).toBe(true);
    expect(a.hasSetId("fr-a1")).toBe(true);
    expect(a.hasSetId("gone")).toBe(false);
  });

  it("isProgressAvailable requires an exact pair for a user repo", () => {
    expect(a.isProgressAvailable("jane/repo", "waehrung")).toBe(true);
    expect(a.isProgressAvailable("jane/repo", "removed-set")).toBe(false);
  });

  it("isProgressAvailable is always true for official/bundled sources", () => {
    // Even for an id NOT in the list (transient dedup churn), these
    // non-removable sources are never orphaned.
    expect(
      a.isProgressAvailable("astrapi69/adaptive-learner-content", "anything"),
    ).toBe(true);
    expect(a.isProgressAvailable("bundled:adaptive-learner-content", "x")).toBe(
      true,
    );
  });

  it("user-generated progress needs an exact hit - ghosts are orphaned (#1816)", () => {
    // A user-generated set that actually exists appears in listSets (both
    // storage modes cache it), so the exact-hit path covers it; a Dexie-era
    // ghost row whose set never existed on this backend is hidden.
    expect(a.isProgressAvailable("user-generated", "my-lesson")).toBe(true);
    expect(a.isProgressAvailable("user-generated", "ghost-lesson")).toBe(false);
  });
});

describe("cached_version gates loadability (#1816)", () => {
  // API mode lists every set of a registered repo in the index regardless of
  // download state; cached_version: null marks 'not downloaded' in BOTH
  // storage modes. An index-only entry must not count as loadable.
  const ENTRIES = [
    { source: "jane/repo", id: "downloaded-set", cached_version: "1.0.0" },
    { source: "jane/repo", id: "index-only-set", cached_version: null },
    {
      source: "astrapi69/alc-die-waehrung-des-geistes",
      id: "waehrung-des-geistes",
      cached_version: null,
    },
    { source: "bundled:adaptive-learner-content", id: "fr-a1" },
  ];
  const a = buildContentAvailability(ENTRIES);

  it("a downloaded set is loadable", () => {
    expect(a.hasSet("jane/repo", "downloaded-set")).toBe(true);
    expect(a.isProgressAvailable("jane/repo", "downloaded-set")).toBe(true);
  });

  it("an index-listed but NOT-downloaded set is not loadable (the 404 repro)", () => {
    expect(a.hasSet("jane/repo", "index-only-set")).toBe(false);
    expect(a.isProgressAvailable("jane/repo", "index-only-set")).toBe(false);
    expect(
      a.isProgressAvailable(
        "astrapi69/alc-die-waehrung-des-geistes",
        "waehrung-des-geistes",
      ),
    ).toBe(false);
  });

  it("hasSetId ignores not-downloaded entries too", () => {
    expect(a.hasSetId("downloaded-set")).toBe(true);
    expect(a.hasSetId("index-only-set")).toBe(false);
  });

  it("an entry WITHOUT the cached_version field stays loadable (plain SetKey callers)", () => {
    expect(a.hasSet("bundled:adaptive-learner-content", "fr-a1")).toBe(true);
  });

  it("official sources stay always available even when their entry is uncached", () => {
    const officialUncached = buildContentAvailability([
      {
        source: "astrapi69/adaptive-learner-content",
        id: "psych-a",
        cached_version: null,
      },
    ]);
    expect(
      officialUncached.isProgressAvailable(
        "astrapi69/adaptive-learner-content",
        "psych-a",
      ),
    ).toBe(true);
  });
});

describe("filtering + partitioning", () => {
  it("filterAvailableProgress drops rows whose source repo was removed", () => {
    const availability = buildContentAvailability(
      SETS.filter((s) => s.source !== "jane/repo"), // jane/repo removed
    );
    const rows = [
      { source: "jane/repo", set_id: "waehrung", n: 1 },
      { source: "astrapi69/adaptive-learner-content", set_id: "psych-a", n: 2 },
    ];
    const kept = filterAvailableProgress(rows, availability);
    expect(kept.map((r) => r.n)).toEqual([2]);
  });

  it("partitionProgress separates orphaned rows without losing them", () => {
    const availability = buildContentAvailability(
      SETS.filter((s) => s.source !== "jane/repo"),
    );
    const rows = [
      { source: "jane/repo", set_id: "waehrung" },
      { source: "user-generated", set_id: "my-lesson" },
    ];
    const { available, orphaned } = partitionProgress(rows, availability);
    expect(available).toHaveLength(1);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].source).toBe("jane/repo");
  });

  it("filterAvailableSetId drops SRS rows whose set id is no longer loadable", () => {
    const availability = buildContentAvailability(
      SETS.filter((s) => s.source !== "jane/repo"),
    );
    const rows = [{ set_id: "waehrung" }, { set_id: "fr-a1" }];
    expect(filterAvailableSetId(rows, availability)).toEqual([
      { set_id: "fr-a1" },
    ]);
  });

  it("partitionSetId keeps a card whose id is still loadable via another repo", () => {
    // jane/repo removed, but bundled still carries fr-a1 → its cards stay.
    const availability = buildContentAvailability(
      SETS.filter((s) => s.source !== "jane/repo"),
    );
    const rows = [{ set_id: "fr-a1" }, { set_id: "waehrung" }];
    const { available, orphaned } = partitionSetId(rows, availability);
    expect(available).toEqual([{ set_id: "fr-a1" }]);
    expect(orphaned).toEqual([{ set_id: "waehrung" }]);
  });
});
