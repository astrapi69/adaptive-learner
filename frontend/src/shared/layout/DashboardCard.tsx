/**
 * DashboardCard — the widget-card surface shared by the Dashboard tabs,
 * Progress, Statistics, Curriculum and the Settings integrations section
 * (EXP-044 Option C, #1485).
 *
 * The former legacy rules (`dashboard-card` / `dashboard-card-wide` /
 * `dashboard-card-title`) were deleted WITH this extraction; the defaults
 * live here as token-backed Tailwind utilities, byte-for-byte equivalent
 * to the deleted rules (including the mobile padding shrink; the old
 * mobile title font-size override was a no-op — it restated the base
 * 1rem — and was dropped).
 *
 * Breakpoint note: the legacy block was `@media (max-width: 768px)` —
 * INCLUSIVE of 768, the iPad-portrait/tablet width that the visual
 * tablet motifs render at. Tailwind's `max-md:` compiles to
 * `width < 768px` and misses exactly that width (the tablet baselines
 * caught the 1px gap as real pixel diffs), so the shrink is carried as
 * `max-[769px]:` (`width < 769px`), which includes 768.
 *
 * `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`
 * (= min-content), so a wide child (e.g. a Recharts SVG) would floor the
 * cell at its rendered width and overflow the viewport. `min-w-0` lets
 * the cell shrink to the grid track so charts re-measure responsively.
 *
 * Both parts merge `className` via `cn()` (tailwind-merge), forward their
 * ref, and pass every other DOM attribute through — consumers keep their
 * `data-testid`/`aria-*` wiring unchanged. `as` preserves each consumer's
 * existing semantic element (article/section/div) and heading level.
 *
 * @example
 * <DashboardCard data-testid="favorites-card">
 *   <DashboardCardTitle>{t("favorites.card_title")}</DashboardCardTitle>
 *   …
 * </DashboardCard>
 *
 * @example
 * // Full-width card in the dashboard grid, section semantics
 * <DashboardCard as="section" wide data-testid="notebooklm-section">…</DashboardCard>
 */
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

const CARD_BASE =
  "flex min-w-0 flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-5)] py-[var(--space-4)] shadow-[var(--shadow-card)] max-[769px]:p-[var(--space-3)]";

export interface DashboardCardProps extends ComponentPropsWithoutRef<"div"> {
  /** Semantic element — keep each consumer's existing markup. */
  as?: "article" | "section" | "div";
  /** Span the full dashboard grid row (`grid-column: 1 / -1`). */
  wide?: boolean;
}

/** The widget-card surface: elevated, bordered, column layout. */
export const DashboardCard = forwardRef<HTMLElement, DashboardCardProps>(
  function DashboardCard(
    { as: Tag = "article", wide = false, className, ...rest },
    ref,
  ) {
    return (
      <Tag
        // The polymorphic tag narrows the ref imperfectly; all three
        // allowed tags are plain HTMLElements.
        ref={ref as never}
        className={cn(CARD_BASE, wide && "col-span-full", className)}
        {...rest}
      />
    );
  },
);

/** The uppercase muted widget heading; `as` keeps the outline level. */
export interface DashboardCardTitleProps
  extends ComponentPropsWithoutRef<"h2"> {
  /** Heading level — keep each consumer's existing outline level. */
  as?: "h2" | "h3";
}

export const DashboardCardTitle = forwardRef<
  HTMLHeadingElement,
  DashboardCardTitleProps
>(function DashboardCardTitle({ as: Tag = "h2", className, ...rest }, ref) {
  return (
    <Tag
      ref={ref}
      className={cn(
        "m-0 text-[1rem] font-semibold uppercase tracking-[0.04em] text-fg-muted",
        className,
      )}
      {...rest}
    />
  );
});
