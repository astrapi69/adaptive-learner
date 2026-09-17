/**
 * SettingsSubNav - a chip row that jumps between the sections of one
 * Settings tab (#2961).
 *
 * Props-driven and presentational: the caller passes already-translated
 * items, which one is active, and what a click means; the component knows
 * nothing about routing or which tab it sits on. The row never wraps - at
 * 375 px it scrolls horizontally, and a newly active chip is scrolled into
 * the visible part of the row. On ``md+`` the bar is sticky below the app
 * header (``stickyTop`` is that header's height in px); below ``md`` it
 * scrolls with the page, because a sticky strip on a phone would eat the
 * little vertical space there is. The active chip carries
 * ``aria-current="location"`` (a place on the current page, not a page of
 * its own - the sidebar's tabs use ``"page"``). Token-backed Tailwind only.
 *
 * @example
 * <SettingsSubNav
 *   items={sections.map((s) => ({ id: s.id, label: t(s.labelKey, s.fallback) }))}
 *   activeId={activeSection}
 *   onSelect={openSection}
 *   ariaLabel={t("settings.learning_nav_aria", "Learning sections")}
 *   stickyTop={appNavHeight}
 * />
 */

import { useEffect, useRef } from "react";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

export interface SettingsSubNavItem {
  /** Stable id; also the ``data-testid`` suffix (``settings-subnav-<id>``). */
  id: string;
  /** Already-translated chip label. */
  label: string;
}

export interface SettingsSubNavProps {
  items: readonly SettingsSubNavItem[];
  /** The active item id, or ``null`` for none. Unknown ids activate nothing. */
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Accessible name of the ``<nav>`` landmark (already translated). */
  ariaLabel: string;
  /** Sticky offset in px on ``md+`` (the app header height). Default 0. */
  stickyTop?: number;
  /** ``data-testid`` of the nav root; chips derive ``<testid>-<id>``. */
  testid?: string;
  /** Forwarded to the ``<nav>`` root (the panel measures its height). */
  ref?: Ref<HTMLElement>;
}

/**
 * Renders the section chip row.
 *
 * @example
 * <SettingsSubNav items={items} activeId="review" onSelect={setSection} ariaLabel="Learning sections" />
 */
export default function SettingsSubNav({
  items,
  activeId,
  onSelect,
  ariaLabel,
  stickyTop = 0,
  testid = "settings-subnav",
  ref,
}: SettingsSubNavProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active chip inside the visible part of the scrolling row
  // (a deep link can activate a chip that sits past the right edge on a
  // phone). Horizontal only: the page's own scroll belongs to the section
  // request, never to the bar.
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeId === null) return;
    const chip = list.querySelector<HTMLElement>(`[data-testid="${testid}-${activeId}"]`);
    if (!chip || typeof list.scrollTo !== "function") return;
    list.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: "auto" });
  }, [activeId, testid]);

  return (
    <nav
      ref={ref}
      aria-label={ariaLabel}
      data-testid={testid}
      className="z-10 -mx-[var(--space-3)] bg-bg-primary px-[var(--space-3)] md:sticky"
      style={{ top: stickyTop }}
    >
      <ul
        ref={listRef}
        className="m-0 flex list-none flex-nowrap gap-2 overflow-x-auto py-2 [scrollbar-width:thin]"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "location" : undefined}
                data-testid={`${testid}-${item.id}`}
                className={cn(
                  "min-h-9 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "hover:bg-card",
                  active
                    ? "border-accent bg-card font-semibold text-accent"
                    : "border-border bg-bg-surface text-fg-secondary",
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
