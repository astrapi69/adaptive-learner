/**
 * ActiveFilterChips — the always-visible row of active filters, each shown as
 * a removable mark (EXP-048 #2323).
 *
 * The problem it solves: with the filter panel collapsed, an active restriction
 * (level / domain / review standing / query …) was invisible, so at zero
 * results the learner could not tell WHAT they had set (only the source
 * language stayed visible, #1699). Every active restriction now appears here as
 * a mark with a one-tap remove, so filtering is always legible and reversible.
 *
 * Mobile-first: the marks live on ONE horizontally-scrollable, non-wrapping
 * line — the single permanently-visible filter surface on a phone, costing one
 * row instead of a block (EXP-048 Teil 4). A bar that ate half the height would
 * be no win.
 *
 * App-agnostic + props-driven: the host builds the {@link FilterChip}s (label +
 * remove handler) and every string comes in via props (no i18n import).
 * Token-backed Tailwind only; each control keeps a >=44px touch target.
 *
 * @example
 * <ActiveFilterChips
 *   chips={[{ id: "level", label: "Niveau: A1", onRemove: () => clearLevel() }]}
 *   removeLabel={(l) => t("discover.chips.remove", "Remove {f}").replace("{f}", l)}
 *   onClearAll={resetAll}
 *   clearAllLabel={t("discover.chips.reset_all", "Reset all filters")}
 *   testId="discover-active-filters"
 * />
 */

import { X } from "lucide-react";

/** One active filter, rendered as a removable mark. */
export interface FilterChip {
  /** Stable id (the facet name) — drives the mark's testid + React key. */
  id: string;
  /** Full visible label, e.g. "Niveau: A1". */
  label: string;
  /** Clear just this restriction. */
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  chips: FilterChip[];
  /** Builds the remove button's aria-label from a chip's visible label. */
  removeLabel: (chipLabel: string) => string;
  /** Clear every active filter at once. Omit to hide the reset action. */
  onClearAll?: () => void;
  /** Label for the reset-all action (required to show it). */
  clearAllLabel?: string;
  testId?: string;
}

export default function ActiveFilterChips({
  chips,
  removeLabel,
  onClearAll,
  clearAllLabel,
  testId = "active-filter-chips",
}: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div
      className="flex flex-nowrap items-center gap-2 overflow-x-auto"
      data-testid={testId}
    >
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex shrink-0 items-center gap-1 rounded-app border border-border bg-card py-1 pl-3 pr-1 text-sm text-fg-primary"
          data-testid={`${testId}-${chip.id}`}
        >
          {chip.label}
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-app text-fg-muted hover:bg-[var(--bg-elevated)] hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={removeLabel(chip.label)}
            onClick={chip.onRemove}
            data-testid={`${testId}-remove-${chip.id}`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      ))}
      {onClearAll && clearAllLabel ? (
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-app px-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onClearAll}
          data-testid={`${testId}-clear-all`}
        >
          {clearAllLabel}
        </button>
      ) : null}
    </div>
  );
}
