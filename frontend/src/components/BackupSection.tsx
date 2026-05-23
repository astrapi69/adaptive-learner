/**
 * Backup + restore section in Settings (Phase 15C).
 *
 * Shows three actions:
 *
 *   - "Create Backup" — downloads a JSON file (one per click).
 *   - "Restore from Backup" — file picker, parses JSON locally,
 *     shows a pre-restore comparison ("current vs incoming"
 *     row counts), confirms, then merges via storage.backup.import.
 *   - "Last backup" indicator — read from localStorage; nudges
 *     the user if it's been more than 7 days.
 *
 * Storage-mode agnostic. The IStorageService.backup namespace
 * runs the same logic in both modes; this component never
 * branches on mode beyond the helper text.
 */

import {useEffect, useRef, useState} from "react";

import {BackupCompare} from "./BackupCompare";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage, resolveStorageMode} from "../storage";
import {
    checkTimeTrigger,
    deleteAutoBackup,
    estimateStoragePressure,
    getAutoBackupPayload,
    isAutoBackupEnabled,
    listAutoBackups,
    maybeRunAutoBackup,
    restoreFromAutoBackup,
    runAutoBackupNow,
    setAutoBackupEnabled,
    type AutoBackupSummary,
    type StoragePressureReport,
} from "../storage/auto-backup";
import {notify} from "../utils/notify";
import type {BackupPayload, BackupStats, RestoreSummary} from "../types/domain";

const LAST_BACKUP_KEY = "adaptive-learner.last_backup_at";
const BACKUP_REMINDER_DAYS = 7;

function readLastBackup(): string | null {
    return localStorage.getItem(LAST_BACKUP_KEY);
}

function writeLastBackup(iso: string): void {
    localStorage.setItem(LAST_BACKUP_KEY, iso);
}

function daysSince(iso: string | null): number | null {
    if (iso === null) {
        return null;
    }
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) {
        return null;
    }
    return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

// Phase 41F: extracted to ``utils/backup-download.ts`` so the
// DangerZone pre-reset backup button can produce identical files.
import {triggerBackupDownload, backupFilename} from "../utils/backup-download";

interface ComparisonRow {
    table: string;
    current: number;
    incoming: number;
}

function buildComparison(
    currentStats: BackupStats,
    incoming: BackupPayload,
): ComparisonRow[] {
    const tables = new Set<string>();
    Object.keys(currentStats.tables).forEach((t) => tables.add(t));
    Object.keys(incoming.stats.tables).forEach((t) => tables.add(t));
    return Array.from(tables)
        .sort()
        .map((table) => ({
            table,
            current: currentStats.tables[table] ?? 0,
            incoming: incoming.stats.tables[table] ?? 0,
        }));
}

