import {Button} from "@/components/ui/button";
import {BackupCompare} from "./BackupCompare";
import {RestoreModeChoice} from "./RestoreModeChoice";
import {backupOwnerId} from "../../../storage/backup";
import type {BackupPayload, RestoreMode} from "../../../types/domain";

type Translate = (key: string, fallback?: string) => string;

/** One row of the current-vs-backup table. */
export interface ComparisonRow {
    table: string;
    current: number;
    incoming: number;
}

/** What a merge of the pending backup would add and update. */
type RestoreDiffCounts = {added: number; removed: number; changed: number};

/** Whether ``payload`` was made by another learner than ``userId`` (#3785). */
export function isForeignBackup(payload: BackupPayload, userId: string): boolean {
    const owner = backupOwnerId(payload);
    return owner !== null && owner !== userId;
}

/**
 * The pre-restore confirmation panel: how the backup is applied (#3787),
 * the current-vs-backup row-count table, the optional per-table diff
 * preview, and the Confirm / Cancel actions.
 *
 * @example
 * <RestoreConfirmPanel comparison={rows} pendingPayload={payload} mode="merge" ... />
 */
export function RestoreConfirmPanel({
    comparison,
    currentSnapshot,
    pendingPayload,
    busy,
    restoreDiffCounts,
    onConfirm,
    onCancel,
    foreignOwner,
    mode,
    onModeChange,
    t,
}: {
    comparison: ComparisonRow[];
    currentSnapshot: BackupPayload | null;
    pendingPayload: BackupPayload;
    busy: "export" | "import" | null;
    restoreDiffCounts: RestoreDiffCounts | null;
    onConfirm: () => void;
    onCancel: () => void;
    /** #3785 - the backup was made by another learner than the active one. */
    foreignOwner: boolean;
    /** #3787 - merge (the default) or reset to the backup. */
    mode: RestoreMode;
    onModeChange: (mode: RestoreMode) => void;
    t: Translate;
}) {
    return (
        <div
            className="backup-comparison flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
            data-testid="backup-comparison"
        >
            <h3>{t("backup.comparison_title", "Confirm restore")}</h3>
            <p className="muted">
                {t(
                    "backup.comparison_help",
                    "Restore will merge: new records inserted, mutable records updated only if the backup is newer, history rows kept as-is. Nothing is deleted. API keys are ignored.",
                )}
            </p>
            {foreignOwner && (
                <p
                    role="note"
                    className="rounded-app border border-warning bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning"
                    data-testid="backup-foreign-owner"
                >
                    {t(
                        "backup.foreign_owner_notice",
                        "This backup belongs to another learner profile. Its progress is added to the active profile and merged with it: lessons, mistakes and history are added, XP, streak and settings are taken from the backup. The active profile stays active.",
                    )}
                </p>
            )}
            <RestoreModeChoice
                mode={mode}
                onChange={onModeChange}
                foreignOwner={foreignOwner}
                disabled={busy !== null}
                t={t}
            />
            <table className="backup-comparison-table w-full text-sm">
                <thead>
                    <tr>
                        <th scope="col" className="text-left">
                            {t("backup.table_header", "Table")}
                        </th>
                        <th scope="col" className="text-right">
                            {t("backup.current_header", "Current")}
                        </th>
                        <th scope="col" className="text-right">
                            {t("backup.incoming_header", "Backup")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {comparison.map((row) => (
                        <tr key={row.table}>
                            <td className="text-left">{row.table}</td>
                            <td className="text-right">{row.current}</td>
                            <td className="text-right">{row.incoming}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* v1.12.0 / Phase 25C — pre-restore diff preview */}
            {currentSnapshot !== null && (
                <BackupCompare
                    backupA={currentSnapshot}
                    backupB={pendingPayload}
                    labelA={t("backup.compare_current_label", "Current state")}
                    labelB={t("backup.incoming_header", "Backup")}
                    hideExport
                />
            )}

            <div className="backup-actions flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="default"
                    onClick={onConfirm}
                    disabled={busy !== null}
                    data-testid="backup-confirm"
                >
                    {busy === "import"
                        ? t("backup.importing", "Restoring…")
                        : mode === "reset"
                          ? t("backup.reset_confirm_button", "Reset to the backup")
                        : restoreDiffCounts !== null
                          ? t(
                                "backup.confirm_with_counts",
                                "Restore ({{added}} added, {{updated}} updated)",
                            )
                                .replace(
                                    "{{added}}",
                                    String(restoreDiffCounts.added),
                                )
                                .replace(
                                    "{{updated}}",
                                    String(restoreDiffCounts.changed),
                                )
                          : t("backup.confirm", "Confirm restore")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={busy !== null}
                    data-testid="backup-cancel"
                >
                    {t("common.cancel", "Cancel")}
                </Button>
            </div>
        </div>
    );
}
