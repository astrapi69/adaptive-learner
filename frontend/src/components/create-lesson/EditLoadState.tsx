/**
 * Edit-mode chrome for the Lesson Creator: the load state (#1740) and, for a
 * set that holds more than one lesson, the lesson picker (#1971). A loading
 * line while the existing lesson is fetched, or an error panel with a way back
 * when it can't be loaded. Rendered unconditionally (returns null in the normal
 * new-lesson flow) so the page component keeps its guard branches out of its
 * own cyclomatic complexity.
 */

import {Button} from "@/components/ui/button";
import {lessonPickerLabel} from "../../lib/content/lesson/edit-session";
import type {ContentLesson} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface EditLoadStateProps {
    loading: boolean;
    error: boolean;
    onBack: () => void;
    t: Translate;
}

export default function EditLoadState({
    loading,
    error,
    onBack,
    t,
}: EditLoadStateProps) {
    if (loading) {
        return (
            <p
                className="text-sm text-fg-muted"
                role="status"
                data-testid="create-lesson-edit-loading"
            >
                {t("common.loading", "Loading…")}
            </p>
        );
    }
    if (error) {
        return (
            <section
                className="create-lesson-step flex flex-col gap-4"
                data-testid="create-lesson-edit-error"
            >
                <p className="form-hint form-hint-warning" role="alert">
                    {t(
                        "create_lesson.edit_load_error",
                        "Could not load this lesson for editing.",
                    )}
                </p>
                <div className="form-actions">
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="create-lesson-edit-error-back"
                        onClick={onBack}
                    >
                        {t("create_lesson.back", "Back")}
                    </Button>
                </div>
            </section>
        );
    }
    return null;
}

interface LessonPickerProps {
    /** The edit session, or ``null`` in the normal new-lesson flow. */
    editContext: {lessons: ContentLesson[]; editIndex: number} | null;
    loading: boolean;
    error: boolean;
    saved: boolean;
    /** Request a switch to lesson ``index`` (the page guards unsaved edits). */
    onSelect: (index: number) => void;
    t: Translate;
}

/** #1971 — for a multi-lesson set, choose which lesson to edit. Rendered
 *  unconditionally (returns null unless the set holds more than one lesson and
 *  the wizard is on an active, unsaved edit) so the page keeps the visibility
 *  branches out of its own cyclomatic complexity. */
export function LessonPicker({
    editContext,
    loading,
    error,
    saved,
    onSelect,
    t,
}: LessonPickerProps) {
    if (loading || error || saved || !editContext) return null;
    const {lessons, editIndex: activeIndex} = editContext;
    if (lessons.length <= 1) return null;
    return (
        <div
            className="create-lesson-lesson-picker mb-4 flex flex-col gap-1.5"
            data-testid="create-lesson-lesson-picker"
        >
            <label
                htmlFor="create-lesson-lesson-select"
                className="form-label text-sm font-medium text-fg-primary"
            >
                {t(
                    "create_lesson.edit.lesson_picker_label",
                    "Lesson in this set ({n})",
                ).replace("{n}", String(lessons.length))}
            </label>
            <select
                id="create-lesson-lesson-select"
                data-testid="create-lesson-lesson-select"
                className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={activeIndex}
                onChange={(e) => onSelect(Number(e.target.value))}
            >
                {lessons.map((lesson, i) => (
                    <option key={`${lesson.id}-${i}`} value={i}>
                        {i + 1}. {lessonPickerLabel(lesson, i)}
                    </option>
                ))}
            </select>
        </div>
    );
}
