/**
 * Phase 63B — back-button exit dialog for the lesson viewer.
 *
 * The lesson "Back to content browser" button used to navigate
 * straight to ``/content``, losing any in-flight answers the
 * user hadn't yet confirmed on a step. The dialog offers three
 * actions:
 *
 *   - Pausieren  → ``markPaused`` then navigate; toast confirms.
 *   - Abbrechen  → sub-confirm; ``markAbandoned`` then navigate.
 *   - Weiter lernen → close dialog, stay on lesson.
 *
 * Tailwind Phase C — built on the shadcn Dialog primitive (Radix:
 * focus trap, escape-to-close, scroll lock). The close affordance
 * is suppressed (``showCloseButton={false}``) so the user must pick
 * an explicit option; Escape / overlay click map to "Keep learning"
 * on the options view and "back to options" on the sub-confirm.
 *
 * The component is presentational + i18n-aware; the lifecycle
 * mutations live on the parent (``Lesson.tsx``) so this dialog
 * can be rendered in tests without a Dexie/api round-trip.
 */

import {useEffect, useState} from "react";

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

    // Re-arm at the options view whenever the dialog fully closes,
    // so a later reopen never lands straight on the sub-confirm.
    useEffect(() => {
        if (!open) setConfirmingAbandon(false);
    }, [open]);

    return (
        <>
            <Dialog
                open={open && !confirmingAbandon}
                onOpenChange={(next) => {
                    // Escape / overlay click on the options view ==
                    // "Keep learning" (stay on the lesson).
                    if (!next) onContinue();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    data-testid="lesson-exit-dialog"
                    aria-labelledby="lesson-exit-title"
                >
                    <DialogHeader>
                        <DialogTitle id="lesson-exit-title">
                            {t("lesson.exit.title", "Leave the lesson?")}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                "lesson.exit.body",
                                "Choose how to leave: pause to come back later, " +
                                    "abandon to discard the attempt, or stay.",
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onContinue}
                            data-testid="lesson-exit-continue"
                        >
                            {t("lesson.exit.continue", "Keep learning")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmingAbandon(true)}
                            data-testid="lesson-exit-abandon"
                        >
                            {t("lesson.exit.abandon", "Abandon")}
                        </Button>
                        <Button
                            type="button"
                            onClick={onPause}
                            data-testid="lesson-exit-pause"
                        >
                            {t("lesson.exit.pause", "Pause")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={open && confirmingAbandon}
                onOpenChange={(next) => {
                    // Escape / overlay click on the sub-confirm returns
                    // to the options view rather than leaving outright.
                    if (!next) setConfirmingAbandon(false);
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    role="alertdialog"
                    data-testid="lesson-exit-confirm-abandon"
                    aria-labelledby="lesson-exit-confirm-title"
                >
                    <DialogHeader>
                        <DialogTitle id="lesson-exit-confirm-title">
                            {t(
                                "lesson.exit.abandon_confirm_title",
                                "Discard previous answers?",
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                "lesson.exit.abandon_confirm_body",
                                "Previous answers will be discarded. What you " +
                                    "already learned (mastery progress) stays.",
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmingAbandon(false)}
                            data-testid="lesson-exit-confirm-cancel"
                        >
                            {t("lesson.exit.confirm_cancel", "Back to options")}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                setConfirmingAbandon(false);
                                onAbandon();
                            }}
                            data-testid="lesson-exit-confirm-ok"
                        >
                            {t("lesson.exit.abandon_confirm_ok", "Yes, discard")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
