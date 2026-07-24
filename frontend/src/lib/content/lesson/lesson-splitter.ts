/**
 * Lesson splitter (Phase 63G / EXP-020).
 *
 * Python mirror: ``adaptive_learner_content_loader/lesson_splitter.py``
 *
 * Splits a ``ContentLesson`` into multiple parts when it exceeds
 * ``maxStepsPerPart``. Each part is a self-contained
 * ``ContentLesson`` — only the cards referenced by the part's steps
 * are included, so the sub-lesson validates correctly.
 *
 * Rules:
 *   - If ``lesson.steps.length <= maxStepsPerPart``, returns
 *     ``[lesson]`` unchanged (no copy made).
 *   - Steps are chunked in order; no step is reordered.
 *   - Each part carries a title suffix " — Part N of M".
 *   - Each part's id is ``"${lesson.id}-part-${n}"`` (1-indexed).
 *   - ``estimated_minutes`` scales proportionally (minimum 1).
 *   - Cards not referenced by any step in the part are excluded.
 *   - ``cards`` that appear in ``lesson.cards`` are retained by
 *     reference for memory efficiency.
 *
 * Cross-language parity: the Python mirror produces byte-identical
 * JSON output for the same input (pinned by shared golden fixtures
 * under ``tests/fixtures/lesson-splitter-parity/``).
 */

import type {ContentLesson, ContentLessonCard, ContentLessonStep} from "../../../storage/types";

/** Context handed to a {@link SplitOptions.partTitle} formatter. */
export interface PartTitleContext {
    /** The base lesson title (before any part suffix). */
    title: string;
    /** 1-indexed part number. */
    part: number;
    /** Total number of parts the lesson was split into. */
    total: number;
}

export interface SplitOptions {
    maxStepsPerPart?: number;
    /**
     * Optional formatter for each part's title. Receives the base
     * lesson title plus the 1-indexed part number and the total part
     * count, and returns the full part title.
     *
     * Defaults to the language-neutral English
     * ``"{title} — Part {n} of {total}"``. The default is intentional:
     * the persisted lesson data + the Python parity goldens stay
     * byte-identical when no formatter is supplied, so only the
     * user-facing caller (``SaveOfflineLessonModal``) opts into a
     * localized title.
     */
    partTitle?: (ctx: PartTitleContext) => string;
}

const DEFAULT_MAX_STEPS = 10;

/** Language-neutral default part title (pinned by the parity goldens). */
function defaultPartTitle({title, part, total}: PartTitleContext): string {
    return `${title} - Part ${part} of ${total}`;
}

/**
 * Split ``lesson`` into parts of at most ``maxStepsPerPart`` steps.
 *
 * Returns ``[lesson]`` when no split is necessary.
 */
export function splitLesson(
    lesson: ContentLesson,
    options: SplitOptions = {},
): ContentLesson[] {
    const maxSteps = options.maxStepsPerPart ?? DEFAULT_MAX_STEPS;
    if (maxSteps < 1) {
        throw new Error(`maxStepsPerPart must be >= 1, got ${maxSteps}`);
    }
    if (lesson.steps.length <= maxSteps) {
        return [lesson];
    }

    const chunks = chunkSteps(lesson.steps, maxSteps);
    const total = chunks.length;
    const cardById = new Map<string, ContentLessonCard>(
        lesson.cards.map((c) => [c.id, c]),
    );
    const totalSteps = lesson.steps.length;
    const formatPartTitle = options.partTitle ?? defaultPartTitle;

    return chunks.map((steps, idx) => {
        const partNum = idx + 1;
        const referencedIds = collectCardIds(steps);
        const partCards = referencedIds
            .map((id) => cardById.get(id))
            .filter((c): c is ContentLessonCard => c !== undefined);

        const estimatedMinutes = Math.max(
            1,
            Math.round((lesson.estimated_minutes * steps.length) / totalSteps),
        );

        return {
            ...lesson,
            id: `${lesson.id}-part-${partNum}`,
            title: formatPartTitle({
                title: lesson.title,
                part: partNum,
                total,
            }),
            cards: partCards,
            steps,
            estimated_minutes: estimatedMinutes,
        };
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkSteps(
    steps: ContentLessonStep[],
    size: number,
): ContentLessonStep[][] {
    const chunks: ContentLessonStep[][] = [];
    for (let i = 0; i < steps.length; i += size) {
        chunks.push(steps.slice(i, i + size));
    }
    return chunks;
}

/** Return card IDs referenced by the exercises in the given steps,
 *  in order of first appearance, deduplicated. */
function collectCardIds(steps: ContentLessonStep[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const step of steps) {
        for (const id of step.exercise?.card_ids ?? []) {
            if (!seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
        }
    }
    return ids;
}
