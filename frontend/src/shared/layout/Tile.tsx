/**
 * Tile — a padded, rounded surface panel. The default centers its children
 * (the empty-state shell); pass layout utilities via `className` to reflow it
 * (e.g. a left-aligned column).
 *
 * Fully presentational and app-agnostic: no i18n, no icons, no storage. Bring
 * your own content.
 *
 * NOTE (#1629, additive step — Half A): this wrapper deliberately emits the
 * legacy ``.tile`` class so it renders IDENTICALLY to the hand-written
 * ``<div className="tile">`` it replaces — the legacy rule in
 * ``styles/legacy/06-dashboard.css`` still styles it (0-diff by construction).
 * The follow-up (Half B) moves the defaults into this component as
 * token-backed Tailwind utilities and DELETES the legacy rule — a single
 * contained, visually-reviewed change here instead of one per consumer. That
 * step touches ``styles/legacy`` (visual-critical) and must run on a machine
 * that can refresh the visual-regression baselines.
 *
 * @example
 * <Tile data-testid="tool-recs-empty">
 *   <p className="muted">{t("tools.empty")}</p>
 * </Tile>
 *
 * @example
 * // Left-aligned column reflow (overrides the centered default)
 * <Tile className="flex flex-col items-start gap-2" data-testid="profile-empty">
 *   …
 * </Tile>
 */

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TileProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Tile({ children, className, ...rest }: TileProps) {
  return (
    <div className={cn("tile", className)} {...rest}>
      {children}
    </div>
  );
}
