/**
 * Notice at the start of an exam run (#3742).
 *
 * Exam mode moves on after each answer without saying whether it was
 * right (``immediateFeedback: false``) and offers no way back, by design.
 * Nothing said so before the first question, and a learner read it as a
 * bug. The notice shows in exam mode until the run's first answer.
 *
 * Renders nothing outside exam mode or once the run has an answer, so the
 * lesson page passes its state instead of branching itself (keeps
 * LessonPage under the complexity gate). The first answer is saved
 * asynchronously, so the notice also goes as soon as the learner is past
 * the first exercise: waiting for the save left it on the next step for a
 * frame, and its removal moved that step's options after they were painted
 * (#3752).
 *
 * @example
 * <LessonExamNotice lessonMode={lessonMode} progress={progress}
 *     steps={lesson.steps} currentStepIndex={currentStepIndex} />
 */

import {GraduationCap} from "lucide-react";

import {useI18n} from "../../hooks/ui/useI18n";
import type {LessonMode} from "../../lib/learning/lessonModePref";
import type {LessonProgress} from "../../storage/types";
import {runHasAnswer} from "../../lib/lesson/progress/resume-mode";

export interface LessonExamNoticeProps {
    lessonMode: LessonMode;
    /** The stored run; a completed one is a finished run, not this one. */
    progress: LessonProgress | null;
    /** The lesson's steps; with ``currentStepIndex`` it tells whether the
     *  learner is past the first exercise. */
    steps?: readonly {type: string}[];
    currentStepIndex?: number;
}

/** Whether the learner is past the run's first exercise step. */
function pastFirstExercise(steps: readonly {type: string}[], currentStepIndex: number): boolean {
    const first = steps.findIndex((step) => step.type === "exercise");
    return first >= 0 && currentStepIndex > first;
}

export default function LessonExamNotice({
    lessonMode,
    progress,
    steps = [],
    currentStepIndex = 0,
}: LessonExamNoticeProps) {
    const {t} = useI18n();
    if (lessonMode !== "exam" || runHasAnswer(progress)) return null;
    if (pastFirstExercise(steps, currentStepIndex)) return null;
    return (
        <p
            role="note"
            data-testid="lesson-exam-notice"
            className="m-0 flex items-center gap-2 px-2 text-sm text-[var(--fg-secondary)]"
        >
            <GraduationCap size={16} aria-hidden="true" />
            {t(
                "lesson.exam.start_notice",
                "Exam: you only see at the end whether an answer was right, and you cannot go back.",
            )}
        </p>
    );
}
