/**
 * MaxLessonSizeControl (Phase 63I / EXP-020).
 *
 * Settings > Learning control that lets the learner set the
 * maximum number of steps per lesson part before the
 * Save-as-Offline-Lesson flow splits the lesson.
 * Stored client-side in localStorage (same pattern as
 * PausedLessonsRetentionControl).
 */

import {useState} from "react";

import {Input} from "@/components/ui/input";
import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {
    DEFAULT_MAX_LESSON_SIZE,
    MAX_MAX_LESSON_SIZE,
    MIN_MAX_LESSON_SIZE,
    readMaxLessonSize,
    writeMaxLessonSize,
} from "../../../../lib/learning/maxLessonSizePref";

export default function MaxLessonSizeControl() {
    const {t} = useI18n();
    const [size, setSize] = useState<number>(() => readMaxLessonSize());

    const onChange = (value: string) => {
        const parsed = parseInt(value, 10);
        if (
            isNaN(parsed) ||
            parsed < MIN_MAX_LESSON_SIZE ||
            parsed > MAX_MAX_LESSON_SIZE
        ) {
            return;
        }
        setSize(parsed);
        writeMaxLessonSize(parsed);
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-max-lesson-size"
        >
            <h2 className="settings-section-title">
                {t("settings.max_lesson_size.title", "Maximum lesson size")}
            </h2>
            <FormHint>
                {t(
                    "settings.max_lesson_size.hint",
                    "When saving a long chat analysis as an offline lesson, lessons with more than this many steps are automatically split into multiple parts.",
                )}
            </FormHint>
            <label className="form-row">
                <span className="form-label">
                    {t(
                        "settings.max_lesson_size.label",
                        "Steps per part",
                    )}
                </span>
                <Input
                    type="number"
                    data-testid="settings-max-lesson-size-input"
                    className="w-24"
                    value={size}
                    min={MIN_MAX_LESSON_SIZE}
                    max={MAX_MAX_LESSON_SIZE}
                    onChange={(e) => onChange(e.target.value)}
                />
                <span className="form-hint-inline">
                    {t(
                        "settings.max_lesson_size.range_hint",
                        "(default {default}, range {min}–{max})",
                    )
                        .replace("{default}", String(DEFAULT_MAX_LESSON_SIZE))
                        .replace("{min}", String(MIN_MAX_LESSON_SIZE))
                        .replace("{max}", String(MAX_MAX_LESSON_SIZE))}
                </span>
            </label>
        </section>
    );
}
