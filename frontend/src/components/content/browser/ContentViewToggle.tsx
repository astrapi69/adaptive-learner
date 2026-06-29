/**
 * Grid ⇄ list view toggle for the /content browser (#1240).
 *
 * Two mutually-exclusive options (rich tree "grid" / compact "list").
 * Keyboard-operable, ``aria-pressed`` marks the active option, 44px
 * touch targets. Pure presentation — the active mode and the change
 * handler come from props (the persisted pref lives in
 * {@link useContentViewMode}).
 */

import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentViewMode } from "../../../lib/content/browse/viewModePref";

interface ContentViewToggleProps {
  mode: ContentViewMode;
  onChange: (mode: ContentViewMode) => void;
}

export default function ContentViewToggle({ mode, onChange }: ContentViewToggleProps) {
  const { t } = useI18n();
  const gridLabel = t("content.view.grid", "Grid view");
  const listLabel = t("content.view.list", "List view");
  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={t("content.view.aria", "Choose view")}
      data-testid="content-view-toggle"
    >
      <Button
        type="button"
        size="icon"
        variant={mode === "grid" ? "default" : "outline"}
        className="min-h-11 min-w-11"
        aria-pressed={mode === "grid"}
        aria-label={gridLabel}
        title={gridLabel}
        onClick={() => onChange("grid")}
        data-testid="content-view-grid"
      >
        <LayoutGrid size={16} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={mode === "list" ? "default" : "outline"}
        className="min-h-11 min-w-11"
        aria-pressed={mode === "list"}
        aria-label={listLabel}
        title={listLabel}
        onClick={() => onChange("list")}
        data-testid="content-view-list"
      >
        <List size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}
