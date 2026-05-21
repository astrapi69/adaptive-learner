/**
 * CurriculumDescriptionEditor (Phase 27C / v1.14.0).
 *
 * Inline view-or-edit widget for ``Curriculum.description``:
 *
 *   - View mode (default): renders the stored description as a
 *     read-only ``RichTextEditor``. An "Edit description"
 *     button promotes the surface to edit mode.
 *   - Empty state: shows a placeholder + "Add description"
 *     button. Clicking it enters edit mode with an empty
 *     editor.
 *   - Edit mode: shows ``EditorToolbar`` + an editable
 *     ``RichTextEditor`` plus Save / Cancel buttons. Save
 *     fires ``onSave`` with the serialised content string
 *     (legacy plain text + serialised TipTap JSON both
 *     supported via ``content-utils``). Cancel restores the
 *     pre-edit content and exits edit mode.
 *
 * The component owns its draft + edit-mode state locally.
 * The parent owns persistence (``onSave`` is async and may
 * throw; the component re-throws so the parent can surface a
 * toast).
 */

import {useEffect, useState} from "react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";

import {useI18n} from "../hooks/useI18n";
import RichTextEditor from "./editor/RichTextEditor";
import EditorToolbar from "./editor/EditorToolbar";
import {
    parseEditorContent,
    serializeEditorContent,
} from "./editor/content-utils";

interface Props {
    /** Stored description string (legacy plain text or
     *  serialised TipTap JSON). ``null`` / empty -> shows the
     *  "Add description" affordance. */
    description: string | null | undefined;
    /** Called when the user clicks Save. Receives the
     *  serialised content (``null`` if the editor is empty).
     *  Must return a promise so the component can disable the
     *  Save button while persistence is in flight. */
    onSave: (next: string | null) => Promise<void>;
    /** Testid namespace. */
    testidNamespace?: string;
}

export default function CurriculumDescriptionEditor({
    description,
    onSave,
    testidNamespace = "curriculum-description",
}: Props) {
    const {t} = useI18n();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<JSONContent | null>(
        parseEditorContent(description),
    );
    const [submitting, setSubmitting] = useState(false);
    const [editor, setEditor] = useState<Editor | null>(null);

    // External prop change: sync the local draft + parsed view
    // doc. Without this, switching curricula in the parent
    // would leave stale content visible.
    useEffect(() => {
        if (!editing) {
            setDraft(parseEditorContent(description));
        }
    }, [description, editing]);

    const startEdit = () => {
        setDraft(parseEditorContent(description));
        setEditing(true);
    };

    const cancelEdit = () => {
        setDraft(parseEditorContent(description));
        setEditing(false);
    };

    const submitEdit = async () => {
        if (submitting) return;
        const serialised = serializeEditorContent(draft);
        setSubmitting(true);
        try {
            await onSave(serialised);
            setEditing(false);
        } finally {
            setSubmitting(false);
        }
    };

    const hasDescription = parseEditorContent(description) !== null;

    if (!editing) {
        return (
            <div
                className="curriculum-description"
                data-testid={`${testidNamespace}-root`}
            >
                {hasDescription ? (
                    <RichTextEditor
                        content={parseEditorContent(description)}
                        editable={false}
                        testidNamespace={`${testidNamespace}-view`}
                    />
                ) : (
                    <p
                        className="muted"
                        data-testid={`${testidNamespace}-empty`}
                    >
                        {t(
                            "curriculum.no_description",
                            "No description yet.",
                        )}
                    </p>
                )}
                <div className="curriculum-description-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid={`${testidNamespace}-edit`}
                        onClick={startEdit}
                    >
                        {hasDescription
                            ? t("curriculum.edit_description", "Edit description")
                            : t("curriculum.add_description", "Add description")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="curriculum-description is-editing"
            data-testid={`${testidNamespace}-root`}
        >
            <EditorToolbar
                editor={editor}
                testidNamespace={`${testidNamespace}-toolbar`}
            />
            <RichTextEditor
                content={draft}
                onChange={setDraft}
                onEditorReady={setEditor}
                editable={!submitting}
                placeholder={t(
                    "curriculum.description_placeholder",
                    "Why this curriculum? What does it cover?",
                )}
                testidNamespace={`${testidNamespace}-edit-editor`}
                minHeight={160}
                ariaLabel={t(
                    "curriculum.description_aria",
                    "Curriculum description",
                )}
            />
            <div className="curriculum-description-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid={`${testidNamespace}-cancel`}
                    onClick={cancelEdit}
                    disabled={submitting}
                >
                    {t("common.cancel", "Cancel")}
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    data-testid={`${testidNamespace}-save`}
                    onClick={() => void submitEdit()}
                    disabled={submitting}
                >
                    {t("common.save", "Save")}
                </button>
            </div>
        </div>
    );
}
