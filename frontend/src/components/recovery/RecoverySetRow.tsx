/**
 * One affected set inside {@link RecoveryNotice} (#2161). Owns the two
 * user-triggered choices for its set and shows the NUMERIC result (a partial
 * relink is a valid, visible outcome). Restart is destructive, so it asks for
 * an inline confirm first. After either action completes it calls ``onDone`` so
 * the parent re-assesses and the notice reflects the new state.
 */

import {useState} from "react";

import {notify} from "../../utils/notify";
import type {RecoveryOutcome} from "../../lib/content/recovery/jkz-recovery-service";

type Translate = (key: string, fallback?: string) => string;

interface RecoverySetRowProps {
    setId: string;
    cardCount: number;
    onRestore: () => Promise<RecoveryOutcome>;
    onRestart: () => Promise<void>;
    onDone: () => void | Promise<void>;
    t: Translate;
}

/** Friendly display label for the three known incident sets; falls back to the
 *  raw id for anything else. */
const SET_LABELS: Record<string, string> = {
    "ja-a1-from-de": "Japanese A1",
    "ko-a1-from-de": "Korean A1",
    "zh-a1-from-de": "Chinese A1",
};

export default function RecoverySetRow({
    setId,
    cardCount,
    onRestore,
    onRestart,
    onDone,
    t,
}: RecoverySetRowProps) {
    const [busy, setBusy] = useState(false);
    const [confirmRestart, setConfirmRestart] = useState(false);

    async function runRestore() {
        setBusy(true);
        try {
            const outcome = await onRestore();
            notify.success(
                t("content.recovery.restore_result", "Relinked {applied} review cards ({skipped} were already correct).")
                    .replace("{applied}", String(outcome.applied))
                    .replace("{skipped}", String(outcome.skipped)),
            );
            if (outcome.unmapped > 0) {
                notify.info(
                    t(
                        "content.recovery.restore_unmapped",
                        "{unmapped} cards could not be relinked because the lesson changed again; they were left unchanged.",
                    ).replace("{unmapped}", String(outcome.unmapped)),
                );
            }
            await onDone();
        } catch {
            notify.error(t("content.recovery.failed", "Something went wrong."));
        } finally {
            setBusy(false);
        }
    }

    async function runRestart() {
        setBusy(true);
        try {
            await onRestart();
            notify.success(
                t("content.recovery.restart_result", "Set reset. You can start it from the beginning."),
            );
            await onDone();
        } catch {
            notify.error(t("content.recovery.failed", "Something went wrong."));
        } finally {
            setBusy(false);
            setConfirmRestart(false);
        }
    }

    const label = SET_LABELS[setId] ?? setId;

    return (
        <li
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2"
            data-testid={`recovery-set-${setId}`}
        >
            <span className="font-medium text-fg-primary">{label}</span>
            <span className="text-fg-muted">
                {t("content.recovery.set_cards", "{count} affected review cards").replace(
                    "{count}",
                    String(cardCount),
                )}
            </span>
            <span className="flex-1" />
            {confirmRestart ? (
                <>
                    <span className="text-fg-secondary">
                        {t(
                            "content.recovery.restart_confirm",
                            "Start fresh? Saved progress and review cards for this set are removed.",
                        )}
                    </span>
                    <button
                        type="button"
                        className="rounded-md bg-[var(--danger)] px-3 py-1 font-medium text-[var(--danger-fg)] transition-colors hover:opacity-90 disabled:opacity-60"
                        onClick={runRestart}
                        disabled={busy}
                        data-testid={`recovery-restart-confirm-${setId}`}
                    >
                        {t("content.recovery.restart_confirm_yes", "Yes, start fresh")}
                    </button>
                    <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-fg-primary transition-colors hover:bg-bg-elevated disabled:opacity-60"
                        onClick={() => setConfirmRestart(false)}
                        disabled={busy}
                        data-testid={`recovery-restart-cancel-${setId}`}
                    >
                        {t("content.recovery.restart_cancel", "Cancel")}
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        className="rounded-md bg-accent px-3 py-1 font-medium text-accent-fg transition-colors hover:opacity-90 disabled:opacity-60"
                        onClick={runRestore}
                        disabled={busy}
                        data-testid={`recovery-restore-${setId}`}
                    >
                        {busy
                            ? t("content.recovery.working", "Working…")
                            : t("content.recovery.restore", "Relink review cards")}
                    </button>
                    <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-fg-primary transition-colors hover:bg-bg-elevated disabled:opacity-60"
                        onClick={() => setConfirmRestart(true)}
                        disabled={busy}
                        data-testid={`recovery-restart-${setId}`}
                    >
                        {t("content.recovery.restart", "Start set fresh")}
                    </button>
                </>
            )}
        </li>
    );
}
