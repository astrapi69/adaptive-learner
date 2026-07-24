/**
 * LessonReverseNote (#1013).
 *
 * The "(not reversible)" note shown in reverse mode above a non-matching
 * exercise (those types have no gradeable structural reversal, so they play
 * in their original format — the issue's documented fallback). Extracted
 * from the lesson player so the player keeps its cohesion: the visibility
 * decision lives here, not in the page's render branch.
 *
 * Renders nothing unless the lesson is in reverse mode AND the current step
 * is a non-reversible exercise step.
 */

import {useI18n} from "../../../hooks/ui/useI18n";
import {stepIsReversible} from "../../../lib/reverse/reverse-lesson";
import type {ContentLessonStep} from "../../../storage/types";

export interface LessonReverseNoteProps {
    /** Whether the lesson is running in reverse mode. */
    reverseMode: boolean;
    /** Whether the current step is a playable exercise step. */
    isExerciseStep: boolean;
    /** The current step (``null`` on the summary screen). */
    step: ContentLessonStep | null;
}

/**
 * Render the reverse-mode "(not reversible)" note, or nothing.
 *
 * @param props - See {@link LessonReverseNoteProps}.
 */
export default function LessonReverseNote({
    reverseMode,
    isExerciseStep,
    step,
}: LessonReverseNoteProps) {
    const {t} = useI18n();
    if (!reverseMode || !isExerciseStep || !step || stepIsReversible(step)) {
        return null;
    }
    return (
        <p
            className="m-0 px-2 text-sm italic text-[var(--fg-secondary)]"
            role="note"
            data-testid="lesson-reverse-not-reversible"
        >
            {t(
                "lesson.reverse.not_reversible",
                "This exercise type can't be reversed - shown in its original format.",
            )}
        </p>
    );
}
