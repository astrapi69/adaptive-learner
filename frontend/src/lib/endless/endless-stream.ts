/**
 * endless-stream — the Endlos-Modus card-stream builder (#1015).
 *
 * Endless mode (``cardSource: "srs"``, ``sessionEnd: "endless"`` in
 * MODE_CONFIGS) is a continuous, never-finishing practice stream over a
 * set's exercises. The opening queue follows the issue's priority order:
 *
 *   1. **due SRS reviews + error cards** — the caller passes the element
 *      review queue's exercise ids in priority order (the queue already
 *      sorts overdue → weakness tier → error frequency → longest unseen),
 *   2. **new cards** — exercises with no prior attempt, in lesson order,
 *
 * and once that queue is exhausted the stream switches to **random
 * repetition** over the full pool (so it never ends).
 *
 * This module is pure + deterministic (the random phase takes an injectable
 * RNG); the hook does the storage wiring and holds the session cursor. The
 * caller advances by index: {@link endlessStepAt} returns the step to show
 * at a given 0-based position, drawing from the queue first and then the
 * pool.
 */

import type {
    ContentLesson,
    ContentLessonStep,
} from "../../storage/types";

/** The five exercise types the player can render (mirrors the dispatcher). */
const SUPPORTED_TYPES = new Set([
    "matching",
    "picture_choice",
    "free_text",
    "word_tiles",
    "cloze",
]);

/** One source lesson feeding the endless pool. */
export interface EndlessSourceLesson {
    /** The id the SRS layer addresses (the lesson's storage filename),
     *  stamped on each step as ``review_lesson_id``. */
    lessonId: string;
    /** Display label (kept for parity with the shuffle source shape). */
    title: string;
    /** The cached lesson payload to draw exercises from. */
    lesson: ContentLesson;
}

export interface BuildEndlessPlanInput {
    /** Every downloaded lesson of the set that has exercises. */
    sources: readonly EndlessSourceLesson[];
    /** Exercise ids that are due for review, in priority order (deduped by
     *  the caller from the element review queue). Drives tier 1. */
    dueExerciseIds: readonly string[];
    /** Exercise ids with at least one prior attempt. Their pool steps are
     *  NOT "new"; tier 2 is the complement of this set. */
    seenExerciseIds: ReadonlySet<string>;
}

/** The opening queue + the repetition pool the session draws from. */
export interface EndlessPlan {
    /** Ordered opening queue: due/error exercises first, then new ones. */
    queue: ContentLessonStep[];
    /** Full candidate pool (every supported exercise) for random
     *  repetition once {@link EndlessPlan.queue} is exhausted. */
    pool: ContentLessonStep[];
    /** How many opening-queue steps came from the due/error tier. */
    dueCount: number;
    /** How many opening-queue steps are new (no prior attempt). */
    newCount: number;
}

/**
 * Collect a lesson's supported exercise steps, re-keyed for uniqueness and
 * source-tagged so the SRS recorder addresses the right lesson. The
 * exercise id is preserved (the attempt is recorded under it).
 */
function poolFromLesson(source: EndlessSourceLesson): ContentLessonStep[] {
    const out: ContentLessonStep[] = [];
    for (const step of source.lesson.steps) {
        if (
            step.type !== "exercise" ||
            step.exercise == null ||
            !SUPPORTED_TYPES.has(step.exercise.type)
        ) {
            continue;
        }
        out.push({
            id: `endless-${source.lessonId}-${step.exercise.id}`,
            type: "exercise",
            title: null,
            review_lesson_id: source.lessonId,
            exercise: {...step.exercise},
        });
    }
    return out;
}

/** The exercise id a pooled step records under (falls back to the step id). */
function exerciseIdOf(step: ContentLessonStep): string {
    return step.exercise?.id ?? step.id;
}

/**
 * Build the endless plan from a set's lessons + the learner's SRS state.
 *
 * @param input - See {@link BuildEndlessPlanInput}.
 * @returns The opening queue + repetition pool (see {@link EndlessPlan}).
 */
export function buildEndlessPlan(input: BuildEndlessPlanInput): EndlessPlan {
    const pool = input.sources.flatMap(poolFromLesson);
    const byExerciseId = new Map<string, ContentLessonStep>();
    for (const step of pool) {
        const key = exerciseIdOf(step);
        if (!byExerciseId.has(key)) byExerciseId.set(key, step);
    }

    // Tier 1: due/error exercises, in the queue's priority order.
    const dueSteps: ContentLessonStep[] = [];
    const dueIds = new Set<string>();
    for (const exId of input.dueExerciseIds) {
        const step = byExerciseId.get(exId);
        if (step && !dueIds.has(exId)) {
            dueIds.add(exId);
            dueSteps.push(step);
        }
    }

    // Tier 2: new exercises (no prior attempt), in lesson order.
    const newSteps = pool.filter((step) => {
        const exId = exerciseIdOf(step);
        return !input.seenExerciseIds.has(exId) && !dueIds.has(exId);
    });

    const queue = [...dueSteps, ...newSteps];
    return {
        queue,
        pool,
        dueCount: dueSteps.length,
        newCount: newSteps.length,
    };
}

/**
 * The step to show at a 0-based session position. Draws from the opening
 * queue first; once it is exhausted, returns a random pool step (avoiding
 * an immediate repeat of ``lastStepId``). Returns ``null`` only when there
 * is no content at all.
 *
 * @param plan - The plan from {@link buildEndlessPlan}.
 * @param index - 0-based position in the session.
 * @param lastStepId - The previously shown step id (repeat avoidance).
 * @param rng - Injectable RNG in ``[0, 1)``; defaults to ``Math.random``.
 */
export function endlessStepAt(
    plan: EndlessPlan,
    index: number,
    lastStepId: string | null,
    rng: () => number = Math.random,
): ContentLessonStep | null {
    if (index < plan.queue.length) return plan.queue[index];
    const repeatPool = plan.pool.length > 0 ? plan.pool : plan.queue;
    if (repeatPool.length === 0) return null;
    if (repeatPool.length === 1) return repeatPool[0];
    let pick = Math.floor(rng() * repeatPool.length);
    if (repeatPool[pick].id === lastStepId) {
        pick = (pick + 1) % repeatPool.length;
    }
    return repeatPool[pick];
}
