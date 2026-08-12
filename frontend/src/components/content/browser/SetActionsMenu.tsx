/**
 * SetActionsMenu — the per-set overflow (three-dot) menu in "Meine
 * Inhalte" (#1300).
 *
 * One reusable, accessible menu shared by BOTH downloaded-set views
 * (the grid {@link ContentSetRow} and the list {@link ContentSetListView})
 * so the actions can never drift. It offers only the SENSIBLE status
 * transitions for the set's current status (never a no-op "activate" on
 * an already-active set) plus a destructive Delete.
 *
 * Pure presentation: the caller owns the set + supplies
 * ``onSetStatus`` / ``onDelete``. Keyboard-operable per the WAI-ARIA
 * menu-button pattern: ``aria-haspopup`` / ``aria-expanded`` on the
 * trigger, ``role="menu"`` / ``role="menuitem"`` items, Escape closes +
 * restores focus to the trigger, Arrow keys move between items, and an
 * outside click dismisses. Tailwind + design tokens only.
 *
 * The dropdown is rendered through a **portal to ``document.body``**,
 * positioned ``fixed`` at the trigger's rect (#1349). ``#root`` is a
 * deliberate clipping + scroll container (``overflow-x: hidden`` +
 * ``overflow-y: auto``, see global.css / #42); a non-portal
 * ``position: absolute`` overlay inside it is clipped / mis-positioned on
 * iOS and overlaps the row's navigation ``<Link>`` — so the Delete item
 * could not be reliably tapped on iPhone. The portal escapes that context
 * and puts the menu on the top layer.
 *
 * @example
 * <SetActionsMenu
 *   entry={entry}
 *   status={entry.status ?? "active"}
 *   onSetStatus={(s) => handleSetStatus(entry, s)}
 *   onDelete={() => setDeleteSetTarget(entry)}
 * />
 */

import { createPortal } from "react-dom";
import { MoreVertical, RotateCcw, Trash2 } from "lucide-react";

import { useI18n } from "../../../hooks/ui/useI18n";
import { useMenuButtonBehavior } from "../../../shared/hooks/useMenuButtonBehavior";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";

export interface SetActionsMenuProps {
  entry: ContentSetEntry;
  /** Current status; defaults applied by the caller (missing → active). */
  status: SetStatus;
  /** Change the set's lifecycle status. */
  onSetStatus: (status: SetStatus) => void;
  /** Open the destructive delete-confirm dialog. */
  onDelete: () => void;
  /** EXP-051 / #2125 — start a new Durchgang ("Set erneut durcharbeiten").
   *  Offered only for a ``completed`` set; omit to hide the action. */
  onRestart?: () => void;
}

/** The sensible status transitions offered for each current status —
 *  never the set's own status (no no-op action). */
const TRANSITIONS: Record<SetStatus, SetStatus[]> = {
  active: ["deferred", "completed"],
  deferred: ["active", "completed"],
  completed: ["active", "deferred"],
};

export default function SetActionsMenu({
  entry,
  status,
  onSetStatus,
  onDelete,
  onRestart,
}: SetActionsMenuProps) {
  const { t } = useI18n();
  // Shared menu-button mechanics (#1386): open/position state, portal
  // anchoring, outside-click + Escape dismiss, ArrowUp/Down roving focus.
  const menu = useMenuButtonBehavior();

  /** The localized verb for transitioning INTO ``next``. */
  const transitionLabel = (next: SetStatus): string => {
    if (next === "active") {
      return t("content.set_status.action.activate", "Reactivate");
    }
    if (next === "deferred") {
      return t("content.set_status.action.defer", "Defer");
    }
    return t("content.set_status.action.complete", "Mark as completed");
  };

  return (
    <div className="shrink-0">
      <button
        ref={menu.triggerRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-app text-fg-muted hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={t("content.set_status.menu_aria", "Set actions")}
        onClick={(e) => {
          // Never let the tap bubble to a row-level navigation target.
          e.stopPropagation();
          menu.toggle();
        }}
        data-testid={`set-actions-${entry.id}`}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {menu.open &&
        menu.pos &&
        createPortal(
        // ``list-none m-0`` explicitly resets the browser list marker +
        // indent: Tailwind's utilities are imported WITHOUT preflight
        // (styles/tailwind.css), so an un-reset portalled <ul> otherwise
        // shows disc bullets and a ~40px inline padding (#2498).
        <ul
          ref={menu.menuRef}
          role="menu"
          aria-label={t("content.set_status.menu_aria", "Set actions")}
          style={{ position: "fixed", top: menu.pos.top, right: menu.pos.right }}
          className="z-50 m-0 min-w-52 max-w-[calc(100vw-1rem)] list-none rounded-app border border-border bg-card p-1.5 shadow-elevated"
          data-testid={`set-actions-menu-${entry.id}`}
        >
          {status === "completed" && onRestart && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-[calc(var(--radius-app)-3px)] px-2.5 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-[var(--bg-elevated)] focus-visible:bg-[var(--bg-elevated)] focus-visible:outline-none"
                onClick={() => menu.choose(onRestart)}
                onKeyDown={menu.onItemKeyDown}
                data-testid={`set-action-${entry.id}-restart`}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {t("content.set_status.action.restart", "Work through again")}
              </button>
            </li>
          )}
          {TRANSITIONS[status].map((next) => (
            <li key={next} role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded-[calc(var(--radius-app)-3px)] px-2.5 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-[var(--bg-elevated)] focus-visible:bg-[var(--bg-elevated)] focus-visible:outline-none"
                onClick={() => menu.choose(() => onSetStatus(next))}
                onKeyDown={menu.onItemKeyDown}
                data-testid={`set-action-${entry.id}-${next}`}
              >
                {transitionLabel(next)}
              </button>
            </li>
          ))}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-[calc(var(--radius-app)-3px)] px-2.5 py-2 text-left text-sm text-[var(--error)] transition-colors hover:bg-[var(--error-bg)] focus-visible:bg-[var(--error-bg)] focus-visible:outline-none"
              onClick={() => menu.choose(onDelete)}
              onKeyDown={menu.onItemKeyDown}
              data-testid={`set-action-${entry.id}-delete`}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("content.set_status.action.delete", "Delete")}
            </button>
          </li>
        </ul>,
          document.body,
        )}
    </div>
  );
}
