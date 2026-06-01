/**
 * Phase 63B — back-button exit dialog for the lesson viewer.
 *
 * The lesson "Back to content browser" button used to navigate
 * straight to ``/content``, losing any in-flight answers the
 * user hadn't yet confirmed on a step. The new behaviour opens
 * this dialog with three actions:
 *
 *   - Pausieren  → ``markPaused`` then navigate; toast confirms.
 *   - Abbrechen  → sub-confirm; ``markAbandoned`` then navigate.
 *   - Weiter lernen → close dialog, stay on lesson.
 *
 * The component is presentational + i18n-aware; the lifecycle
 * mutations live on the parent (``Lesson.tsx``) so this dialog
 * can be rendered in tests without a Dexie/api round-trip.
 */

import {useState} from "react";

import {useI18n} from "../../hooks/useI18n";

export interface LessonExitDialogProps {
    open: boolean;
    onPause: () => void;
    onAbandon: () => void;
    onContinue: () => void;
}

export default function LessonExitDialog({
    open,
    onPause,
    onAbandon,
    onContinue,
}: LessonExitDialogProps) {
    const {t} = useI18n();
    const [confirmingAbandon, setConfirmingAbandon] = useState(false);

    if (!open) return null;

    if (confirmingAbandon) {
        return (
            <div
                className="modal-overlay"
                data-testid="lesson-exit-confirm-abandon"
            >
                <div
                    className="modal-card"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="lesson-exit-confirm-title"
                >
                    <h2
                        id="lesson-exit-confirm-title"
                        className="modal-title"
                    >
                        {t(
                            "lesson.exit.abandon_confirm_title",
                            "Discard previous answers?",
                        )}
                    </h2>
                    <p>
                        {t(
                            "lesson.exit.abandon_confirm_body",
                            "Previous answers will be discarded. What you " +
                                "already learned (mastery progress) stays.",
                        )}
                    </p>
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setConfirmingAbandon(false)}
                            data-testid="lesson-exit-confirm-cancel"
                        >
                            {t(
                                "lesson.exit.confirm_cancel",
                                "Back to options",
                            )}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                setConfirmingAbandon(false);
                                onAbandon();
                            }}
                            data-testid="lesson-exit-confirm-ok"
                        >
                            {t(
                                "lesson.exit.abandon_confirm_ok",
                                "Yes, discard",
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" data-testid="lesson-exit-dialog">
            <div
                className="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lesson-exit-title"
            >
                <h2 id="lesson-exit-title" className="modal-title">
                    {t("lesson.exit.title", "Leave the lesson?")}
                </h2>
                <p>
                    {t(
                        "lesson.exit.body",
                        "Choose how to leave: pause to come back later, " +
                            "abandon to discard the attempt, or stay.",
                    )}
                </p>
                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onContinue}
                        data-testid="lesson-exit-continue"
                    >
                        {t("lesson.exit.continue", "Keep learning")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setConfirmingAbandon(true)}
                        data-testid="lesson-exit-abandon"
                    >
                        {t("lesson.exit.abandon", "Abandon")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onPause}
                        data-testid="lesson-exit-pause"
                    >
                        {t("lesson.exit.pause", "Pause")}
                    </button>
                </div>
            </div>
        </div>
    );
}
