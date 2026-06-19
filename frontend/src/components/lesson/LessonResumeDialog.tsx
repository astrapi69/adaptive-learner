/**
 * Lesson resume prompt (Phase 63C / EXP-020).
 *
 * Shown when the user opens a lesson whose progress row is in the
 * ``paused`` state. Offers two paths:
 *
 * - **Resume** → markResumed() then continue from the last saved
 *   step (fetchInitial already computed the right index).
 * - **Start Over** → markRestarted() then goToStep(0) so the
 *   learner begins fresh with an empty progress row.
 *
 * The dialog is NOT closable without making a choice — the back
 * button should not silently keep the lesson in "paused" and
 * advance to the step view.
 */

import {useRef} from "react";

import {PlayCircle, RotateCcw} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useDialogFocus} from "../../hooks/ui/useDialogFocus";
import {useI18n} from "../../hooks/ui/useI18n";

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

    // WCAG 2.4.3: this forced-choice dialog (no Escape by design) must
    // still move focus onto its primary action on open and trap Tab.
    useDialogFocus(dialogRef, {open});

    if (!open) return null;

    return (
        <div
            ref={dialogRef}
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-resume-title"
            data-testid="lesson-resume-dialog"
        >
            <div className="modal-card lesson-resume-panel">
                <h2 id="lesson-resume-title" className="modal-title">
                    {t("lesson.resume.heading", "Resume lesson?")}
                </h2>
                <p className="lesson-resume-desc">
                    {t(
                        "lesson.resume.body",
                        'You paused "{title}". Would you like to continue where you left off or start over?',
                    ).replace("{title}", lessonTitle)}
                </p>
                <div className="lesson-resume-actions">
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
                        onClick={onStartOver}
                        data-testid="lesson-resume-restart"
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("lesson.resume.action_restart", "Start over")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
