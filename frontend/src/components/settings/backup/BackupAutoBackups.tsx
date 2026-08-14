/**
 * Dexie-mode auto-backup panel (#53, BACKUP-DIR-EXPORT-01).
 *
 * Owns its own local state (enabled toggle, the rotated list, storage
 * pressure, per-row busy marker) and the mount-time refresh/time-trigger
 * effect. Rendered only in Dexie mode; API mode has no auto-backup
 * surface. Restoring an auto-backup is surfaced to the parent via
 * {@link BackupAutoBackupsProps.onRestored}; loading a slot into the
 * Compare section goes through {@link BackupAutoBackupsProps.onLoadIntoCompare}.
 */

import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    checkTimeTrigger,
    deleteAutoBackup,
    estimateStoragePressure,
    isAutoBackupEnabled,
    listAutoBackups,
    maybeRunAutoBackup,
    restoreFromAutoBackup,
    runAutoBackupNow,
    setAutoBackupEnabled,
    type AutoBackupSummary,
    type StoragePressureReport,
} from "../../../storage/backup/auto-backup";
import {notify} from "../../../utils/notify";
import type {RestoreSummary} from "../../../types/domain";

interface BackupAutoBackupsProps {
    /** Active user; the panel only mounts once the learner is known. */
    userId: string;
    /** Called with the restore summary after an auto-backup restore. */
    onRestored: (summary: RestoreSummary) => void;
    /** Load a stored auto-backup into compare slot A or B. */
    onLoadIntoCompare: (entry: AutoBackupSummary, slot: "a" | "b") => void;
}

