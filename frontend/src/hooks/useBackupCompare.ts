/**
 * Shared state + handlers for the backup "Compare Backups" feature.
 *
 * The compare slots (A / B) are written from two places: the Compare
 * Backups picker section AND the "Compare as A / B" buttons in the
 * Dexie auto-backup list. Lifting the state into this hook lets both
 * surfaces drive the same two slots without prop-threading the setters
 * through unrelated components.
 *
 * Read-only: comparison never mutates stored data.
 */

import {useRef, useState} from "react";

import {useI18n} from "./useI18n";
import {getStorage} from "../storage";
import {getAutoBackupPayload, type AutoBackupSummary} from "../storage/auto-backup";
import {readBackupFile as readValidatedBackupFile} from "../lib/backup/validateBackupFile";
import type {BackupPayload} from "../types/domain";

/** One filled compare slot: a parsed backup plus a display label. */
export interface BackupCompareSlot {
    payload: BackupPayload;
    label: string;
}

/**
 * Compare-feature state and handlers shared by the picker section and
 * the auto-backup list. Returned shape is consumed by
 * {@link BackupCompareSection} and wired into the auto-backup list via
 * {@link loadAutoIntoCompare}.
 *
 * @param userId - Active user, or null before the learner is known.
 */
export function useBackupCompare(userId: string | null) {
    const {t} = useI18n();
    const storage = getStorage();

    const compareInputARef = useRef<HTMLInputElement>(null);
    const compareInputBRef = useRef<HTMLInputElement>(null);
    const [compareA, setCompareA] = useState<BackupCompareSlot | null>(null);
    const [compareB, setCompareB] = useState<BackupCompareSlot | null>(null);
    const [compareError, setCompareError] = useState<string | null>(null);

    async function readBackupFile(file: File): Promise<BackupPayload> {
        // Format is decided by MAGIC BYTES, not the extension: a ZIP
        // signature is an EXP-031 ``.alb`` container, anything else is
        // parsed as a legacy ``.json`` backup. Delegating to the shared
        // validated reader keeps the compare path in lock-step with the
        // Settings/onboarding restore surfaces (both accept ``.alb`` +
        // ``.json``) so a ``.alb`` backup is comparable, not rejected.
        const result = await readValidatedBackupFile(file);
        if (!result.ok) {
            throw new Error(
                result.error === "too_large"
                    ? t(
                          "backup.too_large",
                          "This backup file is too large (over 100 MB).",
                      )
                    : t(
                          "backup.invalid_format",
                          "This file is not a valid Adaptive Learner backup.",
                      ),
            );
        }
        return result.payload;
    }

    /** Parse a picked file into the given compare slot. */
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

    /** Fill compare slot B from a live export of the current state. */
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

    /** Reset both compare slots and any error. */
    function handleClearCompare() {
        setCompareA(null);
        setCompareB(null);
        setCompareError(null);
    }

    /** Load a stored auto-backup into compare slot A or B. */
    async function loadAutoIntoCompare(
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

    return {
        compareA,
        compareB,
        compareError,
        compareInputARef,
        compareInputBRef,
        handleCompareFilePick,
        handleCompareWithCurrent,
        handleClearCompare,
        loadAutoIntoCompare,
    };
}

/** Return shape of {@link useBackupCompare}. */
export type UseBackupCompareResult = ReturnType<typeof useBackupCompare>;
