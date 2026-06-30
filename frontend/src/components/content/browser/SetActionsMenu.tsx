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
 * @example
 * <SetActionsMenu
 *   entry={entry}
 *   status={entry.status ?? "active"}
 *   onSetStatus={(s) => handleSetStatus(entry, s)}
 *   onDelete={() => setDeleteSetTarget(entry)}
 * />
 */

import { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-app text-fg-muted hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("content.set_status.menu_aria", "Set actions")}
        onClick={() => setOpen((v) => !v)}
        data-testid={`set-actions-${entry.id}`}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={t("content.set_status.menu_aria", "Set actions")}
          className="absolute right-0 z-20 mt-1 min-w-48 rounded-app border border-border bg-card py-1 shadow-elevated"
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
        </ul>
      )}
    </div>
  );
}