/** Dexie auto-backup list + controls. See {@link BackupAutoBackupsProps}. */
export function BackupAutoBackups({
    userId,
    onRestored,
    onLoadIntoCompare,
}: BackupAutoBackupsProps) {
    const {t} = useI18n();

    const [autoEnabled, setAutoEnabled] = useState<boolean>(() =>
        isAutoBackupEnabled(),
    );
    const [autoBackups, setAutoBackups] = useState<AutoBackupSummary[]>([]);
    const [pressure, setPressure] = useState<StoragePressureReport | null>(null);
    const [autoBusy, setAutoBusy] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            const list = await listAutoBackups(userId);
            if (!cancelled) {
                setAutoBackups(list);
            }
            const pres = await estimateStoragePressure();
            if (!cancelled) {
                setPressure(pres);
            }
        }
        refresh();
        // Run the time-based check once on mount. Fires only when
        // the last auto-backup is older than 7 days (or absent).
        const trigger = checkTimeTrigger();
        if (trigger !== null) {
            maybeRunAutoBackup(userId, __APP_VERSION__, trigger).then(() => {
                if (!cancelled) {
                    refresh();
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [userId]);

    return (
        <div
            className="backup-auto"
            data-testid="backup-auto"
        >
            <h3>{t("backup.auto_title", "Auto-backup")}</h3>
            <label className="backup-auto-toggle">
                <input
                    type="checkbox"
                    checked={autoEnabled}
                    data-testid="backup-auto-toggle"
                    onChange={(event) => {
                        const next = event.target.checked;
                        setAutoBackupEnabled(next);
                        setAutoEnabled(next);
                    }}
                />
                <span>
                    {t(
                        "backup.auto_help",
                        "Automatically back up after every 10 completed sessions or once a week.",
                    )}
                </span>
            </label>

            {pressure !== null && pressure.is_pressured && (
                <p
                    className="backup-pressure"
                    data-testid="backup-pressure"
                >
                    {t(
                        "backup.storage_pressure",
                        "Browser storage is almost full ({{pct}}% of quota). Export a manual backup now.",
                    ).replace(
                        "{{pct}}",
                        String(Math.round(pressure.usage_ratio * 100)),
                    )}
                </p>
            )}

            <div className="backup-actions mt-4 flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="default"
                    onClick={async () => {
                        if (userId === null) {
                            return;
                        }
                        setAutoBusy("run");
                        try {
                            await runAutoBackupNow(
                                userId,
                                __APP_VERSION__,
                                {reason: "manual"},
                            );
                            setAutoBackups(await listAutoBackups(userId));
                            notify.success(
                                t(
                                    "backup.auto_run_success",
                                    "Auto-backup created.",
                                ),
                            );
                        } catch (err) {
                            const detail =
                                err instanceof Error ? err.message : String(err);
                            notify.error(
                                t(
                                    "backup.auto_run_error",
                                    "Auto-backup failed: {{detail}}",
                                ).replace("{{detail}}", detail),
                            );
                        } finally {
                            setAutoBusy(null);
                        }
                    }}
                    disabled={autoBusy !== null}
                    data-testid="backup-auto-run"
                >
                    {autoBusy === "run"
                        ? t("backup.exporting", "Exporting…")
                        : t("backup.auto_run", "Back up now")}
                </Button>
            </div>

            {autoBackups.length === 0 ? (
                <p
                    className="muted"
                    data-testid="backup-auto-empty"
                >
                    {t(
                        "backup.auto_none",
                        "No auto-backups yet. The first one runs after 10 sessions or 7 days.",
                    )}
                </p>
            ) : (
                <ul
                    className="backup-auto-list"
                    data-testid="backup-auto-list"
                >
                    {autoBackups.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex flex-wrap items-center gap-2"
                        >
                            <span className="backup-auto-when">
                                {new Date(entry.created_at).toLocaleString()}
                            </span>
                            <span className="backup-auto-count">
                                {t(
                                    "backup.auto_records",
                                    "{{n}} records",
                                ).replace(
                                    "{{n}}",
                                    String(entry.total_records),
                                )}
                            </span>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                    if (userId === null) {
                                        return;
                                    }
                                    setAutoBusy(entry.id);
                                    try {
                                        const summary =
                                            await restoreFromAutoBackup(
                                                userId,
                                                entry.id,
                                            );
                                        onRestored(summary);
                                        notify.success(
                                            t(
                                                "backup.auto_restored",
                                                "Auto-backup restored.",
                                            ),
                                        );
                                    } catch (err) {
                                        const detail =
                                            err instanceof Error
                                                ? err.message
                                                : String(err);
                                        notify.error(
                                            t(
                                                "backup.auto_restore_error",
                                                "Restore failed: {{detail}}",
                                            ).replace("{{detail}}", detail),
                                        );
                                    } finally {
                                        setAutoBusy(null);
                                    }
                                }}
                                disabled={autoBusy !== null}
                                data-testid={`backup-auto-restore-${entry.id}`}
                            >
                                {t("backup.auto_restore", "Restore")}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                    if (userId === null) {
                                        return;
                                    }
                                    setAutoBusy(entry.id);
                                    try {
                                        await deleteAutoBackup(entry.id);
                                        setAutoBackups(
                                            await listAutoBackups(userId),
                                        );
                                    } finally {
                                        setAutoBusy(null);
                                    }
                                }}
                                disabled={autoBusy !== null}
                                data-testid={`backup-auto-delete-${entry.id}`}
                            >
                                {t("common.delete", "Delete")}
                            </Button>
                            {/* v1.12.0 / Phase 25D — load this auto-backup
                                slot into the Compare section as A or B. */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onLoadIntoCompare(entry, "a")}
                                disabled={autoBusy !== null}
                                data-testid={`backup-auto-compare-a-${entry.id}`}
                            >
                                {t(
                                    "backup.auto_compare_as_a",
                                    "Compare as A",
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onLoadIntoCompare(entry, "b")}
                                disabled={autoBusy !== null}
                                data-testid={`backup-auto-compare-b-${entry.id}`}
                            >
                                {t(
                                    "backup.auto_compare_as_b",
                                    "Compare as B",
                                )}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
