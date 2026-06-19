/**
 * FilterBar — a reusable, props-driven row of labelled dropdown filters.
 *
 * App-agnostic: the caller supplies the filter definitions (id, label, current
 * value, options) and a single ``onChange(id, value)`` callback. Each filter
 * renders an accessible ``<select>`` with a 44px touch target; the bar wraps
 * responsively. Token-backed Tailwind only, no i18n import (labels come in
 * through props).
 *
 * @example
 * <FilterBar
 *   filters={[
 *     { id: "level", label: "Level", value: lvl,
 *       options: [{ value: "", label: "All" }, { value: "a1", label: "A1" }] },
 *   ]}
 *   onChange={(id, value) => setFilter(id, value)}
 * />
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
}

export interface FilterBarProps {
  filters: FilterDef[];
  onChange: (id: string, value: string) => void;
  className?: string;
  testId?: string;
}

export default function FilterBar({
  filters,
  onChange,
  className,
  testId = "filter-bar",
}: FilterBarProps) {
  return (
    <div
      className={`flex flex-wrap gap-3 ${className ?? ""}`}
      data-testid={testId}
    >
      {filters.map((filter) => (
        <label key={filter.id} className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{filter.label}</span>
          <select
            value={filter.value}
            onChange={(e) => onChange(filter.id, e.target.value)}
            aria-label={filter.label}
            data-testid={`${testId}-${filter.id}`}
            className="h-11 min-w-32 rounded-md border border-border bg-background px-2 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
