/**
 * ResetSetResultsDialog — the "Alles wiederholen" confirmation (#3171).
 *
 * Names what the reset touches (score, stars, study time of N lessons),
 * what it keeps (the previous run's mistakes as history, XP and badges)
 * and the learner's current average, so the decision is an informed one.
 * Confirm stays disabled while the summary is still loading or the reset
 * is running. Props-driven: the summary arrives from the caller (built by
 * ``summarizeSetResults``), the outcome goes back through the callbacks.
 * Built on the shared ``ConfirmDialog`` (the same pattern as "Set erneut
 * durcharbeiten", #2125).
 *
 * @example
 * <ResetSetResultsDialog
 *   open={open}
 *   setTitle={set.title}
 *   summary={summary}
 *   busy={busy}
 *   onConfirm={() => void reset()}
 *   onCancel={() => setOpen(false)}
 * />
 */

import {useI18n} from "../../hooks/ui/useI18n";
import type {SetResultsSummary} from "../../lib/learning-path/reset-set-results";
import ConfirmDialog from "../../shared/feedback/ConfirmDialog";

export interface ResetSetResultsDialogProps {
    open: boolean;
    setTitle: string;
    /** ``null`` while the summary is still loading. */
    summary: SetResultsSummary | null;
    /** True while the reset runs; keeps confirm disabled. */
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ResetSetResultsDialog({
    open,
    setTitle,
    summary,
    busy,
    onConfirm,
    onCancel,
}: ResetSetResultsDialogProps) {
    const {t} = useI18n();
    const message = t(
        "learning_path.reset_all.message",
        "The results of “{title}” are reset: score, stars and study time of {lessons} lessons. A new run starts at lesson 1; the mistakes of the previous run stay as history. XP and badges are not affected.",
    )
        .replace("{title}", setTitle)
        .replace("{lessons}", String(summary?.lessonCount ?? 0));
    const averageLine =
        summary && summary.averagePercent !== null
            ? t("learning_path.reset_all.average", "Average so far: {percent}%").replace(
                  "{percent}",
                  String(summary.averagePercent),
              )
            : t("learning_path.reset_all.no_average", "No average yet.");

    return (
        <ConfirmDialog
            open={open}
            title={t("learning_path.reset_all.title", "Reset all results?")}
            message={message}
            variant="danger"
            confirmLabel={t("learning_path.reset_all.confirm", "Reset and start over")}
            cancelLabel={t("learning_path.reset_all.cancel", "Cancel")}
            confirmDisabled={busy || summary === null}
            testId="reset-set-results-confirm"
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <p
                className="m-0 text-sm font-medium text-fg-secondary"
                data-testid="reset-set-results-average"
            >
                {averageLine}
            </p>
        </ConfirmDialog>
    );
}
