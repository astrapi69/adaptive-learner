/**
 * ListRow — a generic two-column list-item layout: a leading "meta"
 * column (heading + optional secondary tags line + optional
 * description) and a trailing "actions" column (an optional
 * visually-hidden live-region status node + action controls).
 *
 * Fully presentational and app-agnostic: every region is a ReactNode
 * passed by the caller and it imports nothing app-specific. The region
 * class names are caller-supplied so the component stays headless —
 * bring your own layout classes (or none). Reusable for any "titled
 * row with trailing actions" list: content sets, connected
 * repositories, search results, settings entries, …
 *
 * @example
 * <ListRow
 *   className="content-set-row"
 *   metaClassName="content-set-meta"
 *   actionsClassName="content-set-action"
 *   testId="content-set-fr-a1"
 *   title={<h4>French A1 <SourceBadge /></h4>}
 *   tags={<p className="tags">FR → EN · A1 · 12 lessons</p>}
 *   description={<p>Beginner French for English speakers.</p>}
 *   status={<span className="sr-only" role="status">Ready</span>}
 *   actions={<DownloadButton />}
 * />
 */

import type { ReactNode } from "react";

export interface ListRowProps {
  /** Heading content — the title text plus any inline badges. */
  title: ReactNode;
  /** Optional secondary line under the title (tags / metadata). */
  tags?: ReactNode;
  /** Optional longer description block under the tags. */
  description?: ReactNode;
  /** Trailing action controls (buttons, menus). */
  actions?: ReactNode;
  /** Optional visually-hidden live-region status node, rendered first
   *  in the actions column so screen readers announce it. */
  status?: ReactNode;
  /** Class applied to the root `<li>`. */
  className?: string;
  /** Class applied to the leading meta `<div>`. */
  metaClassName?: string;
  /** Class applied to the trailing actions `<div>`. */
  actionsClassName?: string;
  /** `data-testid` for the root `<li>`. */
  testId?: string;
}

/** Two-column list row: meta (title + tags + description) | actions. */
export default function ListRow({
  title,
  tags,
  description,
  actions,
  status,
  className,
  metaClassName,
  actionsClassName,
  testId,
}: ListRowProps) {
  return (
    <li className={className} data-testid={testId}>
      <div className={metaClassName}>
        {title}
        {tags}
        {description}
      </div>
      <div className={actionsClassName}>
        {status}
        {actions}
      </div>
    </li>
  );
}
