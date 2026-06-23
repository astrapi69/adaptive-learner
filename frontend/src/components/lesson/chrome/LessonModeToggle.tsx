/**
 * LessonModeToggle (#1007).
 *
 * Segmented control at the top of a lesson to switch between Practice
 * (scaffolding on) and Exam (aids hidden — the testing effect). Pure
 * presentation; the lesson player owns the mode state and seeds it from
 * the learner's default-mode setting.
 *
 * Tailwind + design tokens (shadcn ``Button``); works in every theme.
 */

import {GraduationCap, Lightbulb, Timer} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {LessonMode} from "../../../lib/learning/lessonModePref";

export interface LessonModeToggleProps {
    mode: LessonMode;
    onChange: (mode: LessonMode) => void;
    /** Disable switching once the lesson is under way (so a mid-lesson
     *  flip can't change the rules of an in-progress run). */
    disabled?: boolean;
}

/**
 * Render the Practice / Exam segmented control.
 *
 * @param props - See {@link LessonModeToggleProps}.
 */
export default function LessonModeToggle({
    mode,
    onChange,
    disabled = false,
}: LessonModeToggleProps) {
    const {t} = useI18n();
    const practiceActive = mode === "practice";
    const examActive = mode === "exam";
    const timedActive = mode === "timed";
    return (
        <div
            className="flex flex-wrap items-center gap-2 px-2 py-1"
            role="group"
            aria-label={t("lesson.mode.label", "Lesson mode")}
            data-testid="lesson-mode-toggle"
        >
            <Button
                type="button"
                variant={practiceActive ? "default" : "outline"}
                size="sm"
                aria-pressed={practiceActive}
                disabled={disabled}
                onClick={() => onChange("practice")}
                data-testid="lesson-mode-practice"
            >
                <Lightbulb size={14} aria-hidden="true" />
                {t("lesson.mode.practice", "Practice")}
            </Button>
            <Button
                type="button"
                variant={examActive ? "default" : "outline"}
                size="sm"
                aria-pressed={examActive}
                disabled={disabled}
                onClick={() => onChange("exam")}
                data-testid="lesson-mode-exam"
            >
                <GraduationCap size={14} aria-hidden="true" />
                {t("lesson.mode.exam", "Exam")}
            </Button>
            <Button
                type="button"
                variant={timedActive ? "default" : "outline"}
                size="sm"
                aria-pressed={timedActive}
                disabled={disabled}
                onClick={() => onChange("timed")}
                data-testid="lesson-mode-timed"
            >
                <Timer size={14} aria-hidden="true" />
                {t("lesson.mode.timed", "Timed")}
            </Button>
        </div>
    );
}
