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

export interface LessonResumeDialogProps {
    open: boolean;
    lessonTitle: string;
    onResume: () => void;
    onStartOver: () => void;
}

export default function LessonResumeDialog({
    open,
    lessonTitle,
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
                <p>
                    {t(
                        "lesson.resume.body",
                        'You paused "{title}". Would you like to continue where you left off or start over?',
                    ).replace("{title}", lessonTitle)}
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        onClick={onResume}
                        data-testid="lesson-resume-continue"
                        data-autofocus
                    >
                        <PlayCircle size={16} aria-hidden="true" />
                        {t("lesson.resume.action_resume", "Continue")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmingRestart(true)}
                        data-testid="lesson-resume-restart"
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("lesson.resume.action_restart", "Start over")}
                    </Button>
                </div>
            </ModalCard>
        </ModalOverlay>
    );
}
