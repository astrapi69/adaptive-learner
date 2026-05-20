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

import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
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

function triggerDownload(payload: BackupPayload, filename: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function backupFilename(userId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const short = userId.slice(0, 8);
    return `adaptive-learner-backup-${date}-${short}.json`;
}

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {userId} = readLearnerState();

    const [busy, setBusy] = useState<"export" | "import" | null>(null);
    const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
    const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(
        null,
    );
    const [comparison, setComparison] = useState<ComparisonRow[] | null>(null);
    const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(
        null,
    );

    useEffect(() => {
        // Re-read on mount; a user may have backed up via another
        // tab in the meantime.
        setLastBackup(readLastBackup());
    }, []);

    if (!userId) {
        return null;
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
            triggerDownload(payload, backupFilename(userId));
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
                                <th>
                                    {t("backup.table_header", "Table")}
                                </th>
                                <th>
                                    {t("backup.current_header", "Current")}
                                </th>
                                <th>
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
        </section>
    );
}
