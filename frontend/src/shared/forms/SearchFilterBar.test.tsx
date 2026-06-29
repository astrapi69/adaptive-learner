/**
 * Tests for SearchFilterBar — the compact Search/Filter toggle bar.
 *
 * RED-first (TDD): pins the four behaviours the feature requires —
 *   1. filters collapsed by default (only the bar + search field show),
 *   2. "Filter" opens the panel with the current filter values prefilled,
 *   3. "Search" collapses the panel and keeps the (controlled) search field,
 *   4. the panels are mutually exclusive (opening one closes the other),
 * plus the a11y contract on the filter button (aria-expanded / aria-controls).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import SearchFilterBar from "./SearchFilterBar";
import type { FilterDef } from "./FilterBar";

function Harness() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("a1");
  const filters: FilterDef[] = [
    {
      id: "level",
      label: "Level",
      value: level,
      options: [
        { value: "", label: "All" },
        { value: "a1", label: "A1" },
        { value: "a2", label: "A2" },
      ],
    },
  ];
  return (
    <SearchFilterBar
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search…"
      searchAriaLabel="Search"
      searchTestId="my-search"
      filters={filters}
      onFilterChange={(_id, value) => setLevel(value)}
      filtersTestId="my-filters"
      searchButtonLabel="Suchen"
      filterButtonLabel="Filtern"
      testId="sfbar"
    />
  );
}

describe("SearchFilterBar", () => {
  it("shows the bar + search field but no filters by default", () => {
    render(<Harness />);
    // Both buttons present in the compact bar.
    expect(screen.getByTestId("sfbar-search-btn")).toBeInTheDocument();
    expect(screen.getByTestId("sfbar-filter-btn")).toBeInTheDocument();
    // Search field visible by default.
    expect(screen.getByTestId("my-search")).toBeInTheDocument();
    // Filters collapsed: the filter panel + its select are not rendered.
    expect(screen.queryByTestId("sfbar-filter-region")).toBeNull();
    expect(screen.queryByTestId("my-filters")).toBeNull();
    // a11y: the filter button advertises the collapsed state.
    expect(screen.getByTestId("sfbar-filter-btn")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the filter panel with the current values when 'Filter' is clicked", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("sfbar-filter-btn"));
    // Filter panel now visible.
    expect(screen.getByTestId("sfbar-filter-region")).toBeInTheDocument();
    expect(screen.getByTestId("my-filters")).toBeInTheDocument();
    // Prefilled with the currently-active value (a1), not reset to empty.
    expect(screen.getByTestId("my-filters-level")).toHaveValue("a1");
    // a11y: aria-expanded flips, aria-controls points at the panel.
    const btn = screen.getByTestId("sfbar-filter-btn");
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(btn).toHaveAttribute("aria-controls", screen.getByTestId("sfbar-filter-region").id);
    // Mutual exclusion: the search field is hidden while filtering.
    expect(screen.queryByTestId("my-search")).toBeNull();
  });

  it("collapses the filter panel and restores the search field on 'Search'", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("sfbar-filter-btn"));
    expect(screen.getByTestId("sfbar-filter-region")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sfbar-search-btn"));
    // Filters collapsed again; search field back.
    expect(screen.queryByTestId("sfbar-filter-region")).toBeNull();
    const search = screen.getByTestId("my-search");
    expect(search).toBeInTheDocument();
    // The (controlled) search still updates its value — behaviour unchanged.
    fireEvent.change(search, { target: { value: "abc" } });
    expect(screen.getByTestId("my-search")).toHaveValue("abc");
  });

  it("keeps the filter value active after the panel is collapsed", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("sfbar-filter-btn"));
    // Change the filter, then collapse via Search.
    fireEvent.change(screen.getByTestId("my-filters-level"), {
      target: { value: "a2" },
    });
    fireEvent.click(screen.getByTestId("sfbar-search-btn"));
    expect(screen.queryByTestId("sfbar-filter-region")).toBeNull();
    // Re-open: the chosen value survived the collapse (not reset).
    fireEvent.click(screen.getByTestId("sfbar-filter-btn"));
    expect(screen.getByTestId("my-filters-level")).toHaveValue("a2");
  });

  it("is mutually exclusive both ways (search⇄filter)", () => {
    render(<Harness />);
    // search → filter: search hidden, filters shown
    fireEvent.click(screen.getByTestId("sfbar-filter-btn"));
    expect(screen.queryByTestId("my-search")).toBeNull();
    expect(screen.getByTestId("sfbar-filter-region")).toBeInTheDocument();
    // filter → search: filters hidden, search shown
    fireEvent.click(screen.getByTestId("sfbar-search-btn"));
    expect(screen.queryByTestId("sfbar-filter-region")).toBeNull();
    expect(screen.getByTestId("my-search")).toBeInTheDocument();
  });
});
