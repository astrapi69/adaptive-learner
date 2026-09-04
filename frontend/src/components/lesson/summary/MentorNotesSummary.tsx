/**
 * MentorNotesSummary (#2768, umbrella #2765) — the author's punch list.
 *
 * On the summary of an OWN lesson this block lists every mentor note
 * collected during the run (category + text, per-row removal) and offers
 * the Phase-1 editor deep link so the author lands in the editor with
 * exactly this lesson preloaded to work the list off.
 *
 * Self-gating: renders only when the played lesson is the learner's own
 * editable set AND at least one note exists — deliberately NOT part of
 * the configurable summary-section registry (#1426): it is an authoring
 * aid that appears rarely and only for authors, not a learner-facing
 * section anyone would reorder.
 *
 * @example
 * <MentorNotesSummary source={source} setId={setId} filename={filename} />
 */

import {useState} from "react";
import {StickyNote, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import LessonEditLink from "../chrome/LessonEditLink";
import {isOwnEditableSet} from "../../../lib/lesson/own-set";
import {
    listLessonMentorNotes,
    removeMentorNote,
    type MentorNoteCategory,
} from "../../../lib/lesson/mentor-notes-store";
import {useI18n} from "../../../hooks/ui/useI18n";

/** Fallback labels for the category badges (i18n keys override them). */
const CATEGORY_FALLBACKS: Record<MentorNoteCategory, string> = {
    typo: "Typo",
    unclear: "Unclear wording",
    too_easy: "Too easy",
    too_hard: "Too hard",
    wrong_answer: "Answer graded wrong",
    other: "Other",
};

export interface MentorNotesSummaryProps {
    /** Content source of the played lesson's set. */
    source: string;
    /** Set id of the played lesson. */
    setId: string;
    /** Lesson filename inside the set (e.g. ``01.json``). */
    filename: string;
}

/**
 * Render the punch list of mentor notes for the played lesson, or
 * nothing when the lesson is not an own set or has no notes.
 *
 * @param props - See {@link MentorNotesSummaryProps}.
 */
export default function MentorNotesSummary({
    source,
    setId,
    filename,
}: MentorNotesSummaryProps) {
    const {t} = useI18n();
    const lessonRef = {source, setId, filename};
    const [notes, setNotes] = useState(() =>
        listLessonMentorNotes(lessonRef),
    );

    if (!isOwnEditableSet(source, setId) || notes.length === 0) return null;

    const removeRow = (stepId: string) => {
        removeMentorNote({...lessonRef, stepId});
        setNotes(listLessonMentorNotes(lessonRef));
    };

    return (
        <section
            className="mt-4 rounded-md border border-border bg-bg-surface p-3"
            data-testid="lesson-mentor-summary"
        >
            <h3 className="m-0 flex items-center gap-2 text-base">
                <StickyNote aria-hidden="true" className="size-4" />
                {t("lesson.mentor.summary_title", "Mentor notes ({n})").replace(
                    "{n}",
                    String(notes.length),
                )}
            </h3>
            <p className="mt-1 text-sm text-fg-muted">
                {t(
                    "lesson.mentor.summary_hint",
                    "Your annotations from this run. Open the lesson in the editor to work them off.",
                )}
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {notes.map(({stepId, note}) => (
                    <li
                        key={stepId}
                        className="flex items-start justify-between gap-2 rounded-md border border-border p-2"
                        data-testid={`lesson-mentor-summary-row-${stepId}`}
                    >
                        <div className="min-w-0">
                            <span className="text-xs font-semibold uppercase text-fg-muted">
                                {t(
                                    `lesson.mentor.category.${note.category}`,
                                    CATEGORY_FALLBACKS[note.category],
                                )}
                            </span>
                            <p className="m-0 wrap-anywhere text-sm">
                                {note.text}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeRow(stepId)}
                            aria-label={t(
                                "lesson.mentor.remove",
                                "Remove note",
                            )}
                            title={t("lesson.mentor.remove", "Remove note")}
                            data-testid={`lesson-mentor-summary-remove-${stepId}`}
                        >
                            <Trash2 aria-hidden="true" />
                        </Button>
                    </li>
                ))}
            </ul>
            <div className="mt-3">
                <LessonEditLink
                    source={source}
                    setId={setId}
                    filename={filename}
                />
            </div>
        </section>
    );
}
