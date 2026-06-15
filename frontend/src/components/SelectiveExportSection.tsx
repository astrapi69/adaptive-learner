/**
 * Selective data export (#544) — Settings → Data.
 *
 * Two ways to take your data with you, both producing the same
 * importable backup archive:
 *   - a one-click **full backup** (every table), and
 *   - a **selective export** where you tick the data categories to
 *     include; picking a category auto-carries its dependent tables.
 *
 * Reuses the existing ``storage.backup.export`` + ``saveBackupToDisk``
 * pipeline (the file the restore wizard already reads), and trims the
 * payload client-side via {@link filterBackupPayload}, so it works in
 * both storage modes. Gated by the always-active ``SELECTIVE_EXPORT``
 * feature (no ad-hoc gating).
 */

import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useI18n } from "../hooks/useI18n";
import { readLearnerState } from "../lib/learnerState";
import {
  allCategoryIds,
  categoryById,
  EXPORT_GROUPS,
  filterBackupPayload,
  resolveSelectedTables,
  selectiveExportFilename,
} from "../lib/backup/selective-export";
import { getStorage } from "../storage";
import { backupFilename, saveBackupToDisk } from "../utils/backup-download";
import { notify } from "../utils/notify";

/** Default ticked categories — the everyday content the learner owns. */
const DEFAULT_SELECTED = ["projects", "curricula", "progress", "subjects"];

export default function SelectiveExportSection() {
  const { t } = useI18n();
  const { userId } = readLearnerState();
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [busy, setBusy] = useState<"full" | "selective" | null>(null);

  const allIds = useMemo(() => allCategoryIds(), []);
  const allChecked = selected.size === allIds.length;
  const masterState: boolean | "indeterminate" =
    selected.size === 0 ? false : allChecked ? true : "indeterminate";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

  async function runExport(mode: "full" | "selective") {
    if (!userId) return;
    setBusy(mode);
    try {
      const payload = await getStorage().backup.export(userId);
      if (mode === "full") {
        const outcome = await saveBackupToDisk(payload, backupFilename(userId));
        if (outcome.method !== "cancelled") {
          notify.success(t("data_export.full_done", "Full backup created."));
        }
      } else {
        const tables = resolveSelectedTables(selected);
        const subset = filterBackupPayload(payload, tables);
        const outcome = await saveBackupToDisk(subset, selectiveExportFilename());
        if (outcome.method !== "cancelled") {
          notify.success(
            t("data_export.selective_done", "Exported {n} records.").replace(
              "{n}",
              String(subset.stats.total_records),
            ),
          );
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        t("data_export.failed", "Export failed: {detail}").replace("{detail}", detail),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="settings-section"
      data-testid="settings-section-data-export"
    >
      <h2 className="settings-section-title">{t("data_export.title", "Data export")}</h2>

      {/* Full backup — every table, the one-click emergency net. */}
      <div className="mb-4">
        <p className="mb-2 text-sm text-fg-secondary">
          {t(
            "data_export.full_intro",
            "Export everything in one importable backup file.",
          )}
        </p>
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal text-left"
          disabled={busy !== null || !userId}
          onClick={() => void runExport("full")}
          data-testid="data-export-full"
        >
          <Download size={16} aria-hidden="true" />
          {busy === "full"
            ? t("data_export.exporting", "Exporting…")
            : t("data_export.full_button", "Create full backup")}
        </Button>
      </div>

      {/* Selective export. */}
      <div className="rounded-app border border-border p-3">
        <p className="mb-3 text-sm text-fg-secondary">
          {t(
            "data_export.selective_intro",
            "Or pick exactly what to include. The file imports the same way.",
          )}
        </p>

        <label className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={masterState}
            onCheckedChange={toggleAll}
            aria-label={t("data_export.select_all", "Select all / none")}
            data-testid="data-export-select-all"
          />
          {t("data_export.select_all", "Select all / none")}
        </label>

        <div className="flex flex-col gap-4">
          {EXPORT_GROUPS.map((group) => (
            <fieldset key={group.id} data-testid={`data-export-group-${group.id}`}>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                {t(group.labelKey, group.labelFallback)}
              </legend>
              <div className="flex flex-col gap-2">
                {group.categories.map((cat) => {
                  const dep = categoryById(cat.id);
                  return (
                    <div key={cat.id} className="flex flex-col">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.has(cat.id)}
                          onCheckedChange={() => toggle(cat.id)}
                          aria-label={t(cat.labelKey, cat.labelFallback)}
                          data-testid={`data-export-cat-${cat.id}`}
                        />
                        {t(cat.labelKey, cat.labelFallback)}
                      </label>
                      {dep && dep.includes.length > 0 && selected.has(cat.id) ? (
                        <span className="ml-6 text-xs text-fg-secondary">
                          {t(
                            "data_export.includes_hint",
                            "exported automatically with this category",
                          )}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="mt-4 h-auto max-w-full whitespace-normal text-left"
          disabled={busy !== null || !userId || selected.size === 0}
          onClick={() => void runExport("selective")}
          data-testid="data-export-selective"
        >
          <Download size={16} aria-hidden="true" />
          {busy === "selective"
            ? t("data_export.exporting", "Exporting…")
            : t("data_export.selective_button", "Export selected data")}
        </Button>
      </div>
    </section>
  );
}
