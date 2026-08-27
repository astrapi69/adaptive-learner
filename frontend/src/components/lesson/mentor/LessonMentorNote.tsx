/**
 * LessonMentorNote (#2768, umbrella #2765) — per-step authoring note.
 *
 * While playing an OWN lesson the author can flag the current step
 * ("typo", "unclear", …) with a short note and keep playing; the summary
 * shows the collected punch list with the editor deep link. The runner
 * never mutates the lesson (the #2765 note-first decision) — notes live
 * in the mode-agnostic {@link module:lib/lesson/mentor-notes-store}.
 *
 * Self-gating: renders only for the learner's own editable sets
 * ({@link isOwnEditableSet}). Mount keyed by the step id so a step
 * change resets the disclosure + draft state naturally.
 *
 * @example
 * <LessonMentorNote key={step.id} source={source} setId={setId}
 *   filename={filename} stepId={step.id} />
 */

import {useState} from "react";
import {StickyNote, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {isOwnEditableSet} from "../../../lib/lesson/own-set";
import {
    MENTOR_NOTE_CATEGORIES,
    getMentorNote,
    removeMentorNote,
    storeMentorNote,
    type MentorNoteCategory,
} from "../../../lib/lesson/mentor-notes-store";
import {useI18n} from "../../../hooks/ui/useI18n";

/** Fallback labels for the category select (i18n keys override them). */
const CATEGORY_FALLBACKS: Record<MentorNoteCategory, string> = {
    typo: "Typo",
    unclear: "Unclear wording",
    too_easy: "Too easy",
    too_hard: "Too hard",
    wrong_answer: "Answer graded wrong",
    other: "Other",
};

export interface LessonMentorNoteProps {
    /** Content source of the running lesson's set. */
    source: string;
    /** Set id of the running lesson. */
    setId: string;
    /** Lesson filename inside the set (e.g. ``01.json``). */
    filename: string;
    /** Id of the step this note annotates. */
    stepId: string;
}

/**
 * Render the mentor-note control for the current step, or nothing when
 * the running lesson is not the learner's own editable content.
 *
 * @param props - See {@link LessonMentorNoteProps}.
 */
export default function LessonMentorNote({
    source,
    setId,
    filename,
    stepId,
}: LessonMentorNoteProps) {
    const {t} = useI18n();
    const noteRef = {source, setId, filename, stepId};
    const [existing, setExisting] = useState(() => getMentorNote(noteRef));
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<MentorNoteCategory>(
        existing?.category ?? "typo",
    );
    const [text, setText] = useState(existing?.text ?? "");

    if (!isOwnEditableSet(source, setId)) return null;

    const save = () => {
        storeMentorNote(noteRef, {category, text: text.trim()});
        setExisting(getMentorNote(noteRef));
        setOpen(false);
    };
    const remove = () => {
        removeMentorNote(noteRef);
        setExisting(null);
        setCategory("typo");
        setText("");
        setOpen(false);
    };

    return (
        <section className="mt-2 px-2" data-testid="lesson-mentor-note">
            <Button
                type="button"
                variant={existing ? "secondary" : "ghost"}
                size="sm"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                data-testid="lesson-mentor-note-toggle"
            >
                <StickyNote aria-hidden="true" />
                {existing
                    ? t("lesson.mentor.note_edit", "Edit mentor note")
                    : t("lesson.mentor.note_button", "Mentor note")}
            </Button>
            {open && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-bg-surface p-3">
                    <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                        {t("lesson.mentor.category_label", "Category")}
                        <select
                            className="min-h-11 rounded-md border border-border bg-bg-primary px-2 text-fg-primary"
                            value={category}
                            onChange={(event) =>
                                setCategory(
                                    event.target.value as MentorNoteCategory,
                                )
                            }
                            data-testid="lesson-mentor-note-category"
                        >
                            {MENTOR_NOTE_CATEGORIES.map((key) => (
                                <option key={key} value={key}>
                                    {t(
                                        `lesson.mentor.category.${key}`,
                                        CATEGORY_FALLBACKS[key],
                                    )}
                                </option>
                            ))}
                        </select>
                    </label>
                    <textarea
                        className="min-h-20 rounded-md border border-border bg-bg-primary p-2 text-fg-primary"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder={t(
                            "lesson.mentor.placeholder",
                            "What should be improved on this step?",
                        )}
                        data-testid="lesson-mentor-note-text"
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            disabled={text.trim().length === 0}
                            onClick={save}
                            data-testid="lesson-mentor-note-save"
                        >
                            {t("lesson.mentor.save", "Save note")}
                        </Button>
                        {existing && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={remove}
                                data-testid="lesson-mentor-note-remove"
                            >
                                <Trash2 aria-hidden="true" />
                                {t("lesson.mentor.remove", "Remove note")}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
