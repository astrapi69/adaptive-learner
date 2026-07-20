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
    onKeepEditing: () => void;
    onDiscard: () => void;
    onStartFresh: () => void;
    onContinueDraft: (draft: LessonDraft) => void;
    t: Translate;
}

export default function CreateLessonDialogs({
    confirmCancel,
    pendingDraft,
    onKeepEditing,
    onDiscard,
    onStartFresh,
    onContinueDraft,
    t,
}: CreateLessonDialogsProps) {
    return (
        <>
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
