/**
 * LessonModeControl (#1007).
 *
 * Settings > Learning control for the two lesson-mode preferences:
 *   - **Default mode** — which mode a lesson starts in (Practice keeps the
 *     scaffolding on; Exam hides the aids for the "testing effect").
 *   - **Exam pass threshold** — the percent correct needed to pass an
 *     exam-mode run, shown on the lesson summary.
 *
 * Feeds {@link readDefaultLessonMode} / {@link readExamPassThreshold}.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    EXAM_PASS_THRESHOLD_OPTIONS,
    LESSON_MODE_OPTIONS,
    LESSON_MODE_PREF_CHANGE_EVENT,
    readDefaultLessonMode,
    readExamPassThreshold,
    writeDefaultLessonMode,
    writeExamPassThreshold,
    type ExamPassThreshold,
    type LessonMode,
} from "../../../lib/learning/lessonModePref";
import {
    readTimedDifficulty,
    TIMED_DIFFICULTY_OPTIONS,
    writeTimedDifficulty,
    type TimedDifficulty,
} from "../../../lib/learning/timedMode";

const MODE_LABELS: Record<LessonMode, {key: string; fallback: string}> = {
    practice: {key: "lesson.mode.practice", fallback: "Practice"},
    exam: {key: "lesson.mode.exam", fallback: "Exam"},
    timed: {key: "lesson.mode.timed", fallback: "Timed"},
};

const DIFFICULTY_LABELS: Record<
    TimedDifficulty,
    {key: string; fallback: string}
> = {
    relaxed: {key: "settings.lesson_mode.timed_relaxed", fallback: "Relaxed (2× time)"},
    normal: {key: "settings.lesson_mode.timed_normal", fallback: "Normal"},
    fast: {key: "settings.lesson_mode.timed_fast", fallback: "Fast (0.7× time)"},
};

export default function LessonModeControl() {
    const {t} = useI18n();
    const [mode, setMode] = useState<LessonMode>(() => readDefaultLessonMode());
    const [threshold, setThreshold] = useState<ExamPassThreshold>(() =>
        readExamPassThreshold(),
    );
    const [difficulty, setDifficulty] = useState<TimedDifficulty>(() =>
        readTimedDifficulty(),
    );

    useEffect(() => {
        const refresh = () => {
            setMode(readDefaultLessonMode());
            setThreshold(readExamPassThreshold());
            setDifficulty(readTimedDifficulty());
        };
        window.addEventListener("storage", refresh);
        window.addEventListener(LESSON_MODE_PREF_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(LESSON_MODE_PREF_CHANGE_EVENT, refresh);
        };
    }, []);

    return (
        <section
            className="settings-section"
            data-testid="settings-section-lesson-mode"
        >
            <h2 className="settings-section-title">
                {t("settings.lesson_mode.title", "Lesson mode")}
            </h2>
            <p className="form-hint">
                {t(
                    "settings.lesson_mode.hint",
                    "Practice keeps every learning aid on. Exam hides hints, theory recap, auto-read and the solution reveal so you retrieve under realistic conditions.",
                )}
            </p>
            <label className="form-row">
                <span className="form-label">
                    {t("settings.lesson_mode.default_label", "Default mode")}
                </span>
                <select
                    className="form-select"
                    value={mode}
                    onChange={(e) => {
                        const next = e.target.value as LessonMode;
                        setMode(next);
                        writeDefaultLessonMode(next);
                    }}
                    data-testid="lesson-mode-default-select"
                >
                    {LESSON_MODE_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                            {t(MODE_LABELS[value].key, MODE_LABELS[value].fallback)}
                        </option>
                    ))}
                </select>
            </label>
            <label className="form-row">
                <span className="form-label">
                    {t(
                        "settings.lesson_mode.threshold_label",
                        "Exam pass threshold",
                    )}
                </span>
                <select
                    className="form-select"
                    value={threshold}
                    onChange={(e) => {
                        const next = Number(e.target.value) as ExamPassThreshold;
                        setThreshold(next);
                        writeExamPassThreshold(next);
                    }}
                    data-testid="lesson-mode-threshold-select"
                >
                    {EXAM_PASS_THRESHOLD_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                            {value}%
                        </option>
                    ))}
                </select>
            </label>
            <label className="form-row">
                <span className="form-label">
                    {t(
                        "settings.lesson_mode.timed_difficulty_label",
                        "Timed mode difficulty",
                    )}
                </span>
                <select
                    className="form-select"
                    value={difficulty}
                    onChange={(e) => {
                        const next = e.target.value as TimedDifficulty;
                        setDifficulty(next);
                        writeTimedDifficulty(next);
                    }}
                    data-testid="lesson-mode-timed-difficulty-select"
                >
                    {TIMED_DIFFICULTY_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                            {t(
                                DIFFICULTY_LABELS[value].key,
                                DIFFICULTY_LABELS[value].fallback,
                            )}
                        </option>
                    ))}
                </select>
            </label>
        </section>
    );
}
