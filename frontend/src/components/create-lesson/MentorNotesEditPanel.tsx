/**
 * MentorNotesEditPanel (#2769, umbrella #2765) — the author's punch
 * list INSIDE the editor.
 *
 * When the wizard edits an own lesson that carries mentor notes
 * (#2768), this panel lists them where the author fixes them: category,
 * note text, per-note removal ("done"), and an optional per-note AI fix
 * proposal via the EXP-050 {@link AiSuggestButton} seam (BYOK
 * affordances included). Proposals are DISPLAYED, never auto-applied to
 * the draft (EXP-041 non-destructive discipline).
 *
 * Self-gating: renders nothing for non-own sets or when no notes exist.
 * Mount keyed by the lesson filename so a multi-lesson switch re-reads
 * the store.
 *
 * @example
 * <MentorNotesEditPanel key={filename} source={source} setId={setId}
 *   filename={filename} lessonTitle={meta.title} exercises={exercises} />
 */

import {useState} from "react";
import {StickyNote, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {AiSuggestButton} from "./fields";
import {isOwnEditableSet} from "../../lib/lesson/own-set";
import {suggestMentorFix} from "../../lib/ai/suggest/mentor-suggest";
import {
    listLessonMentorNotes,
    removeMentorNote,
    type MentorNoteCategory,
} from "../../lib/lesson/mentor-notes-store";
import type {ContentLessonExercise} from "../../storage/types";
import {useI18n} from "../../hooks/ui/useI18n";

/** Fallback labels for the category badges (i18n keys override them). */
const CATEGORY_FALLBACKS: Record<MentorNoteCategory, string> = {
    typo: "Typo",
    unclear: "Unclear wording",
    too_easy: "Too easy",
    too_hard: "Too hard",
    wrong_answer: "Answer graded wrong",
    other: "Other",
};

export interface MentorNotesEditPanelProps {
    /** Content source of the edited set. */
    source: string;
    /** Set id of the edited set. */
    setId: string;
    /** Lesson filename the notes are keyed by (e.g. ``01.json``). */
    filename: string;
    /** Title of the edited lesson (context for the AI proposal). */
    lessonTitle: string;
    /** The draft's exercises, to attach the annotated one to the prompt. */
    exercises: readonly ContentLessonExercise[];
}

/**
 * Render the mentor-note punch list for the edited lesson, or nothing
 * when the set is not the learner's own or carries no notes.
 *
 * @param props - See {@link MentorNotesEditPanelProps}.
 */
export default function MentorNotesEditPanel({
    source,
    setId,
    filename,
    lessonTitle,
    exercises,
}: MentorNotesEditPanelProps) {
    const {t, lang} = useI18n();
    const lessonRef = {source, setId, filename};
    const [notes, setNotes] = useState(() => listLessonMentorNotes(lessonRef));
    const [proposals, setProposals] = useState<Record<string, string>>({});

    if (!isOwnEditableSet(source, setId) || notes.length === 0) return null;

    const removeRow = (stepId: string) => {
        removeMentorNote({...lessonRef, stepId});
        setNotes(listLessonMentorNotes(lessonRef));
    };

    return (
        <section
            className="mb-4 rounded-md border border-border bg-bg-surface p-3"
            data-testid="mentor-edit-panel"
        >
            <h2 className="m-0 flex items-center gap-2 text-base">
                <StickyNote aria-hidden="true" className="size-4" />
                {t(
                    "lesson.mentor.edit_panel_title",
                    "Mentor notes for this lesson ({n})",
                ).replace("{n}", String(notes.length))}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
                {t(
                    "lesson.mentor.edit_panel_hint",
                    "Your annotations from playing this lesson. Remove a note once it is addressed.",
                )}
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {notes.map(({stepId, note}) => (
                    <li
                        key={stepId}
                        className="rounded-md border border-border p-2"
                        data-testid={`mentor-edit-note-${stepId}`}
                    >
                        <div className="flex items-start justify-between gap-2">
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
                                data-testid={`mentor-edit-remove-${stepId}`}
                            >
                                <Trash2 aria-hidden="true" />
                            </Button>
                        </div>
                        <div className="mt-2">
                            <AiSuggestButton
                                run={(provider) =>
                                    suggestMentorFix(provider, {
                                        category: note.category,
                                        noteText: note.text,
                                        lessonTitle,
                                        exercise:
                                            exercises.find(
                                                (exercise) =>
                                                    exercise.id === stepId,
                                            ) ?? null,
                                        language: lang || "en",
                                    })
                                }
                                isEmpty={(proposal) => proposal.trim() === ""}
                                onResult={(proposal) =>
                                    setProposals((prev) => ({
                                        ...prev,
                                        [stepId]: proposal,
                                    }))
                                }
                                label={t(
                                    "lesson.mentor.suggest_label",
                                    "AI suggestion",
                                )}
                                emptyLabel={t(
                                    "lesson.mentor.suggest_empty",
                                    "Nothing usable came back. Try again or adjust the step by hand.",
                                )}
                                testId={`mentor-edit-suggest-${stepId}`}
                            />
                            {proposals[stepId] && (
                                <p
                                    className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-bg-primary p-2 text-sm"
                                    data-testid={`mentor-edit-proposal-${stepId}`}
                                >
                                    {proposals[stepId]}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
