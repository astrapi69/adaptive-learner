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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Trash2 } from "lucide-react";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";

export interface SetActionsMenuProps {
  entry: ContentSetEntry;
  /** Current status; defaults applied by the caller (missing → active). */
  status: SetStatus;
  /** Change the set's lifecycle status. */
  onSetStatus: (status: SetStatus) => void;
  /** Open the destructive delete-confirm dialog. */
  onDelete: () => void;
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
}: SetActionsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  /** Anchor the fixed, portalled menu to the trigger's current rect. */
  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    // Dismiss on a pointer outside BOTH the trigger and the portalled menu
    // (the menu is no longer a DOM descendant of the trigger's container).
    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Keep the menu anchored to the trigger while the page scrolls/resizes.
    const onReflow = () => reposition();
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, reposition]);

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

  /** Move focus between menu items with the arrow keys (menu pattern). */
  const onItemKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(e.currentTarget);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  };

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-app text-fg-muted hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("content.set_status.menu_aria", "Set actions")}
        onClick={(e) => {
          // Never let the tap bubble to a row-level navigation target.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid={`set-actions-${entry.id}`}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open &&
        pos &&
        createPortal(
        <ul
          ref={menuRef}
          role="menu"
          aria-label={t("content.set_status.menu_aria", "Set actions")}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 min-w-48 max-w-[calc(100vw-1rem)] rounded-app border border-border bg-card py-1 shadow-elevated"
          data-testid={`set-actions-menu-${entry.id}`}
        >
          {TRANSITIONS[status].map((next) => (
            <li key={next} role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-fg-primary hover:bg-[var(--bg-elevated)] focus-visible:bg-[var(--bg-elevated)] focus-visible:outline-none"
                onClick={() => choose(() => onSetStatus(next))}
                onKeyDown={onItemKeyDown}
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--error)] hover:bg-[var(--error-bg)] focus-visible:bg-[var(--error-bg)] focus-visible:outline-none"
              onClick={() => choose(onDelete)}
              onKeyDown={onItemKeyDown}
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
