/**
 * "Compare Backups" picker section (v1.12.0 / Phase 25B).
 *
 * Lets the user pick two backup files (or one file plus the current
 * state) and renders the per-table delta via {@link BackupCompare}.
 * Read-only: no stored data is modified. Compare state is owned by the
 * shared {@link useBackupCompare} hook so the Dexie auto-backup list
 * can fill the same two slots.
 */

import {Button} from "@/components/ui/button";

import {BackupCompare} from "./BackupCompare";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {UseBackupCompareResult} from "../../../hooks/system/useBackupCompare";

interface BackupCompareSectionProps {
    /** Shared compare state + handlers from {@link useBackupCompare}. */
    compare: UseBackupCompareResult;
}

/** Compare-backups picker UI; see {@link useBackupCompare} for state. */
export function BackupCompareSection({compare}: BackupCompareSectionProps) {
    const {t} = useI18n();
    const {
        compareA,
        compareB,
        compareError,
        compareInputARef,
        compareInputBRef,
        handleCompareFilePick,
        handleCompareWithCurrent,
        handleClearCompare,
    } = compare;

    return (
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
                    <Button
                        type="button"
                        variant="secondary"
                        className="max-w-full whitespace-normal break-words text-left"
                        onClick={() => compareInputARef.current?.click()}
                        data-testid="backup-compare-pick-a"
                    >
                        {compareA
                            ? compareA.label
                            : t("backup.compare_pick", "Pick file…")}
                    </Button>
                    <input
                        ref={compareInputARef}
                        type="file"
                        accept=".alb,.json,application/zip,application/json"
                        onChange={(e) => void handleCompareFilePick("a", e)}
                        style={{display: "none"}}
                        data-testid="backup-compare-input-a"
                    />
                </div>
                <div className="backup-compare-slot">
                    <label className="backup-compare-slot-label">
                        {t("backup.compare_slot_b", "Backup B (newer)")}
                    </label>
                    <Button
                        type="button"
                        variant="secondary"
                        className="max-w-full whitespace-normal break-words text-left"
                        onClick={() => compareInputBRef.current?.click()}
                        data-testid="backup-compare-pick-b"
                    >
                        {compareB
                            ? compareB.label
                            : t("backup.compare_pick", "Pick file…")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCompareWithCurrent()}
                        data-testid="backup-compare-use-current"
                    >
                        {t(
                            "backup.compare_use_current",
                            "Use current state",
                        )}
                    </Button>
                    <input
                        ref={compareInputBRef}
                        type="file"
                        accept=".alb,.json,application/zip,application/json"
                        onChange={(e) => void handleCompareFilePick("b", e)}
                        style={{display: "none"}}
                        data-testid="backup-compare-input-b"
                    />
                </div>
                {(compareA || compareB) && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearCompare}
                        data-testid="backup-compare-clear"
                    >
                        {t("backup.compare_clear", "Clear")}
                    </Button>
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
    );
}
