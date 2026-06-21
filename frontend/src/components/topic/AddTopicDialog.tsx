import {useEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {useDialogFocus} from "../../hooks/ui/useDialogFocus";
import {useI18n} from "../../hooks/ui/useI18n";

interface AddTopicDialogProps {
    open: boolean;
    /** Optional pre-filled title for rename mode; empty for add. */
    initialTitle?: string;
    /** Optional title-bar caption override. */
    titleKey?: string;
    onCancel: () => void;
    onSubmit: (title: string) => void;
    submitting?: boolean;
}

/**
 * Compact modal for adding or renaming a topic. Single text
 * input + Cancel / Save buttons. Re-used by Curriculum.tsx for
 * three flows (add root topic, add subtopic, rename existing)
 * — each surfaces its own initialTitle / titleKey.
 */
export default function AddTopicDialog({
    open,
    initialTitle = "",
    titleKey = "curriculum.add_topic",
    onCancel,
    onSubmit,
    submitting = false,
}: AddTopicDialogProps) {
    const {t} = useI18n();
    const [title, setTitle] = useState(initialTitle);
    const dialogRef = useRef<HTMLDivElement>(null);

    // WCAG 2.1.2 / 2.4.3: initial focus (the input, via
    // data-autofocus), focus trap, and focus return to the trigger.
    useDialogFocus(dialogRef, {open});

    // Reset the local input whenever the dialog (re-)opens; a
    // single component instance is reused for both "add" and
    // "rename" by the page, so without this reset the rename
    // input would carry the prior "add" draft.
    useEffect(() => {
        if (open) {
            setTitle(initialTitle);
        }
    }, [open, initialTitle]);

    // WCAG SC 2.1.2 (No Keyboard Trap): close on Escape so
    // keyboard users can dismiss the modal without finding the
    // Cancel button by Tab.
    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !submitting) onCancel();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, submitting, onCancel]);

    if (!open) return null;

    return (
        <div className="modal-overlay" data-testid="add-topic-dialog">
            <div
                ref={dialogRef}
                className="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-topic-title"
            >
                <h2 id="add-topic-title" className="modal-title">
                    {t(titleKey, "Topic")}
                </h2>
                <form
                    className="add-topic-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const trimmed = title.trim();
                        if (trimmed.length === 0) return;
                        onSubmit(trimmed);
                    }}
                >
                    <label className="form-row">
                        <span className="form-label">
                            {t("curriculum.topic_title", "Title")}
                        </span>
                        <input
                            type="text"
                            data-testid="add-topic-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={submitting}
                            data-autofocus
                            required
                        />
                    </label>
                    <div className="form-actions">
                        <Button
                            type="button"
                            variant="secondary"
                            data-testid="add-topic-cancel"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            type="submit"
                            data-testid="add-topic-submit"
                            disabled={submitting || title.trim().length === 0}
                        >
                            {t("common.save", "Save")}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
