/**
 * buildShuffleLesson — the Zufall-Modus synthetic-lesson builder (#1014).
 *
 * Set-level interleaving (``cardSource: "set-shuffle"`` in MODE_CONFIGS):
 * pool every exercise of EVERY lesson in a set, Fisher-Yates shuffle, then
 * repair the order so no more than {@link MAX_CONSECUTIVE_SAME_LESSON}
 * questions come from the same source lesson in a row, and cap to a
 * configurable session length (default {@link DEFAULT_SHUFFLE_LIMIT}).
 *
 * The output is an in-memory {@link ContentLesson} the existing player
 * renders unchanged (same mechanic as ``synthesizeReviewLesson``). Each step
 * carries its source lesson's id in ``review_lesson_id`` so the SRS recorder
 * addresses the right element row, and so the summary can break the score
 * down per lesson. The lesson's ``cards`` are the union of every source
 * lesson's cards (card-id-keyed, so a replayed exercise's ``card_ids`` still
 * resolve).
 *
 * Pure + deterministic: the RNG is injectable (``opts.rng``), so tests pin an
 * exact order; production defaults to ``Math.random``.
 */

import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonStep,
} from "../../storage/types";

/** Default session length (questions). The learner can pick 10/20/30/50. */
export const DEFAULT_SHUFFLE_LIMIT = 20;

/** Never more than this many consecutive questions from one source lesson. */
export const MAX_CONSECUTIVE_SAME_LESSON = 3;

/** The five exercise types the player can render. Mirrors
 *  ``SUPPORTED_EXERCISE_TYPES`` in ``ExerciseDispatcher`` — kept local so the
 *  builder stays a pure, React-free module. */
const SUPPORTED_TYPES = new Set([
    "matching",
    "picture_choice",
    "free_text",
    "word_tiles",
    "cloze",
]);

/** One source lesson feeding the shuffle pool. */
export interface ShuffleSourceLesson {
    /** The id the SRS layer uses (the lesson's storage filename). Stamped
     *  onto each emitted step as ``review_lesson_id``. */
    lessonId: string;
    /** Display label for the per-lesson summary breakdown. */
    title: string;
    /** The cached lesson payload to draw exercises + cards from. */
    lesson: ContentLesson;
}

export interface BuildShuffleOptions {
    /** Cap on emitted questions. Default {@link DEFAULT_SHUFFLE_LIMIT}. */
    limit?: number;
    /** Title for the synthesised lesson (caller passes a localised string). */
    title: string;
    /** Optional description shown under the title. */
    description?: string | null;
    /** Injectable RNG in ``[0, 1)`` for deterministic tests.
     *  Default ``Math.random``. */
    rng?: () => number;
}

/** A pooled, source-tagged exercise step before shuffling. */
interface PooledStep {
    step: ContentLessonStep;
    lessonId: string;
}

/** Fisher-Yates shuffle in place using an injectable RNG. Pure w.r.t. the
 *  RNG: same RNG sequence → same permutation. */
function fisherYates<T>(items: T[], rng: () => number): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
    }
    return items;
}

/**
 * Reorder a shuffled pool so no run of the same source lesson exceeds
 * {@link MAX_CONSECUTIVE_SAME_LESSON}. Greedy keep-first repair: when placing
 * the next item would extend the current run past the cap, pull the nearest
 * later item from a DIFFERENT lesson to this slot instead (swap). When no
 * differing item remains (every leftover is the same lesson), the run is
 * unavoidable and is accepted. Order-stable otherwise. Pure.
 */
function limitConsecutive(pool: PooledStep[]): PooledStep[] {
    const out: PooledStep[] = [];
    const remaining = [...pool];
    let runLesson: string | null = null;
    let runLength = 0;

    while (remaining.length > 0) {
        let pickIndex = 0;
        const wouldExtend =
            remaining[0].lessonId === runLesson &&
            runLength >= MAX_CONSECUTIVE_SAME_LESSON;
        if (wouldExtend) {
            const alt = remaining.findIndex((p) => p.lessonId !== runLesson);
            if (alt !== -1) pickIndex = alt;
        }
        const [picked] = remaining.splice(pickIndex, 1);
        if (picked.lessonId === runLesson) {
            runLength += 1;
        } else {
            runLesson = picked.lessonId;
            runLength = 1;
        }
        out.push(picked);
    }
    return out;
}

/** Collect the supported exercise steps from one source lesson, re-keyed +
 *  source-tagged for the shuffle pool. */
function poolFromLesson(source: ShuffleSourceLesson): PooledStep[] {
    const pooled: PooledStep[] = [];
    for (const step of source.lesson.steps) {
        if (
            step.type !== "exercise" ||
            step.exercise == null ||
            !SUPPORTED_TYPES.has(step.exercise.type)
        ) {
            continue;
        }
        pooled.push({
            lessonId: source.lessonId,
            step: {
                id: `shuffle-${source.lessonId}-${step.exercise.id}`,
                type: "exercise",
                title: null,
                // The SRS recorder reads this to address the right row; the
                // step id is NOT reliably parseable back to the lesson id.
                review_lesson_id: source.lessonId,
                exercise: {...step.exercise},
            },
        });
    }
    return pooled;
}

/**
 * Build the shuffled, interleaved {@link ContentLesson} from the set's
 * lessons. Returns a lesson with zero steps when fewer than two source
 * lessons actually contribute exercises (the caller treats that as the
 * "not enough content to shuffle" state).
 */
export function buildShuffleLesson(
    sources: readonly ShuffleSourceLesson[],
    opts: BuildShuffleOptions,
): ContentLesson {
    const limit = opts.limit ?? DEFAULT_SHUFFLE_LIMIT;
    const rng = opts.rng ?? Math.random;

    const contributing = sources.filter(
        (s) => poolFromLesson(s).length > 0,
    );
    const pool: PooledStep[] = contributing.flatMap(poolFromLesson);

    const shuffled = fisherYates(pool, rng);
    const interleaved = limitConsecutive(shuffled);
    const steps = interleaved.slice(0, limit).map((p) => p.step);

    // Union of every contributing lesson's cards, de-duplicated by id, so a
    // replayed exercise's ``card_ids`` still resolve in the player.
    const cardById = new Map<string, ContentLessonCard>();
    for (const source of contributing) {
        for (const card of source.lesson.cards) {
            if (!cardById.has(card.id)) cardById.set(card.id, card);
        }
    }

    const setId = contributing[0]?.lesson.id ?? "";
    return {
        id: `shuffle-${setId}-${new Date().toISOString()}`,
        title: opts.title,
        description: opts.description ?? null,
        estimated_minutes: Math.max(1, Math.round(steps.length / 2)),
        cards: Array.from(cardById.values()),
        steps,
    };
}

/** How many distinct source lessons the synthesised shuffle steps draw from
 *  (for the summary "from N different lessons" line). Pure. */
export function distinctSourceLessonCount(
    steps: readonly ContentLessonStep[],
): number {
    const ids = new Set<string>();
    for (const step of steps) {
        if (step.review_lesson_id) ids.add(step.review_lesson_id);
    }
    return ids.size;
}
