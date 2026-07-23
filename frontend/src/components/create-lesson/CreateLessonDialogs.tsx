/**
 * The two modal dialogs of the Lesson Creator, split out of
 * ``CreateLesson`` to keep the page component within the cohesion +
 * complexity ratchets: the cancel-confirm dialog (discard an in-progress
 * lesson) and the draft-prompt dialog (continue an unfinished draft or
 * start fresh). Pure presentation — the page owns all state + callbacks.
 */

import {Button} from "@/components/ui/button";
import type {LessonDraft} from "../../lib/content/lesson/lesson-draft";

type Translate = (key: string, fallback?: string) => string;

interface CreateLessonDialogsProps {
    confirmCancel: boolean;
    pendingDraft: LessonDraft | null;
    /** #1971 — a requested lesson switch with unsaved edits (target index),
     *  awaiting confirmation; ``null`` when no switch is pending. */
    pendingLessonSwitch: number | null;
    onKeepEditing: () => void;
    onDiscard: () => void;
    onStartFresh: () => void;
    onContinueDraft: (draft: LessonDraft) => void;
    /** #1971 — confirm / cancel discarding unsaved edits to switch lessons. */
    onConfirmLessonSwitch: () => void;
    onCancelLessonSwitch: () => void;
    t: Translate;
}

export default function CreateLessonDialogs({
    confirmCancel,
    pendingDraft,
    pendingLessonSwitch,
    onKeepEditing,
    onDiscard,
    onStartFresh,
    onContinueDraft,
    onConfirmLessonSwitch,
    onCancelLessonSwitch,
    t,
}: CreateLessonDialogsProps) {
    return (
        <>
            {pendingLessonSwitch !== null && (
                <div
                    className="modal-overlay"
                    data-testid="create-lesson-switch-confirm"
                >
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-lesson-switch-title"
                    >
                        <h2
                            id="create-lesson-switch-title"
                            className="modal-title"
                        >
                            {t(
                                "create_lesson.edit.switch_confirm_title",
                                "Switch lesson?",
                            )}
                        </h2>
                        <p>
                            {t(
                                "create_lesson.edit.switch_confirm_body",
                                "Your unsaved changes to the current lesson will be lost.",
                            )}
                        </p>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="outline"
                                data-testid="create-lesson-switch-keep"
                                onClick={onCancelLessonSwitch}
                            >
                                {t("create_lesson.cancel_keep", "Keep editing")}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                data-testid="create-lesson-switch-discard"
                                onClick={onConfirmLessonSwitch}
                            >
                                {t(
                                    "create_lesson.edit.switch_discard",
                                    "Discard and switch",
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {confirmCancel && (
                <div
                    className="modal-overlay"
                    data-testid="create-lesson-cancel-confirm"
                >
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-lesson-cancel-title"
                    >
                        <h2
                            id="create-lesson-cancel-title"
                            className="modal-title"
                        >
                            {t(
                                "create_lesson.cancel_confirm_title",
                                "Discard this lesson?",
                            )}
                        </h2>
                        <p>
                            {t(
                                "create_lesson.cancel_confirm_body",
                                "Your unsaved lesson will be lost.",
                            )}
                        </p>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="outline"
                                data-testid="create-lesson-cancel-keep"
                                onClick={onKeepEditing}
                            >
                                {t(
                                    "create_lesson.cancel_keep",
                                    "Keep editing",
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                data-testid="create-lesson-cancel-discard"
                                onClick={onDiscard}
                            >
                                {t("create_lesson.cancel_discard", "Discard")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDraft && (
                <div
                    className="modal-overlay"
                    data-testid="create-lesson-draft-prompt"
                >
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-lesson-draft-title"
                    >
                        <h2
                            id="create-lesson-draft-title"
                            className="modal-title"
                        >
                            {t("create_lesson.draft.title", "Draft found")}
                        </h2>
                        <p>
                            {t(
                                "create_lesson.draft.body",
                                "You have an unfinished lesson. Continue where you left off or start fresh?",
                            )}
                        </p>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="secondary"
                                data-testid="create-lesson-draft-fresh"
                                onClick={onStartFresh}
                            >
                                {t(
                                    "create_lesson.draft.start_fresh",
                                    "Start fresh",
                                )}
                            </Button>
                            <Button
                                type="button"
                                data-testid="create-lesson-draft-continue"
                                onClick={() => onContinueDraft(pendingDraft)}
                            >
                                {t("create_lesson.draft.continue", "Continue")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
