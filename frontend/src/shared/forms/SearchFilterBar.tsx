/**
 * SearchFilterBar — a compact bar that toggles between a search field and a
 * filter panel, so neither takes screen space until the user asks for it.
 *
 * Mobile-first: a two-button bar ("Search" / "Filter") that mutually-exclusively
 * shows either the {@link SearchField} (the default) or the {@link FilterBar}
 * inline below. The caller owns BOTH the search value and the filter values, so
 * collapsing a panel never resets state — only its visibility changes, and the
 * applied filters keep driving the caller's result list while the panel is shut.
 *
 * App-agnostic + props-driven: labels come in via props (no i18n import),
 * token-backed Tailwind only. a11y: both buttons are 44px and keyboard-operable,
 * the filter button advertises `aria-expanded` / `aria-controls`, and focus moves
 * into the region that just opened.
 *
 * @example
 * <SearchFilterBar
 *   searchValue={query} onSearchChange={setQuery}
 *   filters={filterDefs} onFilterChange={handleFilterChange}
 *   searchButtonLabel={t("…bar.search", "Search")}
 *   filterButtonLabel={t("…bar.filter", "Filter")}
 * />
 */

import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import FilterBar, { type FilterDef } from "./FilterBar";
import SearchField from "./SearchField";

export interface SearchFilterBarProps {
  /** Controlled search value (the caller owns it + any debouncing). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  searchClearLabel?: string;
  searchTestId?: string;

  /** Filter definitions (id/label/value/options) + change handler. */
  filters: FilterDef[];
  onFilterChange: (id: string, value: string) => void;
  filtersTestId?: string;

  /** Label for the "show search" toggle button. */
  searchButtonLabel: string;
  /** Label for the "show filters" toggle button. */
  filterButtonLabel: string;

  className?: string;
  testId?: string;
}

type Mode = "search" | "filter";

export default function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  searchClearLabel,
  searchTestId = "search-field",
  filters,
  onFilterChange,
  filtersTestId = "filter-bar",
  searchButtonLabel,
  filterButtonLabel,
  className,
  testId = "search-filter-bar",
}: SearchFilterBarProps) {
  // Default to search so the prompt search field is immediately usable; the
  // filter panel stays collapsed until the user asks for it.
  const [mode, setMode] = useState<Mode>("search");
  const filtersOpen = mode === "filter";
  const panelId = `${testId}-panel`;

  const searchRegionRef = useRef<HTMLDivElement>(null);
  const filterRegionRef = useRef<HTMLDivElement>(null);
  // Only move focus on a user toggle, never on the initial mount.
  const userToggled = useRef(false);

  useEffect(() => {
    if (!userToggled.current) return;
    if (mode === "filter") {
      filterRegionRef.current
        ?.querySelector<HTMLElement>("select, input, button")
        ?.focus();
    } else {
      searchRegionRef.current?.querySelector<HTMLElement>("input")?.focus();
    }
  }, [mode]);

  const show = (next: Mode) => {
    userToggled.current = true;
    setMode(next);
  };

  return (
    <div className={className} data-testid={testId}>
      <div
        role="group"
        aria-label={`${searchButtonLabel} / ${filterButtonLabel}`}
        className="mb-3 flex flex-wrap gap-2"
      >
        <Button
          type="button"
          variant={mode === "search" ? "default" : "outline"}
          size="sm"
          aria-pressed={mode === "search"}
          onClick={() => show("search")}
          data-testid={`${testId}-search-btn`}
        >
          <Search aria-hidden="true" />
          {searchButtonLabel}
        </Button>
        <Button
          type="button"
          variant={filtersOpen ? "default" : "outline"}
          size="sm"
          aria-pressed={filtersOpen}
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          onClick={() => show("filter")}
          data-testid={`${testId}-filter-btn`}
        >
          <SlidersHorizontal aria-hidden="true" />
          {filterButtonLabel}
        </Button>
      </div>

      {mode === "search" ? (
        <div ref={searchRegionRef} data-testid={`${testId}-search-region`}>
          <SearchField
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            ariaLabel={searchAriaLabel}
            clearLabel={searchClearLabel}
            testId={searchTestId}
          />
        </div>
      ) : (
        <div
          id={panelId}
          ref={filterRegionRef}
          data-testid={`${testId}-filter-region`}
        >
          <FilterBar
            filters={filters}
            onChange={onFilterChange}
            testId={filtersTestId}
          />
        </div>
      )}
    </div>
  );
}
