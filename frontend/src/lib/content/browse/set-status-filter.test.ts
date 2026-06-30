/**
 * set-status-filter (#1300) — the "Meine Inhalte" status filter predicate.
 *
 * Pins: "all" passes every status; a concrete filter narrows to that
 * status; a set with no ``status`` field is treated as "active" (so the
 * default active view never hides pre-#1300 cached sets).
 */

import { describe, expect, it } from "vitest";

import type { ContentSetEntry, SetStatus } from "../../../storage/types";
import { effectiveStatus, matchesStatusFilter } from "./set-status-filter";

function set(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "src",
    branch: "main",
    id: "s",
    title: "Set",
    language: "en",
    target_language: "en",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  };
}

describe("matchesStatusFilter", () => {
  it("passes every status when the filter is 'all'", () => {
    for (const s of ["active", "deferred", "completed"] as SetStatus[]) {
      expect(matchesStatusFilter(set({ status: s }), "all")).toBe(true);
    }
  });

  it("narrows to the chosen status", () => {
    expect(matchesStatusFilter(set({ status: "active" }), "active")).toBe(true);
    expect(matchesStatusFilter(set({ status: "deferred" }), "active")).toBe(false);
    expect(matchesStatusFilter(set({ status: "completed" }), "completed")).toBe(true);
    expect(matchesStatusFilter(set({ status: "active" }), "completed")).toBe(false);
  });

  it("treats a set with no status as 'active' (migration default)", () => {
    const legacy = set({});
    delete (legacy as { status?: SetStatus }).status;
    expect(effectiveStatus(legacy)).toBe("active");
    expect(matchesStatusFilter(legacy, "active")).toBe(true);
    expect(matchesStatusFilter(legacy, "deferred")).toBe(false);
  });

  it("filters a mixed list down to one status", () => {
    const sets = [
      set({ id: "a", status: "active" }),
      set({ id: "b", status: "deferred" }),
      set({ id: "c", status: "completed" }),
      set({ id: "d" }), // no status → active
    ];
    expect(sets.filter((s) => matchesStatusFilter(s, "active")).map((s) => s.id)).toEqual([
      "a",
      "d",
    ]);
    expect(sets.filter((s) => matchesStatusFilter(s, "completed")).map((s) => s.id)).toEqual([
      "c",
    ]);
    expect(sets.filter((s) => matchesStatusFilter(s, "all"))).toHaveLength(4);
  });
});