export default function BackupSection() {
    const {t} = useI18n();
    const storage = getStorage();
    const storageMode = resolveStorageMode();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {userId} = readLearnerState();

    const [busy, setBusy] = useState<"export" | "import" | null>(null);
    const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
    const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(
        null,
    );
    const [comparison, setComparison] = useState<ComparisonRow[] | null>(null);
    // v1.12.0 / Phase 25C — snapshot of the current state, used as
    // "Backup A" in the pre-restore diff preview.
    const [currentSnapshot, setCurrentSnapshot] = useState<BackupPayload | null>(
        null,
    );
    const [restoreDiffCounts, setRestoreDiffCounts] = useState<{
        added: number;
        removed: number;
        changed: number;
    } | null>(null);
    const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(
        null,
    );

    // Auto-backup (Dexie mode only)
    const [autoEnabled, setAutoEnabled] = useState<boolean>(() =>
        storageMode === "dexie" ? isAutoBackupEnabled() : false,
    );
    const [autoBackups, setAutoBackups] = useState<AutoBackupSummary[]>([]);
    const [pressure, setPressure] = useState<StoragePressureReport | null>(null);
    const [autoBusy, setAutoBusy] = useState<string | null>(null);

    // v1.12.0 / Phase 25B — compare two backups (or one + live).
    const compareInputARef = useRef<HTMLInputElement>(null);
    const compareInputBRef = useRef<HTMLInputElement>(null);
    const [compareA, setCompareA] = useState<{
        payload: BackupPayload;
        label: string;
    } | null>(null);
    const [compareB, setCompareB] = useState<{
        payload: BackupPayload;
        label: string;
    } | null>(null);
    const [compareError, setCompareError] = useState<string | null>(null);


    useEffect(() => {
        // Re-read on mount; a user may have backed up via another
        // tab in the meantime.
        setLastBackup(readLastBackup());
    }, []);

    useEffect(() => {
        if (storageMode !== "dexie" || userId === null) {
            return;
        }
        let cancelled = false;
        async function refresh() {
            const list = await listAutoBackups(userId!);
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
    }, [storageMode, userId]);

    if (!userId) {
        return null;
    }

    async function readBackupFile(file: File): Promise<BackupPayload> {
        const text = await file.text();
        const parsed = JSON.parse(text) as BackupPayload;
        if (
            parsed.format !== "adaptive-learner-backup" ||
            typeof parsed.version !== "string"
        ) {
            throw new Error(
                t(
                    "backup.invalid_format",
                    "This file is not a valid Adaptive Learner backup.",
                ),
            );
        }
        return parsed;
    }

    async function handleCompareFilePick(
        slot: "a" | "b",
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        const file = event.target.files?.[0];
        const inputRef = slot === "a" ? compareInputARef : compareInputBRef;
        if (inputRef.current) inputRef.current.value = "";
        if (!file) return;
        setCompareError(null);
        try {
            const payload = await readBackupFile(file);
            const entry = {payload, label: file.name};
            if (slot === "a") setCompareA(entry);
            else setCompareB(entry);
        } catch (err) {
            setCompareError(err instanceof Error ? err.message : String(err));
        }
    }

    async function handleCompareWithCurrent() {
        if (userId === null) return;
        setCompareError(null);
        try {
            const payload = await storage.backup.export(userId);
            setCompareB({
                payload,
                label: t("backup.compare_current_label", "Current state"),
            });
        } catch (err) {
            setCompareError(err instanceof Error ? err.message : String(err));
        }
    }

    function handleClearCompare() {
        setCompareA(null);
        setCompareB(null);
        setCompareError(null);
    }

    async function handleLoadAutoIntoCompare(
        entry: AutoBackupSummary,
        slot: "a" | "b",
    ) {
        setCompareError(null);
        try {
            const payload = await getAutoBackupPayload(entry.id);
            if (payload === null) {
                throw new Error(
                    t(
                        "backup.auto_compare_missing",
                        "Auto-backup is no longer available — it was rotated out.",
                    ),
                );
            }
            const label = t("backup.compare_auto_label", "Auto-backup {{date}}").replace(
                "{{date}}",
                new Date(entry.created_at).toLocaleString(),
            );
            if (slot === "a") setCompareA({payload, label});
            else setCompareB({payload, label});
            // Scroll the compare section into view so the user sees
            // the slot fill in.
            requestAnimationFrame(() => {
                document
                    .querySelector('[data-testid="backup-compare-section"]')
                    ?.scrollIntoView({behavior: "smooth", block: "start"});
            });
        } catch (err) {
            setCompareError(err instanceof Error ? err.message : String(err));
        }
    }

    const reminderDue =
        (lastBackup === null && true) ||
        ((daysSince(lastBackup) ?? 0) > BACKUP_REMINDER_DAYS);

    async function handleExport() {
        if (userId === null) {
            return;
        }
        setBusy("export");
        try {
            const payload = await storage.backup.export(userId);
            triggerBackupDownload(payload, backupFilename(userId));
            const iso = new Date().toISOString();
            writeLastBackup(iso);
            setLastBackup(iso);
            const total = payload.stats.total_records;
            notify.success(
                t("backup.export_success", "Backup downloaded ({{count}} records).").replace(
                    "{{count}}",
                    String(total),
                ),
            );
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("backup.export_error", "Backup failed: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    function handlePickFile() {
        fileInputRef.current?.click();
    }

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        // Reset the input so picking the same file twice in a row re-fires.
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        if (!file || userId === null) {
            return;
        }
        setBusy("import");
        setRestoreSummary(null);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as BackupPayload;
            if (
                parsed.format !== "adaptive-learner-backup" ||
                typeof parsed.version !== "string"
            ) {
                throw new Error(
                    t(
                        "backup.invalid_format",
                        "This file is not a valid Adaptive Learner backup.",
                    ),
                );
            }
            const currentStats = await storage.backup.stats(userId);
            setComparison(buildComparison(currentStats, parsed));
            setPendingPayload(parsed);
            // v1.12.0 / Phase 25C — pre-restore diff preview. Pull
            // the current state as a backup payload so BackupCompare
            // can render the per-table delta the user is about to
            // commit. Fire-and-forget: we must NOT keep ``busy``
            // pinned on a network call that can hang in tests or
            // offline environments. When the snapshot resolves the
            // preview pops in below the legacy row-count table; on
            // failure the preview silently doesn't render.
            storage.backup
                .export(userId)
                .then((snap) => setCurrentSnapshot(snap))
                .catch(() => setCurrentSnapshot(null));
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("backup.import_parse_error", "Could not read backup: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleConfirmRestore() {
        if (pendingPayload === null || userId === null) {
            return;
        }
        setBusy("import");
        try {
            const summary = await storage.backup.import(userId, pendingPayload);
            setRestoreSummary(summary);
            setPendingPayload(null);
            setComparison(null);
            setCurrentSnapshot(null);
            setRestoreDiffCounts(null);
            const parts = [
                t("backup.restored_inserted", "Inserted: {{n}}").replace(
                    "{{n}}",
                    String(summary.inserted),
                ),
                t("backup.restored_updated", "Updated: {{n}}").replace(
                    "{{n}}",
                    String(summary.updated),
                ),
                t("backup.restored_skipped", "Skipped: {{n}}").replace(
                    "{{n}}",
                    String(summary.skipped),
                ),
            ];
            notify.success(parts.join(" — "));
            if (summary.errors.length > 0) {
                notify.warning(
                    t("backup.restored_with_errors", "{{n}} records could not be restored.").replace(
                        "{{n}}",
                        String(summary.errors.length),
                    ),
                );
            }
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("backup.import_error", "Restore failed: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    function handleCancelRestore() {
        setPendingPayload(null);
        setComparison(null);
        setCurrentSnapshot(null);
        setRestoreDiffCounts(null);
    }

    return (
        <section
            className="settings-section"
            data-testid="settings-backup"
        >
            <h2 className="settings-section-title">
                {t("backup.section_title", "Backup")}
            </h2>
            <p className="muted">
                {t(
                    "backup.section_help",
                    "Export everything in your account as a JSON file. API keys are NOT included; you will need to re-enter them after a restore.",
                )}
            </p>

            <div className="backup-actions">
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={busy !== null}
                    data-testid="backup-export"
                    className="primary"
                >
                    {busy === "export"
                        ? t("backup.exporting", "Exporting…")
                        : t("backup.export", "Create Backup")}
                </button>
                <button
                    type="button"
                    onClick={handlePickFile}
                    disabled={busy !== null}
                    data-testid="backup-import"
                >
                    {busy === "import"
                        ? t("backup.importing", "Restoring…")
                        : t("backup.import", "Restore from Backup")}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileChange}
                    style={{display: "none"}}
                    data-testid="backup-file-input"
                />
            </div>

            {lastBackup !== null && (
                <p
                    className="backup-last"
                    data-testid="backup-last-backup"
                >
                    {t("backup.last_backup", "Last backup: {{when}}").replace(
                        "{{when}}",
                        new Date(lastBackup).toLocaleString(),
                    )}
                </p>
            )}

            {reminderDue && lastBackup !== null && (
                <p
                    className="backup-reminder"
                    data-testid="backup-reminder"
                >
                    {t(
                        "backup.reminder_overdue",
                        "It has been more than {{days}} days since your last backup.",
                    ).replace("{{days}}", String(BACKUP_REMINDER_DAYS))}
                </p>
            )}

            {pendingPayload !== null && comparison !== null && (
                <div
                    className="backup-comparison"
                    data-testid="backup-comparison"
                >
                    <h3>
                        {t("backup.comparison_title", "Confirm restore")}
                    </h3>
                    <p className="muted">
                        {t(
                            "backup.comparison_help",
                            "Restore will merge: new records inserted, mutable records updated only if the backup is newer, history rows kept as-is. Nothing is deleted. API keys are ignored.",
                        )}
                    </p>
                    <table className="backup-comparison-table">
                        <thead>
                            <tr>
                                <th scope="col">
                                    {t("backup.table_header", "Table")}
                                </th>
                                <th scope="col">
                                    {t("backup.current_header", "Current")}
                                </th>
                                <th scope="col">
                                    {t("backup.incoming_header", "Backup")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparison.map((row) => (
                                <tr key={row.table}>
                                    <td>{row.table}</td>
                                    <td>{row.current}</td>
                                    <td>{row.incoming}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* v1.12.0 / Phase 25C — pre-restore diff preview */}
                    {currentSnapshot !== null && (
                        <BackupCompare
                            backupA={currentSnapshot}
                            backupB={pendingPayload}
                            labelA={t(
                                "backup.compare_current_label",
                                "Current state",
                            )}
                            labelB={t("backup.incoming_header", "Backup")}
                            hideExport
                            onDiffReady={(diff) =>
                                setRestoreDiffCounts({
                                    added: diff.totals.added,
                                    removed: diff.totals.removed,
                                    changed: diff.totals.changed,
                                })
                            }
                        />
                    )}

                    <div className="backup-actions">
                        <button
                            type="button"
                            onClick={handleConfirmRestore}
                            disabled={busy !== null}
                            data-testid="backup-confirm"
                            className="primary"
                        >
                            {busy === "import"
                                ? t("backup.importing", "Restoring…")
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
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelRestore}
                            disabled={busy !== null}
                            data-testid="backup-cancel"
                        >
                            {t("common.cancel", "Cancel")}
                        </button>
                    </div>
                </div>
            )}

            {restoreSummary !== null && (
                <div
                    className="backup-summary"
                    data-testid="backup-summary"
                >
                    <p>
                        {t("backup.restored_summary", "Restore complete.")}
                    </p>
                    <ul>
                        <li>
                            {t("backup.restored_inserted", "Inserted: {{n}}").replace(
                                "{{n}}",
                                String(restoreSummary.inserted),
                            )}
                        </li>
                        <li>
                            {t("backup.restored_updated", "Updated: {{n}}").replace(
                                "{{n}}",
                                String(restoreSummary.updated),
                            )}
                        </li>
                        <li>
                            {t("backup.restored_skipped", "Skipped: {{n}}").replace(
                                "{{n}}",
                                String(restoreSummary.skipped),
                            )}
                        </li>
                        {restoreSummary.errors.length > 0 && (
                            <li>
                                {t("backup.restored_errors", "Errors: {{n}}").replace(
                                    "{{n}}",
                                    String(restoreSummary.errors.length),
                                )}
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {storageMode === "dexie" && (
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

                    <div className="backup-actions">
                        <button
                            type="button"
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
                        </button>
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
                                <li key={entry.id}>
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
                                    <button
                                        type="button"
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
                                                setRestoreSummary(summary);
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
                                    </button>
                                    <button
                                        type="button"
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
                                    </button>
                                    {/* v1.12.0 / Phase 25D — load this auto-backup
                                        slot into the Compare section as A or B. */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleLoadAutoIntoCompare(entry, "a")
                                        }
                                        disabled={autoBusy !== null}
                                        data-testid={`backup-auto-compare-a-${entry.id}`}
                                    >
                                        {t(
                                            "backup.auto_compare_as_a",
                                            "Compare as A",
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleLoadAutoIntoCompare(entry, "b")
                                        }
                                        disabled={autoBusy !== null}
                                        data-testid={`backup-auto-compare-b-${entry.id}`}
                                    >
                                        {t(
                                            "backup.auto_compare_as_b",
                                            "Compare as B",
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* v1.12.0 / Phase 25B — Compare Backups */}
            <div
                className="backup-compare-section"
                data-testid="backup-compare-section"
            >
                <h3>{t("backup.compare_title", "Compare Backups")}</h3>
                <p className="muted">
                    {t(
                        "backup.compare_help",
                        "Pick two backup files (or one file plus the current state) to see what's changed between them. No data is modified — comparison is read-only.",
                    )}
                </p>
                <div className="backup-compare-pickers">
                    <div className="backup-compare-slot">
                        <label className="backup-compare-slot-label">
                            {t("backup.compare_slot_a", "Backup A (older)")}
                        </label>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => compareInputARef.current?.click()}
                            data-testid="backup-compare-pick-a"
                        >
                            {compareA
                                ? compareA.label
                                : t("backup.compare_pick", "Pick file…")}
                        </button>
                        <input
                            ref={compareInputARef}
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => void handleCompareFilePick("a", e)}
                            style={{display: "none"}}
                            data-testid="backup-compare-input-a"
                        />
                    </div>
                    <div className="backup-compare-slot">
                        <label className="backup-compare-slot-label">
                            {t("backup.compare_slot_b", "Backup B (newer)")}
                        </label>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => compareInputBRef.current?.click()}
                            data-testid="backup-compare-pick-b"
                        >
                            {compareB
                                ? compareB.label
                                : t("backup.compare_pick", "Pick file…")}
                        </button>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => void handleCompareWithCurrent()}
                            data-testid="backup-compare-use-current"
                        >
                            {t(
                                "backup.compare_use_current",
                                "Use current state",
                            )}
                        </button>
                        <input
                            ref={compareInputBRef}
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => void handleCompareFilePick("b", e)}
                            style={{display: "none"}}
                            data-testid="backup-compare-input-b"
                        />
                    </div>
                    {(compareA || compareB) && (
                        <button
                            type="button"
                            className="btn"
                            onClick={handleClearCompare}
                            data-testid="backup-compare-clear"
                        >
                            {t("backup.compare_clear", "Clear")}
                        </button>
                    )}
                </div>
                {compareError !== null && (
                    <p
                        className="backup-compare-error"
                        data-testid="backup-compare-section-error"
                    >
                        {compareError}
                    </p>
                )}
                {compareA && compareB && (
                    <BackupCompare
                        backupA={compareA.payload}
                        backupB={compareB.payload}
                        labelA={compareA.label}
                        labelB={compareB.label}
                    />
                )}
            </div>
        </section>
    );
}
