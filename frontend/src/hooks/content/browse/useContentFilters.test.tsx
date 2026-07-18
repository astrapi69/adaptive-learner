/**
 * useContentFilters (#1793).
 *
 * Direct hook pins for the Content-Browser filter concern: default
 * status projection, source filtering incl. the dynamic menu
 * options, the #1386 search-AND-filter, and the one-tap reset.
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {useContentFilters} from "./useContentFilters";
import type {ContentSearchResult} from "../../../lib/content/browse/content-search";
import type {ContentSetEntry} from "../../../storage/types";

const t = (_key: string, fallback: string) => fallback;

function entry(
  id: string,
  source: string,
  status: ContentSetEntry["status"] = "active",
): ContentSetEntry {
  return {id, source, status} as unknown as ContentSetEntry;
}

const OFFICIAL = "astrapi69/adaptive-learner-content";

const SETS = [
  entry("fr-a1", OFFICIAL),
  entry("es-a1", OFFICIAL, "completed"),
  entry("coach-set", "jane/coach"),
];

const EMPTY_SEARCH: ContentSearchResult = {
  active: false,
  query: "",
  matches: [],
  lessonCount: 0,
} as unknown as ContentSearchResult;

function mount(searchResult: ContentSearchResult = EMPTY_SEARCH) {
  return renderHook(() =>
    useContentFilters({
      t,
      sets: SETS,
      downloadedSets: SETS,
      searchResult,
    }),
  );
}

describe("useContentFilters", () => {
  it("defaults to the active status and shows only active sets", () => {
    const {result} = mount();
    expect(result.current.statusFilter).toBe("active");
    expect(result.current.visibleSets.map((s) => s.id)).toEqual([
      "fr-a1",
      "coach-set",
    ]);
  });

  it("derives the source options from official + user repos", () => {
    const {result} = mount();
    expect(result.current.sourceOptions.map((o) => o.value)).toEqual([
      "all",
      "official",
      "jane/coach",
    ]);
  });

  it("filters by a specific user-repo source", () => {
    const {result} = mount();
    act(() => result.current.setSourceFilter("jane/coach"));
    expect(result.current.visibleSets.map((s) => s.id)).toEqual([
      "coach-set",
    ]);
  });

  it("drops search matches whose set fails the active filters (#1386)", () => {
    const search = {
      active: true,
      query: "x",
      matches: [
        {source: OFFICIAL, setId: "fr-a1", matchedLessons: [1, 2]},
        {source: OFFICIAL, setId: "es-a1", matchedLessons: [1]},
      ],
      lessonCount: 3,
    } as unknown as ContentSearchResult;
    const {result} = mount(search);
    expect(
      result.current.filteredSearchResult.matches.map(
        (m: {setId: string}) => m.setId,
      ),
    ).toEqual(["fr-a1"]);
    expect(result.current.filteredSearchResult.lessonCount).toBe(2);
  });

  it("resetFilters restores all/all and every set becomes visible", () => {
    const {result} = mount();
    act(() => {
      result.current.setStatusFilter("completed");
      result.current.setSourceFilter("official");
    });
    expect(result.current.visibleSets.map((s) => s.id)).toEqual(["es-a1"]);
    act(() => result.current.resetFilters());
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.sourceFilter).toBe("all");
    expect(result.current.visibleSets).toHaveLength(SETS.length);
  });
});
