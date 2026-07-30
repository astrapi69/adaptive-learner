/**
 * RecoveryNotice — the in-product, state-driven notice for the one-off ja/ko/zh
 * element_key recovery (#2161). NOT a broadcast: it renders only when
 * ``assessJkzRecovery`` actually detects recoverable review cards in THIS
 * learner's data, and it disappears on its own once a set is relinked or reset
 * (the assessment re-reads live data). No decision store is needed: undecided ->
 * the notice stays; decided -> the state it detected is gone, so it vanishes.
 *
 * Two user-triggered paths per affected set, never automatic (#2161):
 *   - Relink (restore): re-key the orphaned review cards to the corrected
 *     content. Content-verified + idempotent + atomic (both modes).
 *   - Start fresh (restart): drop the set's progress + review cards.
 *
 * Condition 4: a backup export is OFFERED (recommended, non-forcing) up front,
 * so this irreversible step is reversible.
 */

import {useCallback, useEffect, useState} from "react";

import {useI18n} from "../../hooks/ui/useI18n";
import {exportBackupNow} from "../../lib/backup/exportBackupNow";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    assessJkzRecovery,
    restartRecoverySet,
    restoreRecoverySet,
    type RecoveryAssessment,
} from "../../lib/content/recovery/jkz-recovery-service";
import {notify} from "../../utils/notify";
import RecoverySetRow from "./RecoverySetRow";

export default function RecoveryNotice() {
    const {t} = useI18n();
    const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);
    const [backingUp, setBackingUp] = useState(false);

    const refresh = useCallback(async () => {
        setAssessment(await assessJkzRecovery());
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleBackup = useCallback(async () => {
        const {userId} = readLearnerState();
        if (!userId) return;
        setBackingUp(true);
        try {
            const result = await exportBackupNow(userId);
            if (result.status === "saved") {
                notify.success(
                    t("content.recovery.backup_saved", "Backup saved: {filename}").replace(
                        "{filename}",
                        result.filename,
                    ),
                );
            }
        } catch {
            notify.error(t("content.recovery.failed", "Something went wrong."));
        } finally {
            setBackingUp(false);
        }
    }, [t]);

    if (!assessment || assessment.affectedSets.length === 0) return null;

    return (
        <section
            className="mb-4 rounded-lg border border-border bg-bg-elevated p-4 text-sm text-fg-secondary"
            role="status"
            aria-live="polite"
            data-testid="recovery-notice"
        >
            <h2 className="m-0 mb-1 text-base font-semibold text-fg-primary">
                {t("content.recovery.title", "Restore review progress for corrected lessons")}
            </h2>
            <p className="m-0 mb-3">
                {t(
                    "content.recovery.message",
                    "We corrected some lessons. Review cards for the changed items no longer match.",
                )}
            </p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-fg-muted">
                    {t(
                        "content.recovery.backup_hint",
                        "Recommended first: export a backup so you can undo this if needed.",
                    )}
                </span>
                <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1 font-medium text-fg-primary transition-colors hover:bg-bg-surface disabled:opacity-60"
                    onClick={handleBackup}
                    disabled={backingUp}
                    data-testid="recovery-notice-backup"
                >
                    {backingUp
                        ? t("content.recovery.working", "Working…")
                        : t("content.recovery.backup_action", "Export backup")}
                </button>
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {assessment.affectedSets.map((setId) => (
                    <RecoverySetRow
                        key={setId}
                        setId={setId}
                        cardCount={assessment.remapsBySet[setId]?.length ?? 0}
                        onRestore={() => restoreRecoverySet(setId)}
                        onRestart={() => restartRecoverySet(setId)}
                        onDone={refresh}
                        t={t}
                    />
                ))}
            </ul>
        </section>
    );
}
