/**
 * NavGroup — a labelled section of navigation links (EXP-037).
 *
 * Presentational + reusable: renders an uppercase section header followed by
 * its children (the links). Used to group the primary navigation into LERNEN /
 * INHALTE / FORTSCHRITT, and to group the secondary items inside the mobile
 * "Mehr" sheet. Token-backed Tailwind, no app imports.
 *
 * The header is purely a visual/structural divider; it is marked
 * ``aria-hidden`` because the grouping is decorative — the links themselves
 * carry the accessible names. In the vertical mobile "Mehr" sheet the label
 * reads as a real section header (default, shown). On the horizontal top bar
 * the grouping is order-only and the label is hidden — pass ``hideLabel``.
 *
 * Visibility is a PROP, not a CSS context override. The label used to be
 * hidden by an unlayered ``.app-nav .nav-group-label { display: none }`` rule
 * that had to beat the ``block`` utility from OUTSIDE the cascade layers;
 * that made the whole Navigation region un-wrappable into ``@layer legacy``
 * (#1571 / #1592). Driving it from the component removes the context
 * override so the region can be layered.
 *
 * @example
 * // Mobile sheet (label shown):
 * <NavGroup label="LERNEN">…</NavGroup>
 * // Top bar (label hidden, grouping is order-only):
 * <NavGroup label="LERNEN" hideLabel>…</NavGroup>
 */

import type { ReactNode } from "react";

export interface NavGroupProps {
  /** Section header text (e.g. "LERNEN"). */
  label: string;
  /** The links/buttons in this group. */
  children: ReactNode;
  /** Optional test id for the group container. */
  testId?: string;
  /**
   * Hide the section label (top bar, where the grouping is order-only). The
   * label stays in the DOM (decorative, ``aria-hidden``) but is
   * ``display:none``. Defaults to ``false`` (shown, e.g. the mobile sheet).
   */
  hideLabel?: boolean;
}

export default function NavGroup({ label, children, testId, hideLabel = false }: NavGroupProps) {
  return (
    <div className="nav-group" data-testid={testId}>
      <span
        className={`${hideLabel ? "hidden" : "block"} px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted`}
        aria-hidden="true"
      >
        {label}
      </span>
      {children}
    </div>
  );
}
