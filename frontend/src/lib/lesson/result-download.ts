/**
 * Lesson result export orchestration (#354, extracted from the
 * ``LessonSummary`` component in ``pages/Lesson.tsx``).
 *
 * Composes the pure builders in ``result-export.ts`` into the two
 * export artifacts the summary screen offers — the Markdown report
 * (#138) and its structured JSON twin (#167 bug 3) — plus the
 * browser download trigger. The caller resolves the i18n labels and
 * passes them in, so everything except ``downloadBlob`` stays
 * unit-testable without a DOM.
 */

import {
    buildLessonResultJson,
    buildLessonResultMarkdown,
    collectWeakAreas,
    lessonResultFilename,
    type LessonResultLabels,
} from "./result-export";
import type {ExerciseBreakdownEntry} from "./lesson-summary";
import type {
    ContentLesson,
    ElementError,
    LessonProgress,
} from "../../storage/types";

/** Trigger a browser download of ``content`` as ``filename``. */
export function downloadBlob(
    content: string,
    filename: string,
    mime: string,
): void {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

/** Score + history inputs shared by both export shapes. */
export interface LessonExportInputs {
    lesson: ContentLesson;
    correct: number;
    total: number;
    /** Score percentage, already rounded for display. */
    pct: number;
    /** ElementError rows of THIS lesson run (weak-area derivation). */
    sessionErrors: ElementError[];
    /** Export timestamp; injectable for deterministic tests. */
    now?: Date;
}

/**
 * Build the Markdown result report + its filename (#138).
 *
 * The date renders as ISO 8601 in the artifact (filename + body),
 * consistent with ``lessonResultFilename`` — locale formatting is
 * for live UI display only, never the exported document (#167 bug 5).
 */
export function buildLessonMarkdownExport(
    inputs: LessonExportInputs & {
        breakdown: ExerciseBreakdownEntry[];
        labels: LessonResultLabels;
    },
): {markdown: string; filename: string} {
    const now = inputs.now ?? new Date();
    const markdown = buildLessonResultMarkdown({
        lessonTitle: inputs.lesson.title,
        dateStr: now.toISOString().slice(0, 10),
        correct: inputs.correct,
        total: inputs.total,
        pct: inputs.pct,
        breakdown: inputs.breakdown,
        weakAreas: collectWeakAreas(inputs.sessionErrors),
        labels: inputs.labels,
    });
    return {markdown, filename: lessonResultFilename(inputs.lesson.title, now)};
}

/**
 * Build the structured JSON twin of the Markdown export + its
 * filename (#167 bug 3). Carries the prompt, the learner's answer +
 * verbatim raw answer, the correct answer, pass/fail, and concept
 * tags per exercise.
 */
export function buildLessonJsonExport(
    inputs: LessonExportInputs & {progress: LessonProgress | null},
): {json: string; filename: string} {
    const now = inputs.now ?? new Date();
    const result = buildLessonResultJson({
        lesson: inputs.lesson,
        progress: inputs.progress,
        dateStr: now.toISOString().slice(0, 10),
        correct: inputs.correct,
        total: inputs.total,
        pct: inputs.pct,
        weakAreas: collectWeakAreas(inputs.sessionErrors),
    });
    return {
        json: JSON.stringify(result, null, 2),
        filename: lessonResultFilename(inputs.lesson.title, now, "json"),
    };
}
