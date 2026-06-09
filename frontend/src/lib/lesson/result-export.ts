/**
 * Lesson result export (#138).
 *
 * Pure helpers that turn a finished lesson's score + per-exercise
 * breakdown + weak-element history into a Markdown document the
 * learner can copy or download and paste into an AI assistant to
 * practice the weak spots.
 *
 * Kept free of React + i18n so it unit-tests in isolation: the
 * caller resolves the section labels via ``t()`` and passes them
 * in as a ``LessonResultLabels`` object. No storage reads here —
 * the data is already in scope on the summary screen.
 */

import type {ElementError} from "../../storage/types";
import type {ExerciseBreakdownEntry} from "../lesson-summary";

/** Localized section labels, resolved by the caller from the
 *  i18n catalog so this module stays language-agnostic. */
export interface LessonResultLabels {
    title: string;
    date: string;
    score: string;
    correctWord: string;
    mistakesHeading: string;
    noMistakes: string;
    question: string;
    yourAnswer: string;
    correctAnswer: string;
    weakAreasHeading: string;
}

/** A still-unmastered element the learner should keep practicing. */
export interface WeakArea {
    label: string;
    count: number;
}

/**
 * Collapse a lesson's ``ElementError`` rows into a deduplicated,
 * most-missed-first list of weak areas.
 *
 * Only rows that are NOT yet mastered are surfaced (a mastered
 * element is no longer a weak spot). Rows are keyed by
 * ``element_key`` so the same word missed across several
 * exercises counts once, carrying its highest ``error_count``.
 * The label is the canonical answer (what to learn), falling
 * back to the element key when the answer text is empty.
 */
export function collectWeakAreas(
    errors: ElementError[],
    limit = 10,
): WeakArea[] {
    const byKey = new Map<string, WeakArea>();
    for (const err of errors) {
        if (err.mastered) continue;
        const label = (err.correct_answer || err.element_key).trim();
        if (!label) continue;
        const existing = byKey.get(err.element_key);
        const count = err.error_count ?? 1;
        if (existing) {
            existing.count = Math.max(existing.count, count);
        } else {
            byKey.set(err.element_key, {label, count});
        }
    }
    return [...byKey.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/** ASCII, filesystem-safe slug for the download filename. */
function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/\u00df/g, "ss")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "lesson"
    );
}

/** ``lesson-result-<slug>-<yyyy-mm-dd>.md`` — ASCII filename. */
export function lessonResultFilename(
    lessonTitle: string,
    date: Date,
): string {
    const iso = date.toISOString().slice(0, 10);
    return `lesson-result-${slugify(lessonTitle)}-${iso}.md`;
}

interface BuildArgs {
    lessonTitle: string;
    dateStr: string;
    correct: number;
    total: number;
    pct: number;
    breakdown: ExerciseBreakdownEntry[];
    weakAreas: WeakArea[];
    labels: LessonResultLabels;
}

/**
 * Render the lesson result as Markdown.
 *
 * Structure (labels localized):
 *
 *     # <title>: <lesson>
 *     <date>: <dateStr>
 *     <score>: c/t correct (p%)
 *
 *     ## <mistakes>
 *     - <question>: ...
 *       <yourAnswer>: ...   (only when a text answer was recorded)
 *       <correctAnswer>: ...
 *
 *     ## <weakAreas>
 *     - label (Nx)
 *
 * A perfect run renders the mistakes section as a single
 * "no mistakes" line. The weak-areas section is omitted entirely
 * when there is nothing unmastered to list.
 */
export function buildLessonResultMarkdown(args: BuildArgs): string {
    const {
        lessonTitle,
        dateStr,
        correct,
        total,
        pct,
        breakdown,
        weakAreas,
        labels,
    } = args;

    const lines: string[] = [];
    lines.push(`# ${labels.title}: ${lessonTitle}`);
    lines.push(`${labels.date}: ${dateStr}`);
    lines.push(
        `${labels.score}: ${correct}/${total} ${labels.correctWord} (${pct}%)`,
    );
    lines.push("");

    const mistakes = breakdown.filter(
        (entry) => entry.attempted && !entry.fullyCorrect,
    );
    lines.push(`## ${labels.mistakesHeading}`);
    if (mistakes.length === 0) {
        lines.push(`- ${labels.noMistakes}`);
    } else {
        for (const entry of mistakes) {
            lines.push(`- ${labels.question}: ${entry.title}`);
            if (entry.userAnswer) {
                lines.push(`  ${labels.yourAnswer}: ${entry.userAnswer}`);
            }
            if (entry.canonicalAnswer) {
                lines.push(
                    `  ${labels.correctAnswer}: ${entry.canonicalAnswer}`,
                );
            }
        }
    }

    if (weakAreas.length > 0) {
        lines.push("");
        lines.push(`## ${labels.weakAreasHeading}`);
        for (const area of weakAreas) {
            lines.push(`- ${area.label} (${area.count}x)`);
        }
    }

    return lines.join("\n") + "\n";
}
