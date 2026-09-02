/**
 * Out-of-hearts dialog (#2878).
 *
 * Shown when the game-mode hearts run out. Friendly, no data loss -
 * every recorded step result stays recorded. Two paths:
 *
 * - **Try again** → the caller restarts the run (markRestarted +
 *   goToStep(0)) and refills the hearts.
 * - **Leave lesson** → back to the lesson overview.
 *
 * Forced choice like {@link ../LessonResumeDialog}: not closable
 * without picking a path, focus is trapped and lands on the primary
 * action.
 */

import {useRef} from "react";

import {HeartCrack, LogOut, RotateCcw} from "lucide-react";

import {Button} from "@/components/ui/button";
import {ModalCard, ModalOverlay, ModalTitle} from "@/shared/modal";
import {useDialogFocus} from "../../../hooks/ui/useDialogFocus";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface LessonHeartsDialogProps {
    open: boolean;
    onRetry: () => void;
    onExit: () => void;
}

export default function LessonHeartsDialog({
    open,
    onRetry,
    onExit,
}: LessonHeartsDialogProps) {
    const {t} = useI18n();
    const dialogRef = useRef<HTMLDivElement>(null);

    useDialogFocus(dialogRef, {open});

    if (!open) return null;

    return (
        <ModalOverlay
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-hearts-title"
            data-testid="lesson-hearts-dialog"
        >
            <ModalCard>
                <ModalTitle id="lesson-hearts-title">
                    <HeartCrack
                        size={18}
                        aria-hidden="true"
                        className="mr-1 inline-block align-text-bottom text-[var(--danger)]"
                    />
                    {t("lesson.hearts.empty_heading", "Out of hearts!")}
                </ModalTitle>
                <p>
                    {t(
                        "lesson.hearts.empty_body",
                        "No worries - nothing is lost, everything you solved stays saved. Take a breath and try the lesson again.",
                    )}
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        onClick={onRetry}
                        data-testid="lesson-hearts-retry"
                        data-autofocus
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("lesson.hearts.action_retry", "Try again")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onExit}
                        data-testid="lesson-hearts-exit"
                    >
                        <LogOut size={16} aria-hidden="true" />
                        {t("lesson.hearts.action_exit", "Leave lesson")}
                    </Button>
                </div>
            </ModalCard>
        </ModalOverlay>
    );
}
