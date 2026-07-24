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

import {Download, ExternalLink, Upload} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {BackupCompare} from "./BackupCompare";
import {useI18n} from "../../../hooks/ui/useI18n";
import {readLearnerState} from "../../../lib/learning/learnerState";
import {emitSettingsRefresh} from "../../../lib/settings/settings-refresh-bus";
import {getStorage, resolveStorageMode} from "../../../storage";
import {SHARE_URL} from "../../../lib/share/generate-share-text";
import {notify} from "../../../utils/notify";
import {readBackupFile} from "../../../lib/backup/validateBackupFile";
import type {BackupPayload, BackupStats, RestoreSummary} from "../../../types/domain";
import {BackupAutoBackups} from "./BackupAutoBackups";
import {BackupCompareSection} from "./BackupCompareSection";
import {useBackupCompare} from "../../../hooks/system/useBackupCompare";

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
import {saveBackupToDisk, backupFilename} from "../../../utils/backup-download";
import {
    applyLocalStorageSnapshot,
    withLocalStorageSnapshot,
} from "../../../lib/backup/localStorageSnapshot";

interface ComparisonRow {
    table: string;
    current: number;
    incoming: number;
}

// BACKUP-DIR-EXPORT-01 — the high-signal tables surfaced in the
// "Your backup contains" preview. Each maps a backup-table name to
// an i18n label key; only non-zero counts are shown. The full row
// total is rendered separately.
const PREVIEW_TABLES: {table: string; key: string; fallback: string}[] = [
    {table: "element_errors", key: "backup.count_element_errors", fallback: "{{n}} error entries"},
    {table: "lesson_progress", key: "backup.count_lesson_progress", fallback: "{{n}} lesson progress"},
    {table: "user_badges", key: "backup.count_user_badges", fallback: "{{n}} badges"},
    {table: "learning_sessions", key: "backup.count_sessions", fallback: "{{n}} sessions"},
    {table: "learning_projects", key: "backup.count_projects", fallback: "{{n}} projects"},
    {table: "imported_conversations", key: "backup.count_imports", fallback: "{{n}} chat imports"},
];

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

type Translate = (key: string, fallback?: string) => string;
type RestoreDiffCounts = {added: number; removed: number; changed: number};

/** The two primary backup actions (Create / Restore) + the hidden
 *  file input. The busy state drives the per-button label / spinner
 *  copy. */
function BackupActionToolbar({
    busy,
    onExport,
    onImport,
    fileInputRef,
    onFileChange,
    t,
}: {
    busy: "export" | "import" | null;
    onExport: () => void;
    onImport: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    t: Translate;
}) {
    const exportLabel =
        busy === "export"
            ? t("backup.exporting", "Exporting…")
            : t("backup.export", "Create Backup");
    const importLabel =
        busy === "import"
            ? t("backup.importing", "Restoring…")
            : t("backup.import", "Restore from Backup");
    return (
        <div className="backup-actions flex flex-col gap-2 md:flex-row">
            <Button
                type="button"
                variant="default"
                onClick={onExport}
                disabled={busy !== null}
                data-testid="backup-export"
                className="w-full md:w-auto"
                aria-label={exportLabel}
                title={exportLabel}
            >
                <Download className="h-5 w-5" aria-hidden="true" />
                <span className="hidden md:inline">{exportLabel}</span>
            </Button>
            <Button
                type="button"
                variant="outline"
                onClick={onImport}
                disabled={busy !== null}
                data-testid="backup-import"
                className="w-full md:w-auto"
                aria-label={importLabel}
                title={importLabel}
            >
                <Upload className="h-5 w-5" aria-hidden="true" />
                <span className="hidden md:inline">{importLabel}</span>
            </Button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".alb,application/zip,application/json,.json"
                onChange={onFileChange}
                className="hidden"
                data-testid="backup-file-input"
            />
        </div>
    );
}

/** The pre-restore confirmation panel: the current-vs-backup row-count
 *  table, the optional per-table diff preview, and the Confirm / Cancel
 *  actions. */
