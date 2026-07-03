/**
 * BulkActionBar (#1351) — the multi-select action bar for "Meine Inhalte".
 *
 * Appears once at least one set is selected. It offers exactly the actions
 * the per-set {@link SetActionsMenu} does — set the lifecycle status
 * (active / deferred / completed) and delete — so the two never drift; the
 * page wires these buttons to the SAME handlers. Shows the selection count
 * and a clear-selection control. Tailwind + design tokens only, ≥44px
 * targets. Sticky at the top of the list so it stays reachable while
 * scrolling a long selection.
 */

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { SetStatus } from "../../../storage/types";

export interface BulkActionBarProps {
  count: number;
  onSetStatus: (status: SetStatus) => void;
  onDelete: () => void;
  onClear: () => void;
}

const STATUS_ACTIONS: { status: SetStatus; key: string; fallback: string }[] = [
  { status: "active", key: "content.set_status.action.activate", fallback: "Reactivate" },
  { status: "deferred", key: "content.set_status.action.defer", fallback: "Defer" },
  { status: "completed", key: "content.set_status.action.complete", fallback: "Mark as completed" },
];

export default function BulkActionBar({
  count,
  onSetStatus,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <div
      className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-app border border-border bg-card p-2 shadow-elevated"
      role="region"
      aria-label={t("content.set_status.bulk_bar_aria", "Bulk actions")}
      data-testid="content-bulk-bar"
    >
      <span className="px-1 text-sm font-medium" data-testid="content-bulk-count">
        {t("content.set_status.bulk_selected", "{n} selected").replace("{n}", String(count))}
      </span>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {STATUS_ACTIONS.map(({ status, key, fallback }) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => onSetStatus(status)}
            data-testid={`content-bulk-${status}`}
          >
            {t(key, fallback)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="min-h-11"
          onClick={onDelete}
          data-testid="content-bulk-delete"
        >
          <Trash2 size={14} aria-hidden="true" />
          {t("content.set_status.action.delete", "Delete")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          onClick={onClear}
          aria-label={t("content.set_status.bulk_clear", "Clear selection")}
          data-testid="content-bulk-clear"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
