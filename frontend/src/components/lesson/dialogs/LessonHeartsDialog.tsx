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
 * Built on the shadcn Dialog primitive like {@link LessonExitDialog}
 * (focus trap, scroll lock). The close affordance is suppressed so
 * the choice is explicit; Escape / overlay click map to the friendly
 * default, "try again".
 */

import {HeartCrack, LogOut, RotateCcw} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                // Escape / overlay click == the friendly default: retry.
                if (!next) onRetry();
            }}
        >
            <DialogContent
                showCloseButton={false}
                data-testid="lesson-hearts-dialog"
                aria-labelledby="lesson-hearts-title"
            >
                <DialogHeader>
                    <DialogTitle id="lesson-hearts-title">
                        <HeartCrack
                            size={18}
                            aria-hidden="true"
                            className="mr-1 inline-block align-text-bottom text-[var(--danger)]"
                        />
                        {t("lesson.hearts.empty_heading", "Out of hearts!")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "lesson.hearts.empty_body",
                            "No worries - nothing is lost, everything you solved stays saved. Take a breath and try the lesson again.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        onClick={onRetry}
                        data-testid="lesson-hearts-retry"
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
