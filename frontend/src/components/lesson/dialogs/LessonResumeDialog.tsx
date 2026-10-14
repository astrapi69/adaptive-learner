/**
 * Lesson resume prompt (Phase 63C / EXP-020).
 *
 * Shown when the user opens a lesson whose progress row is in the
 * ``paused`` state. Offers two paths:
 *
 * - **Resume** → markResumed() then continue from the last saved
 *   step (fetchInitial already computed the right index).
 * - **Start Over** → a confirmation step first (#3361: one tap used to
 *   wipe position and answers), then markRestarted() and goToStep(0) so
 *   the learner begins fresh with an empty progress row.
 *
 * #3742 / #3750 - when the stored run must start over (``blockReason``:
 * started in another mode with ``exam`` on either side, or a started exam
 * reopened as an exam), the dialog offers no "continue": a line explains
 * why, and "start over" is the only path, so practice answers never count
 * as exam answers and an exam is always one sitting.
 *
 * The dialog is NOT closable without making a choice — the back
 * button should not silently keep the lesson in "paused" and
 * advance to the step view.
 */

import {useEffect, useRef, useState} from "react";

import {PlayCircle, RotateCcw} from "lucide-react";

import {Button} from "@/components/ui/button";
import {ModalCard, ModalOverlay, ModalTitle} from "@/shared/modal";
import {useDialogFocus} from "../../../hooks/ui/useDialogFocus";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {ResumeBlock} from "../../../lib/lesson/progress/resume-mode";

/** The explanation per block reason (key, English fallback). */
const BLOCK_TEXT: Record<ResumeBlock, [string, string]> = {
    mode_conflict: [
        "lesson.resume.mode_conflict",
        "This run was started in another mode. Exam and practice answers cannot be mixed, so the lesson starts over.",
    ],
    exam_single_sitting: [
        "lesson.resume.exam_single_sitting",
        "A started exam cannot be continued: it only counts when taken in one sitting, so the lesson starts over.",
    ],
};

export interface LessonResumeDialogProps {
    open: boolean;
    lessonTitle: string;
    /** #3742 / #3750 - why the stored run must start over; ``null`` lets
     *  it continue. */
    blockReason?: ResumeBlock | null;
    onResume: () => void;
    onStartOver: () => void;
}

export default function LessonResumeDialog({
    open,
    lessonTitle,
    blockReason = null,
    onResume,
    onStartOver,
}: LessonResumeDialogProps) {
    const {t} = useI18n();
    const dialogRef = useRef<HTMLDivElement>(null);
    const confirmRef = useRef<HTMLDivElement>(null);
    const [confirmingRestart, setConfirmingRestart] = useState(false);

    // A reopened dialog starts on the choice, never on the confirmation.
    useEffect(() => {
        if (!open) setConfirmingRestart(false);
    }, [open]);

    // WCAG 2.4.3: this forced-choice dialog (no Escape by design) must
    // still move focus onto its primary action on open and trap Tab. Each
    // view gets its own focus cycle, so switching views moves focus too.
    useDialogFocus(dialogRef, {open: open && !confirmingRestart});
    useDialogFocus(confirmRef, {open: open && confirmingRestart});

    if (!open) return null;

    if (confirmingRestart) {
        return (
            <ModalOverlay
                ref={confirmRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="lesson-resume-confirm-title"
                data-testid="lesson-resume-confirm-restart"
            >
                <ModalCard>
                    <ModalTitle id="lesson-resume-confirm-title">
                        {t(
                            "lesson.resume.restart_confirm_title",
                            "Start over from the beginning?",
                        )}
                    </ModalTitle>
                    <p>
                        {t(
                            "lesson.resume.restart_confirm_body",
                            "Your position and your answers in this lesson will be reset. What you already learned (mastery progress) stays.",
                        )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmingRestart(false)}
                            data-testid="lesson-resume-confirm-back"
                            data-autofocus
                        >
                            {t("lesson.exit.confirm_cancel", "Back to options")}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onStartOver}
                            data-testid="lesson-resume-confirm-restart-action"
                        >
                            <RotateCcw size={16} aria-hidden="true" />
                            {t("lesson.resume.action_restart", "Start over")}
                        </Button>
                    </div>
                </ModalCard>
            </ModalOverlay>
        );
    }

    return (
        <ModalOverlay
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-resume-title"
            data-testid="lesson-resume-dialog"
        >
            <ModalCard>
                <ModalTitle id="lesson-resume-title">
                    {t("lesson.resume.heading", "Resume lesson?")}
                </ModalTitle>
                {blockReason ? (
                    <p data-testid="lesson-resume-blocked" data-reason={blockReason}>
                        {t(...BLOCK_TEXT[blockReason])}
                    </p>
                ) : (
                    <p>
                        {t(
                            "lesson.resume.body",
                            'You paused "{title}". Would you like to continue where you left off or start over?',
                        ).replace("{title}", lessonTitle)}
                    </p>
                )}
                <div className="flex flex-wrap gap-3">
                    {!blockReason && (
                        <Button
                            type="button"
                            onClick={onResume}
                            data-testid="lesson-resume-continue"
                            data-autofocus
                        >
                            <PlayCircle size={16} aria-hidden="true" />
                            {t("lesson.resume.action_resume", "Continue")}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant={blockReason ? "default" : "outline"}
                        onClick={() => setConfirmingRestart(true)}
                        data-testid="lesson-resume-restart"
                        data-autofocus={blockReason ? true : undefined}
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("lesson.resume.action_restart", "Start over")}
                    </Button>
                </div>
            </ModalCard>
        </ModalOverlay>
    );
}
