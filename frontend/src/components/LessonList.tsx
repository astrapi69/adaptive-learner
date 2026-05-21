import {useState, type FormEvent} from "react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";

import {useI18n} from "../hooks/useI18n";
import RichTextEditor from "./editor/RichTextEditor";
import EditorToolbar from "./editor/EditorToolbar";
import {
    parseEditorContent,
    serializeEditorContent,
} from "./editor/content-utils";
import type {Lesson} from "../types";

interface LessonListProps {
    lessons: readonly Lesson[];
    onCreate: (title: string) => Promise<void>;
    onUpdate: (lessonId: string, title: string, content: string) => Promise<void>;
    onDelete: (lessonId: string) => Promise<void>;
    submitting?: boolean;
}

/**
 * Compact lesson manager. Flat list (lessons are not attached
 * to topics in v0.3.0 — see the Lesson model docstring). Each
 * row exposes inline-edit (title + content) and delete.
 *
 * v1.14.0 / Phase 27C: the content surface is now a
 * ``RichTextEditor`` (read-only in view mode, editable + toolbar
 * in edit mode). The persistence pipeline stores serialised
 * TipTap JSON in ``lessons.content`` (TEXT column); legacy
 * plain-text rows still render via ``content-utils``.
 */
export default function LessonList({
    lessons,
    onCreate,
    onUpdate,
    onDelete,
    submitting = false,
}: LessonListProps) {
    const {t} = useI18n();
    const [newTitle, setNewTitle] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editContentDoc, setEditContentDoc] = useState<JSONContent | null>(null);
    const [editEditor, setEditEditor] = useState<Editor | null>(null);

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = newTitle.trim();
        if (!trimmed || submitting) return;
        await onCreate(trimmed);
        setNewTitle("");
    };

    const startEdit = (lesson: Lesson) => {
        setEditingId(lesson.id);
        setEditTitle(lesson.title);
        setEditContentDoc(parseEditorContent(lesson.content));
        setEditEditor(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditEditor(null);
    };

    const submitEdit = async (lessonId: string) => {
        const trimmed = editTitle.trim();
        if (!trimmed || submitting) return;
        const serialised = serializeEditorContent(editContentDoc) ?? "";
        await onUpdate(lessonId, trimmed, serialised);
        setEditingId(null);
        setEditEditor(null);
    };

    return (
        <div className="lesson-list-wrap" data-testid="lesson-list">
            <form className="lesson-create-form" onSubmit={handleCreate}>
                <input
                    type="text"
                    data-testid="lesson-new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t(
                        "curriculum.new_lesson_placeholder",
                        "New lesson title…",
                    )}
                    disabled={submitting}
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    data-testid="lesson-create"
                    disabled={submitting || newTitle.trim().length === 0}
                >
                    {t("curriculum.add_lesson", "Add lesson")}
                </button>
            </form>

            {lessons.length === 0 ? (
                <p className="muted" data-testid="lesson-list-empty">
                    {t("curriculum.no_lessons", "No lessons yet.")}
                </p>
            ) : (
                <ul className="lesson-list">
                    {lessons.map((lesson) =>
                        editingId === lesson.id ? (
                            <li
                                key={lesson.id}
                                className="lesson-row is-editing"
                                data-testid={`lesson-row-${lesson.id}`}
                            >
                                <input
                                    type="text"
                                    data-testid={`lesson-edit-title-${lesson.id}`}
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    disabled={submitting}
                                />
                                <EditorToolbar
                                    editor={editEditor}
                                    testidNamespace={`lesson-edit-toolbar-${lesson.id}`}
                                />
                                <RichTextEditor
                                    content={editContentDoc}
                                    onChange={setEditContentDoc}
                                    onEditorReady={setEditEditor}
                                    editable={!submitting}
                                    placeholder={t(
                                        "curriculum.lesson_content_placeholder",
                                        "Lesson content — supports headings, lists, code blocks, links.",
                                    )}
                                    testidNamespace={`lesson-edit-content-${lesson.id}`}
                                    minHeight={140}
                                    ariaLabel={t(
                                        "curriculum.lesson_content_aria",
                                        "Lesson content",
                                    )}
                                />
                                <div className="lesson-row-actions">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        data-testid={`lesson-edit-cancel-${lesson.id}`}
                                        onClick={cancelEdit}
                                        disabled={submitting}
                                    >
                                        {t("common.cancel", "Cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        data-testid={`lesson-edit-save-${lesson.id}`}
                                        onClick={() => void submitEdit(lesson.id)}
                                        disabled={
                                            submitting || editTitle.trim().length === 0
                                        }
                                    >
                                        {t("common.save", "Save")}
                                    </button>
                                </div>
                            </li>
                        ) : (
                            <li
                                key={lesson.id}
                                className="lesson-row"
                                data-testid={`lesson-row-${lesson.id}`}
                            >
                                <div className="lesson-row-head">
                                    <strong className="lesson-title">{lesson.title}</strong>
                                    <div className="lesson-row-actions">
                                        <button
                                            type="button"
                                            className="topic-action-btn"
                                            data-testid={`lesson-edit-${lesson.id}`}
                                            onClick={() => startEdit(lesson)}
                                            title={t("common.edit", "Edit")}
                                        >
                                            ✎
                                        </button>
                                        <button
                                            type="button"
                                            className="topic-action-btn is-danger"
                                            data-testid={`lesson-delete-${lesson.id}`}
                                            onClick={() => void onDelete(lesson.id)}
                                            title={t("common.delete", "Delete")}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                {lesson.content && parseEditorContent(lesson.content) ? (
                                    <RichTextEditor
                                        content={parseEditorContent(lesson.content)}
                                        editable={false}
                                        testidNamespace={`lesson-content-${lesson.id}`}
                                        ariaLabel={t(
                                            "curriculum.lesson_content_aria",
                                            "Lesson content",
                                        )}
                                    />
                                ) : null}
                            </li>
                        ),
                    )}
                </ul>
            )}
        </div>
    );
}