function RestoreConfirmPanel({
    comparison,
    currentSnapshot,
    pendingPayload,
    busy,
    restoreDiffCounts,
    onConfirm,
    onCancel,
    onCounts,
    t,
}: {
    comparison: ComparisonRow[];
    currentSnapshot: BackupPayload | null;
    pendingPayload: BackupPayload;
    busy: "export" | "import" | null;
    restoreDiffCounts: RestoreDiffCounts | null;
    onConfirm: () => void;
    onCancel: () => void;
    onCounts: (counts: RestoreDiffCounts) => void;
    t: Translate;
}) {
    return (
        <div className="backup-comparison" data-testid="backup-comparison">
            <h3>{t("backup.comparison_title", "Confirm restore")}</h3>
            <p className="muted">
                {t(
                    "backup.comparison_help",
                    "Restore will merge: new records inserted, mutable records updated only if the backup is newer, history rows kept as-is. Nothing is deleted. API keys are ignored.",
                )}
            </p>
            <table className="backup-comparison-table">
                <thead>
                    <tr>
                        <th scope="col">{t("backup.table_header", "Table")}</th>
                        <th scope="col">{t("backup.current_header", "Current")}</th>
                        <th scope="col">{t("backup.incoming_header", "Backup")}</th>
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
                    labelA={t("backup.compare_current_label", "Current state")}
                    labelB={t("backup.incoming_header", "Backup")}
                    hideExport
                    onDiffReady={(diff) =>
                        onCounts({
                            added: diff.totals.added,
                            removed: diff.totals.removed,
                            changed: diff.totals.changed,
                        })
                    }
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

/** The post-restore result panel: the headline counts, the per-table
 *  breakdown, and the error-detail list. */
function RestoreSummaryPanel({
    summary,
    t,
}: {
    summary: RestoreSummary;
    t: Translate;
}) {
    return (
        <div className="backup-summary" data-testid="backup-summary">
            <p>{t("backup.restored_summary", "Restore complete.")}</p>
            <ul>
                <li>
                    {t("backup.restored_inserted", "Inserted: {{n}}").replace(
                        "{{n}}",
                        String(summary.inserted),
                    )}
                </li>
                <li>
                    {t("backup.restored_updated", "Updated: {{n}}").replace(
                        "{{n}}",
                        String(summary.updated),
                    )}
                </li>
                <li>
                    {t("backup.restored_skipped", "Skipped: {{n}}").replace(
                        "{{n}}",
                        String(summary.skipped),
                    )}
                </li>
                {summary.errors.length > 0 && (
                    <li>
                        {t("backup.restored_errors", "Errors: {{n}}").replace(
                            "{{n}}",
                            String(summary.errors.length),
                        )}
                    </li>
                )}
            </ul>

            {/* Per-table breakdown (#126). Scrollable so all 30
                tables stay reachable without pushing the page. */}
            <div
                className="backup-summary-tables max-h-72 overflow-y-auto"
                data-testid="backup-summary-tables"
            >
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="text-left">
                                {t("backup.table_header", "Table")}
                            </th>
                            <th className="text-right">
                                {t("backup.col_inserted", "Ins.")}
                            </th>
                            <th className="text-right">
                                {t("backup.col_updated", "Upd.")}
                            </th>
                            <th className="text-right">
                                {t("backup.col_skipped", "Skip")}
                            </th>
                            <th className="text-right">
                                {t("backup.col_errors", "Err.")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(summary.tables)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([table, counts]) => (
                                <tr
                                    key={table}
                                    data-testid={`backup-summary-row-${table}`}
                                    className={
                                        counts.errors.length > 0
                                            ? "text-[var(--error)]"
                                            : undefined
                                    }
                                >
                                    <td className="text-left">{table}</td>
                                    <td className="text-right">{counts.inserted}</td>
                                    <td className="text-right">{counts.updated}</td>
                                    <td className="text-right">{counts.skipped}</td>
                                    <td className="text-right">
                                        {counts.errors.length}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {summary.errors.length > 0 && (
                <div
                    className="backup-summary-errors max-h-48 overflow-y-auto"
                    data-testid="backup-summary-errors"
                >
                    <p className="font-semibold text-[var(--error)]">
                        {t("backup.error_details", "Error details")}
                    </p>
                    <ul>
                        {summary.errors.map((err, idx) => (
                            <li
                                key={idx}
                                className="text-[var(--error)] break-words"
                            >
                                {err}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function BackupSection() {
    const {t} = useI18n();
    const storage = getStorage();
    const storageMode = resolveStorageMode();
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Bug 2: after a restore (success or failure) scroll the section
    // back to the top so the prominent action buttons stay visible.
    const sectionRef = useRef<HTMLElement>(null);
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
    // BACKUP-DIR-EXPORT-01 — "Your backup contains" preview. Read-
    // only row counts so the user knows what a backup will hold
    // before they save it.
    const [backupStats, setBackupStats] = useState<BackupStats | null>(null);

    // v1.12.0 / Phase 25B — compare two backups (or one + live);
    // shared state so the Dexie auto-backup list can fill the slots.
    const compare = useBackupCompare(userId);


    useEffect(() => {
        // Re-read on mount; a user may have backed up via another
        // tab in the meantime.
        setLastBackup(readLastBackup());
    }, []);

    useEffect(() => {
        // Load the row counts for the "what's in my backup" preview.
        // Read-only; failures (offline API mode) leave the preview
        // hidden rather than surfacing an error.
        if (userId === null) {
            return;
        }
        let cancelled = false;
        storage.backup
            .stats(userId)
            .then((stats) => {
                if (!cancelled) {
                    setBackupStats(stats);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setBackupStats(null);
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

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
            // Attach a localStorage snapshot (preferences + contributions
            // that don't live in the DB tables) so the backup is portable
            // across a browser reset / device migration (P1 offline parity).
            const payload = withLocalStorageSnapshot(
                await storage.backup.export(userId),
            );
            const filename = backupFilename(userId);
            const outcome = await saveBackupToDisk(payload, filename);
            if (outcome.method === "cancelled") {
                // User dismissed the OS save dialog. No file written,
                // so do not record a "last backup" or claim success.
                return;
            }
            const iso = new Date().toISOString();
            writeLastBackup(iso);
            setLastBackup(iso);
            const total = payload.stats.total_records;
            const key =
                outcome.method === "picker"
                    ? "backup.saved_as"
                    : "backup.downloaded";
            const fallback =
                outcome.method === "picker"
                    ? "Backup saved: {{filename}}"
                    : "Backup downloaded: {{filename}} ({{count}} records).";
            notify.success(
                t(key, fallback)
                    .replace("{{filename}}", outcome.filename)
                    .replace("{{count}}", String(total)),
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
            // Validate the picked file as an Adaptive Learner backup
            // BEFORE the restore preview (#640/#642). Any non-backup file
            // (wrong/missing ``format`` marker, not JSON, a non-object,
            // a truncated download, an over-large file) is a user mistake,
            // not an app fault — ``readBackupFile`` returns a typed result
            // and never throws, so show a gentle ``warning`` (no "Report
            // Issue") and stop, instead of an error toast that reads like
            // a bug. The ``format`` marker is the single source of truth
            // for "is this ours?".
            const result = await readBackupFile(file);
            if (!result.ok) {
                notify.warning(
                    result.error === "too_large"
                        ? t(
                              "backup.too_large",
                              "This backup file is too large (over 100 MB).",
                          )
                        : t(
                              "backup.not_a_backup_file",
                              "This file is not a valid backup file. Please choose a file exported with 'Create backup'.",
                          ),
                );
                return;
            }
            const parsed = result.payload;
            // EXP-031 / BAK-03 — surface an app-version gap from the .alb
            // manifest (readable without unpacking) before the restore. The
            // existing confirm panel is the "import anyway?" gate, so this
            // is a non-blocking heads-up, not a second modal.
            if (
                result.container === "alb" &&
                result.manifest &&
                result.manifest.app_version &&
                result.manifest.app_version !== __APP_VERSION__
            ) {
                notify.warning(
                    t(
                        "backup.version_mismatch",
                        "This backup is from version {{from}}; this app is {{to}}. Review the changes below and confirm to import.",
                    )
                        .replace("{{from}}", result.manifest.app_version)
                        .replace("{{to}}", __APP_VERSION__),
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

    function scrollSectionToTop() {
        // Bug 2: keep the prominent action buttons in view after a
        // restore. The lesson/settings scroll container is ``#root``;
        // ``scrollIntoView`` walks to whichever ancestor scrolls.
        requestAnimationFrame(() => {
            sectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    }

    async function handleConfirmRestore() {
        if (pendingPayload === null || userId === null) {
            return;
        }
        setBusy("import");
        try {
            const summary = await storage.backup.import(userId, pendingPayload);
            // Restore the localStorage snapshot (preferences + contributions)
            // frontend-side, in both storage modes — the backend ignores the
            // payload's local_storage block. Legacy backups carry none -> no-op.
            const localApplied = applyLocalStorageSnapshot(
                pendingPayload.local_storage,
            );
            // eslint-disable-next-line no-console -- round-trip trace, see below
            console.log("[Backup] localStorage keys applied:", localApplied);
            // #126 — surface the full result in the browser console so a
            // real Export -> Import round-trip is debuggable without a
            // backend log. Errors are logged separately as a list.
            // eslint-disable-next-line no-console -- #126: intentional round-trip trace for backend-less debugging
            console.log("[Backup] Import result:", summary);
            if (summary.errors.length > 0) {
                console.error("[Backup] Import errors:", summary.errors);
            }
            setRestoreSummary(summary);
            setPendingPayload(null);
            setComparison(null);
            setCurrentSnapshot(null);
            setRestoreDiffCounts(null);
            // #1765 (class fix) — a restore can change user settings (keys,
            // provider, model overrides). Signal the Settings page to re-read
            // so the AI tab reflects the restore without a manual reload.
            emitSettingsRefresh();
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
                t("backup.restored_errors", "Errors: {{n}}").replace(
                    "{{n}}",
                    String(summary.errors.length),
                ),
            ];
            const summaryMsg = parts.join(" - ");
            if (summary.errors.length > 0) {
                // Persistent error toast (does not auto-dismiss): the user
                // must see that some rows failed. Per-table + per-row detail
                // is rendered in the scrollable summary panel below.
                notify.error(summaryMsg);
            } else {
                notify.success(summaryMsg);
            }
            // #787 — a Dexie-origin backup can't restore API keys (active
            // keys are stripped on export; rollback-cache rows without a
            // usable key are skipped). Tell the user to re-enter them
            // instead of leaving the keys silently missing.
            if ((summary.api_keys_skipped ?? 0) > 0) {
                notify.warning(
                    t(
                        "backup.api_keys_skipped",
                        "API keys could not be imported. Please re-enter them in Settings > Integrations.",
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
            scrollSectionToTop();
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
            ref={sectionRef}
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

            <BackupActionToolbar
                busy={busy}
                onExport={handleExport}
                onImport={handlePickFile}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                t={t}
            />

            {/* #1085 — online-to-local migration entry: only meaningful on a
                local (API mode) install, where the data lives elsewhere. */}
            {storageMode === "api" && (
                <div
                    className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                    data-testid="migration-settings-card"
                >
                    <h3 className="m-0 text-base font-semibold">
                        {t(
                            "migration.settings.title",
                            "Import from the online version",
                        )}
                    </h3>
                    <p className="mt-1 mb-0 text-sm text-[var(--fg-muted)]">
                        {t(
                            "migration.settings.body",
                            "Used Adaptive Learner online? Create a backup there, then use Import above to bring your data over.",
                        )}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 min-h-11 gap-2"
                        onClick={() =>
                            window.open(SHARE_URL, "_blank", "noopener,noreferrer")
                        }
                        data-testid="migration-settings-open-online"
                    >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        {t("migration.action.open_online", "Open online version")}
                    </Button>
                </div>
            )}

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

            {backupStats !== null && backupStats.total_records > 0 && (
                <div
                    className="backup-contents"
                    data-testid="backup-contents"
                >
                    <p className="backup-contents-title">
                        {t("backup.contains_title", "Your backup contains:")}
                    </p>
                    <ul className="backup-contents-list">
                        {PREVIEW_TABLES.map(({table, key, fallback}) => {
                            const n = backupStats.tables[table] ?? 0;
                            if (n === 0) {
                                return null;
                            }
                            return (
                                <li
                                    key={table}
                                    data-testid={`backup-contents-${table}`}
                                >
                                    {t(key, fallback).replace("{{n}}", String(n))}
                                </li>
                            );
                        })}
                        <li
                            className="backup-contents-total"
                            data-testid="backup-contents-total"
                        >
                            {t(
                                "backup.record_count",
                                "{{count}} records total",
                            ).replace("{{count}}", String(backupStats.total_records))}
                        </li>
                    </ul>
                </div>
            )}

            {pendingPayload !== null && comparison !== null && (
                <RestoreConfirmPanel
                    comparison={comparison}
                    currentSnapshot={currentSnapshot}
                    pendingPayload={pendingPayload}
                    busy={busy}
                    restoreDiffCounts={restoreDiffCounts}
                    onConfirm={handleConfirmRestore}
                    onCancel={handleCancelRestore}
                    onCounts={setRestoreDiffCounts}
                    t={t}
                />
            )}

            {restoreSummary !== null && (
                <RestoreSummaryPanel summary={restoreSummary} t={t} />
            )}

            {storageMode === "dexie" && (
                <BackupAutoBackups
                    userId={userId}
                    onRestored={setRestoreSummary}
                    onLoadIntoCompare={(entry, slot) =>
                        void compare.loadAutoIntoCompare(entry, slot)
                    }
                />
            )}

            <BackupCompareSection compare={compare} />
        </section>
    );
}
