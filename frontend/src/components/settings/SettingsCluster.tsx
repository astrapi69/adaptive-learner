/**
 * SettingsCluster - a labelled group of Settings cards (#2956).
 *
 * A Settings tab with many cards is one flat column without a landmark;
 * this wraps a run of `SettingsSection` cards in a `<section
 * aria-labelledby>` with a small uppercase group heading (the same muted
 * label style the mobile Settings menu uses for its tab groups) and an
 * optional one-line description. Presentational and props-driven: no app
 * imports, no i18n inside (the caller passes translated strings), token-
 * backed Tailwind utilities only. The heading id comes from `useId`, so
 * several clusters on one page never collide; the section's own DOM id is
 * `learning-<id>`, the anchor a `?section=<id>` deep link targets, and
 * `scroll-mt-16` keeps that anchor clear of the sticky page header.
 */
import { useId } from "react";
import type { ReactNode } from "react";

export interface SettingsClusterProps {
  /** Anchor slug; the `<section>` gets the DOM id `learning-<id>`. */
  id: string;
  /** Group heading (already translated). */
  title: ReactNode;
  /** Optional one-line description rendered under the heading. */
  description?: ReactNode;
  /** `data-testid` on the `<section>` root. */
  testid: string;
  /** The cards of the group, in display order. */
  children: ReactNode;
}

/**
 * Renders a labelled Settings cluster: `<section aria-labelledby>` with an
 * `<h2>` group heading, an optional description and the given cards.
 *
 * @example
 * ```tsx
 * <SettingsCluster
 *   id="review"
 *   testid="settings-cluster-review"
 *   title={t("settings.cluster_review", "After the lesson")}
 *   description={t("settings.cluster_review_desc", "Review sessions and the lesson summary.")}
 * >
 *   <ReviewSettingsControl />
 *   <SummarySectionsControl />
 * </SettingsCluster>
 * ```
 */
export function SettingsCluster({
  id,
  title,
  description,
  testid,
  children,
}: SettingsClusterProps) {
  const headingId = useId();

  return (
    <section
      id={`learning-${id}`}
      data-testid={testid}
      aria-labelledby={headingId}
      className="scroll-mt-16 flex flex-col gap-[var(--space-5)]"
    >
      <div className="flex flex-col gap-1">
        <h2
          id={headingId}
          className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-secondary"
        >
          {title}
        </h2>
        {description !== undefined && (
          <p className="m-0 text-sm text-fg-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
