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
 * carry the accessible names. On the horizontal desktop bar the label is
 * visually compact; in the vertical mobile surfaces it reads as a real section
 * header.
 *
 * @example
 * <NavGroup label="LERNEN">
 *   <NavLink to="/dashboard">Dashboard</NavLink>
 * </NavGroup>
 */

import type { ReactNode } from "react";

export interface NavGroupProps {
  /** Section header text (e.g. "LERNEN"). */
  label: string;
  /** The links/buttons in this group. */
  children: ReactNode;
  /** Optional test id for the group container. */
  testId?: string;
}

export default function NavGroup({ label, children, testId }: NavGroupProps) {
  return (
    <div className="nav-group" data-testid={testId}>
      <span
        className="nav-group-label block px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted"
        aria-hidden="true"
      >
        {label}
      </span>
      {children}
    </div>
  );
}
