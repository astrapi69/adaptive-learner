/**
 * Tile — a padded, rounded surface panel. The default centers its children
 * (the empty-state shell); pass layout utilities via `className` to reflow it
 * (e.g. a left-aligned column).
 *
 * Fully presentational and app-agnostic: no i18n, no icons, no storage. Bring
 * your own content.
 *
 * NOTE (#1629, Half B): the defaults now live HERE as token-backed Tailwind
 * utilities — the byte-for-byte equivalent of the deleted legacy `.tile` rule
 * (`background: var(--surface-2); border-radius: var(--radius-md); padding:
 * var(--space-4); display: flex; align-items: center; justify-content: center;
 * min-height: 120px`). Extra utilities from `className` are merged AFTER via
 * `cn()`, so a reflow override (e.g. `flex flex-col items-start`) wins exactly
 * as it did when it beat the legacy rule from the utilities layer.
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

const TILE_BASE =
  "flex min-h-[120px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-2)] p-[var(--space-4)]";

export interface TileProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Tile({ children, className, ...rest }: TileProps) {
  return (
    <div className={cn(TILE_BASE, className)} {...rest}>
      {children}
    </div>
  );
}
