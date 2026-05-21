/**
 * Backup compare view (v1.12.0 / Phase 25B).
 *
 * Renders the per-table diff produced by ``lib/backup-diff`` as a
 * sortable, filterable card list. Each card expands to show the
 * added / removed / changed records; each changed record expands
 * to show its field-level diff with old → new format.
 *
 * This component is the SHARED rendering surface for three
 * entry points:
 *   - Settings → Compare Backups (25B): user uploads two files.
 *   - Pre-restore preview (25C): the restore flow embeds this
 *     view above the confirm dialog with one backup pre-filled
 *     from the upload.
 *   - Auto-backup compare (25D, Dexie only): the auto-backup
 *     section embeds this view with both inputs pre-filled from
 *     the ring.
 *
 * Performance: the diff itself runs once per (a, b) pair and is
 * cached in component state; expand / collapse / sort / filter
 * are local UI state, not re-diffs.
 */

import {useEffect, useMemo, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {
    diffBackups,
    filterChangedTables,
    sortTablesAlphabetically,
    sortTablesByDelta,
    type BackupDiff,
    type ChangedRecord,
    type TableDiff,
} from "../lib/backup-diff";
import {renderDiffMarkdown} from "../lib/backup-diff-markdown";
import {notify} from "../utils/notify";
import type {BackupPayload} from "../types/domain";

type SortMode = "delta" | "alpha";

interface BackupCompareProps {
    /** First (older / "before") payload. */
    backupA: BackupPayload;
    /** Second (newer / "after") payload. */
    backupB: BackupPayload;
    /** Human label for backup A (defaults to "Backup A"). */
    labelA?: string;
    /** Human label for backup B (defaults to "Backup B"). */
    labelB?: string;
    /** Hide the Markdown export button (used by pre-restore preview). */
    hideExport?: boolean;
}

export function BackupCompare({
    backupA,
    backupB,
    labelA,
    labelB,
    hideExport,
}: BackupCompareProps) {
    const {t} = useI18n();
    const [diff, setDiff] = useState<BackupDiff | null>(null);
    const [progress, setProgress] = useState<{table: string; completed: number; total: number} | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<SortMode>("delta");
    const [hideUnchanged, setHideUnchanged] = useState(true);
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setDiff(null);
        setError(null);
        setProgress(null);
        diffBackups(backupA, backupB, {
            onProgress: (table, completed, total) => {
                if (!cancelled) setProgress({table, completed, total});
            },
        })
            .then((result) => {
                if (!cancelled) {
                    setDiff(result);
                    setProgress(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                    setProgress(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [backupA, backupB]);

    const visibleTables = useMemo(() => {
        if (!diff) return [];
        let tables: TableDiff[] = diff.tables;
        if (hideUnchanged) tables = filterChangedTables(tables);
        if (sortMode === "delta") return sortTablesByDelta(tables);
        return sortTablesAlphabetically(tables);
    }, [diff, hideUnchanged, sortMode]);

    const toggleTable = (table: string) => {
        setExpandedTables((prev) => {
            const next = new Set(prev);
            if (next.has(table)) next.delete(table);
            else next.add(table);
            return next;
        });
    };

    const toggleRecord = (recordKey: string) => {
        setExpandedRecords((prev) => {
            const next = new Set(prev);
            if (next.has(recordKey)) next.delete(recordKey);
            else next.add(recordKey);
            return next;
        });
    };

    const handleExportMarkdown = () => {
        if (!diff) return;
        try {
            const md = renderDiffMarkdown(diff, {
                labelA: labelA ?? "Backup A",
                labelB: labelB ?? "Backup B",
            });
            const blob = new Blob([md], {type: "text/markdown"});
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `adaptive-learner-diff-${new Date()
                .toISOString()
                .slice(0, 10)}.md`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            notify.success(t("backup.compare_markdown_downloaded", "Diff exported."));
        } catch (err) {
            notify.error(err instanceof Error ? err.message : String(err));
        }
    };

    if (error) {
        return (
            <div className="backup-compare-error" data-testid="backup-compare-error">
                {error}
            </div>
        );
    }

    if (!diff) {
        return (
            <div className="backup-compare-loading" data-testid="backup-compare-loading">
                {progress
                    ? t("backup.compare_progress", "Comparing…") +
                      ` ${progress.completed}/${progress.total}`
                    : t("backup.compare_loading", "Comparing backups…")}
            </div>
        );
    }

    return (
        <div className="backup-compare" data-testid="backup-compare">
            <BackupCompareHeader
                diff={diff}
                labelA={labelA ?? t("backup.compare_label_a", "Backup A")}
                labelB={labelB ?? t("backup.compare_label_b", "Backup B")}
            />

            <div className="backup-compare-controls">
                <label className="backup-compare-control">
                    <input
                        type="checkbox"
                        data-testid="backup-compare-hide-unchanged"
                        checked={hideUnchanged}
                        onChange={(e) => setHideUnchanged(e.target.checked)}
                    />{" "}
                    {t("backup.compare_hide_unchanged", "Hide unchanged tables")}
                </label>
                <label className="backup-compare-control">
                    {t("backup.compare_sort_label", "Sort:")}{" "}
                    <select
                        data-testid="backup-compare-sort"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                    >
                        <option value="delta">
                            {t("backup.compare_sort_delta", "Most changes first")}
                        </option>
                        <option value="alpha">
                            {t("backup.compare_sort_alpha", "Alphabetical")}
                        </option>
                    </select>
                </label>
                {!hideExport && (
                    <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid="backup-compare-export-md"
                        onClick={handleExportMarkdown}
                    >
                        {t("backup.compare_export_md", "Export as Markdown")}
                    </button>
                )}
            </div>

            {visibleTables.length === 0 && (
                <p
                    className="backup-compare-empty muted"
                    data-testid="backup-compare-empty"
                >
                    {t(
                        "backup.compare_no_changes",
                        "The two backups are identical — no differences detected.",
                    )}
                </p>
            )}

            <ul className="backup-compare-table-list">
                {visibleTables.map((table) => (
                    <BackupCompareTableCard
                        key={table.table}
                        table={table}
                        expanded={expandedTables.has(table.table)}
                        expandedRecords={expandedRecords}
                        onToggleTable={() => toggleTable(table.table)}
                        onToggleRecord={toggleRecord}
                    />
                ))}
            </ul>
        </div>
    );
}

function BackupCompareHeader({
    diff,
    labelA,
    labelB,
}: {
    diff: BackupDiff;
    labelA: string;
    labelB: string;
}) {
    const {t} = useI18n();
    return (
        <header className="backup-compare-header" data-testid="backup-compare-header">
            <div className="backup-compare-side">
                <strong>{labelA}</strong>
                <span className="muted">
                    {asDate(diff.backup_a.created_at)} ·{" "}
                    {diff.backup_a.total_records}{" "}
                    {t("backup.compare_records", "records")}
                </span>
            </div>
            <div className="backup-compare-arrow">→</div>
            <div className="backup-compare-side">
                <strong>{labelB}</strong>
                <span className="muted">
                    {asDate(diff.backup_b.created_at)} ·{" "}
                    {diff.backup_b.total_records}{" "}
                    {t("backup.compare_records", "records")}
                </span>
            </div>
            <div className="backup-compare-totals">
                <span className="diff-chip diff-chip-added" data-testid="totals-added">
                    +{diff.totals.added}
                </span>
                <span
                    className="diff-chip diff-chip-removed"
                    data-testid="totals-removed"
                >
                    -{diff.totals.removed}
                </span>
                <span
                    className="diff-chip diff-chip-changed"
                    data-testid="totals-changed"
                >
                    ~{diff.totals.changed}
                </span>
                <span
                    className="diff-chip diff-chip-unchanged"
                    data-testid="totals-unchanged"
                >
                    ={diff.totals.unchanged}
                </span>
            </div>
        </header>
    );
}

function BackupCompareTableCard({
    table,
    expanded,
    expandedRecords,
    onToggleTable,
    onToggleRecord,
}: {
    table: TableDiff;
    expanded: boolean;
    expandedRecords: Set<string>;
    onToggleTable: () => void;
    onToggleRecord: (key: string) => void;
}) {
    const {t} = useI18n();
    return (
        <li
            className="backup-compare-table-card"
            data-testid={`backup-compare-table-${table.table}`}
        >
            <button
                type="button"
                className="backup-compare-table-head"
                onClick={onToggleTable}
                aria-expanded={expanded}
                data-testid={`backup-compare-toggle-${table.table}`}
            >
                <span className="backup-compare-table-name">{table.table}</span>
                <span className="backup-compare-table-chips">
                    {table.added.length > 0 && (
                        <span className="diff-chip diff-chip-added">
                            +{table.added.length}
                        </span>
                    )}
                    {table.removed.length > 0 && (
                        <span className="diff-chip diff-chip-removed">
                            -{table.removed.length}
                        </span>
                    )}
                    {table.changed.length > 0 && (
                        <span className="diff-chip diff-chip-changed">
                            ~{table.changed.length}
                        </span>
                    )}
                    {table.unchanged > 0 && (
                        <span className="diff-chip diff-chip-unchanged">
                            ={table.unchanged}
                        </span>
                    )}
                </span>
                <span className="backup-compare-toggle-icon">
                    {expanded ? "▾" : "▸"}
                </span>
            </button>
            {expanded && (
                <div
                    className="backup-compare-table-body"
                    data-testid={`backup-compare-body-${table.table}`}
                >
                    {table.high_volume &&
                        table.added.length + table.removed.length + table.changed.length >
                            20 && (
                            <p
                                className="muted"
                                data-testid={`backup-compare-summary-${table.table}`}
                            >
                                {t("backup.compare_high_volume_hint",
                                    "High-volume table — record-level previews shown abbreviated.")}
                            </p>
                        )}
                    {table.added.length > 0 && (
                        <DiffSection
                            title={t("backup.compare_section_added", "Added")}
                            kind="added"
                            records={table.added}
                            table={table.table}
                        />
                    )}
                    {table.removed.length > 0 && (
                        <DiffSection
                            title={t("backup.compare_section_removed", "Removed")}
                            kind="removed"
                            records={table.removed}
                            table={table.table}
                        />
                    )}
                    {table.changed.length > 0 && (
                        <ChangedSection
                            title={t("backup.compare_section_changed", "Changed")}
                            records={table.changed}
                            table={table.table}
                            expandedRecords={expandedRecords}
                            onToggleRecord={onToggleRecord}
                        />
                    )}
                </div>
            )}
        </li>
    );
}

function DiffSection({
    title,
    kind,
    records,
    table,
}: {
    title: string;
    kind: "added" | "removed";
    records: {id: string; preview: string}[];
    table: string;
}) {
    return (
        <div className={`backup-compare-section backup-compare-section-${kind}`}>
            <h4>{title}</h4>
            <ul>
                {records.map((rec) => (
                    <li
                        key={rec.id}
                        data-testid={`backup-compare-record-${kind}-${table}-${rec.id}`}
                    >
                        <span className={`diff-marker diff-marker-${kind}`}>
                            {kind === "added" ? "+" : "-"}
                        </span>{" "}
                        {rec.preview}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ChangedSection({
    title,
    records,
    table,
    expandedRecords,
    onToggleRecord,
}: {
    title: string;
    records: ChangedRecord[];
    table: string;
    expandedRecords: Set<string>;
    onToggleRecord: (key: string) => void;
}) {
    const {t} = useI18n();
    return (
        <div className="backup-compare-section backup-compare-section-changed">
            <h4>{title}</h4>
            <ul>
                {records.map((rec) => {
                    const recordKey = `${table}/${rec.id}`;
                    const isOpen = expandedRecords.has(recordKey);
                    return (
                        <li
                            key={rec.id}
                            data-testid={`backup-compare-record-changed-${table}-${rec.id}`}
                        >
                            <button
                                type="button"
                                className="backup-compare-changed-head"
                                onClick={() => onToggleRecord(recordKey)}
                                aria-expanded={isOpen}
                                data-testid={`backup-compare-changed-toggle-${table}-${rec.id}`}
                            >
                                <span className="diff-marker diff-marker-changed">~</span>{" "}
                                {rec.preview}{" "}
                                <span className="muted">
                                    ({rec.fields.length}{" "}
                                    {t("backup.compare_field_changes", "field changes")})
                                </span>{" "}
                                <span className="backup-compare-toggle-icon">
                                    {isOpen ? "▾" : "▸"}
                                </span>
                            </button>
                            {isOpen && (
                                <table
                                    className="backup-compare-field-table"
                                    data-testid={`backup-compare-fields-${table}-${rec.id}`}
                                >
                                    <thead>
                                        <tr>
                                            <th>
                                                {t("backup.compare_field", "Field")}
                                            </th>
                                            <th>{t("backup.compare_old", "Old")}</th>
                                            <th>{t("backup.compare_new", "New")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rec.fields.map((f) => (
                                            <tr key={f.field}>
                                                <td>{f.field}</td>
                                                <td className="diff-value-old">
                                                    <s>{formatValue(f.old_value)}</s>
                                                </td>
                                                <td className="diff-value-new">
                                                    {formatValue(f.new_value)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function formatValue(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "(unset)";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

function asDate(value: string): string {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
}
