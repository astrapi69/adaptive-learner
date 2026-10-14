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
 * LessonPage under the complexity gate).
 *
 * @example
 * <LessonExamNotice lessonMode={lessonMode} progress={progress} />
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
}

export default function LessonExamNotice({lessonMode, progress}: LessonExamNoticeProps) {
    const {t} = useI18n();
    if (lessonMode !== "exam" || runHasAnswer(progress)) return null;
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
