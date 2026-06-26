/**
 * useEndlessLesson — the Endlos-Modus session hook (#1015).
 *
 * Drives a continuous, never-finishing SRS practice stream over a set:
 *   1. resolves the set's ``source`` + lists + fetches every lesson,
 *   2. reads the element review queue (due/error exercises, prioritized) +
 *      the element-error list (which exercises have been attempted),
 *   3. builds an {@link EndlessPlan} (due → new → random repetition),
 *   4. hands out one step at a time via an imperative cursor (the random
 *      phase is non-deterministic, so the step is computed on advance, not
 *      derived in render).
 *
 * The session is ephemeral (no LessonProgress row); every answer updates the
 * SRS immediately through the same ``elementErrors.recordBulk`` path the main
 * viewer / review / shuffle use, so a correct answer levels the card up.
 * Dexie-mode-friendly: all IO goes through ``getStorage()``.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {readLearnerState} from "../../lib/learning/learnerState";
import {
    buildEndlessPlan,
    endlessStepAt,
    type EndlessPlan,
    type EndlessSourceLesson,
} from "../../lib/endless/endless-stream";
import {notifyReviewsChanged} from "../../lib/review/reviewsChanged";
import {stampHintUsage} from "../../lib/hints/hint-usage";
import {getStorage} from "../../storage";
import type {
    ContentLessonCard,
    ContentLessonStep,
    ElementAttempt,
} from "../../storage/types";

export type EndlessLessonStatus =
    | "loading"
    | "empty"
    | "not-cached"
    | "ready"
    | "error";

export interface UseEndlessLessonOptions {
    setId: string;
    /** Localised title for the session. */
    title: string;
}

/** Running session counters, all derivable from the answered steps. */
export interface EndlessStats {
    /** Cards answered this session. */
    cards: number;
    /** Correct answers. */
    correct: number;
    /** Answered steps that were due for review at session start. */
    reviewsDone: number;
    /** Distinct new (previously unattempted) exercises answered correctly. */
    newLearned: number;
    /** Answered steps that had a prior attempt (error practice). */
    errorsPracticed: number;
    /** Session practice points (one per correct answer; xp multiplier 1.0). */
    xp: number;
}

const EMPTY_STATS: EndlessStats = {
    cards: 0,
    correct: 0,
    reviewsDone: 0,
    newLearned: 0,
    errorsPracticed: 0,
    xp: 0,
};

export interface UseEndlessLessonResult {
    status: EndlessLessonStatus;
    /** The exercise step to show now (``null`` while loading). */
    step: ContentLessonStep | null;
    /** The set's cards (so the dispatcher can resolve ``card_ids``). */
    cards: ContentLessonCard[];
    stats: EndlessStats;
    error: string | null;
    /** Advance to the next stream card. */
    advance: () => void;
    recordStepAttempts: (
        attempts: readonly ElementAttempt[],
    ) => Promise<void>;
}

/** The exercise id a step records under. */
function exerciseIdOf(step: ContentLessonStep | null): string | null {
    if (!step) return null;
    return step.exercise?.id ?? step.id;
}

export function useEndlessLesson(
    opts: UseEndlessLessonOptions,
): UseEndlessLessonResult {
    const {setId, title} = opts;
    const [status, setStatus] = useState<EndlessLessonStatus>("loading");
    const [step, setStep] = useState<ContentLessonStep | null>(null);
    const [cards, setCards] = useState<ContentLessonCard[]>([]);
    const [stats, setStats] = useState<EndlessStats>(EMPTY_STATS);
    const [error, setError] = useState<string | null>(null);

    const userId = useMemo(() => readLearnerState().userId, []);

    // Imperative cursor state (the random phase isn't derivable in render).
    const planRef = useRef<EndlessPlan | null>(null);
    const positionRef = useRef(0);
    const dueSetRef = useRef<ReadonlySet<string>>(new Set());
    const newSetRef = useRef<ReadonlySet<string>>(new Set());
    const seenSetRef = useRef<ReadonlySet<string>>(new Set());
    // Distinct new exercises learned correctly (dedup so a repeat doesn't
    // double-count).
    const learnedRef = useRef<Set<string>>(new Set());
    const stepRef = useRef<ContentLessonStep | null>(null);
    stepRef.current = step;

    useEffect(() => {
        if (!setId) {
            setStatus("empty");
            return;
        }
        let cancelled = false;
        setStatus("loading");
        setError(null);
        void (async () => {
            try {
                const storage = getStorage();
                const sets = await storage.contentLoader.listSets();
                if (cancelled) return;
                const match = sets.sets.find((s) => s.id === setId);
                if (!match) {
                    setStatus("not-cached");
                    return;
                }

                const list = await storage.contentLoader.listLessons(
                    match.source,
                    setId,
                );
                if (cancelled) return;

                const sources: EndlessSourceLesson[] = [];
                const allCards: ContentLessonCard[] = [];
                for (const filename of list.lessons) {
                    if (cancelled) return;
                    try {
                        const fetched = await storage.contentLoader.getLesson(
                            match.source,
                            setId,
                            filename,
                        );
                        if (
                            fetched.steps.some(
                                (s) =>
                                    s.type === "exercise" && s.exercise != null,
                            )
                        ) {
                            sources.push({
                                lessonId: filename,
                                title: fetched.title,
                                lesson: fetched,
                            });
                            allCards.push(...fetched.cards);
                        }
                    } catch {
                        // Skip lessons we can't fetch (evicted from cache).
                    }
                }
                if (cancelled) return;
                if (sources.length === 0) {
                    setStatus("empty");
                    return;
                }

                const {dueExerciseIds, seenExerciseIds} =
                    await loadSrsState(userId, setId);
                if (cancelled) return;

                const plan = buildEndlessPlan({
                    sources,
                    dueExerciseIds,
                    seenExerciseIds,
                });
                if (plan.queue.length === 0 && plan.pool.length === 0) {
                    setStatus("empty");
                    return;
                }

                planRef.current = plan;
                positionRef.current = 0;
                dueSetRef.current = new Set(dueExerciseIds);
                seenSetRef.current = seenExerciseIds;
                newSetRef.current = new Set(
                    plan.queue
                        .slice(plan.dueCount)
                        .map((s) => exerciseIdOf(s) ?? ""),
                );
                learnedRef.current = new Set();
                setCards(allCards);
                setStats(EMPTY_STATS);
                setStep(endlessStepAt(plan, 0, null));
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : String(err));
                setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [setId, title, userId]);

    const advance = useCallback(() => {
        const plan = planRef.current;
        if (!plan) return;
        const next = positionRef.current + 1;
        positionRef.current = next;
        setStep((prev) => endlessStepAt(plan, next, prev?.id ?? null));
    }, []);

    const recordStepAttempts = useCallback(
        async (attempts: readonly ElementAttempt[]) => {
            if (attempts.length === 0 || !userId) return;
            const exId = exerciseIdOf(stepRef.current);
            const correct = attempts.filter((a) => a.correct).length;
            const allCorrect = correct === attempts.length;
            setStats((prev) => nextStats(prev, exId, correct, allCorrect, {
                due: dueSetRef.current,
                neu: newSetRef.current,
                seen: seenSetRef.current,
                learned: learnedRef.current,
            }));
            try {
                await getStorage().elementErrors.recordBulk(
                    userId,
                    stampHintUsage(attempts),
                );
                notifyReviewsChanged();
            } catch {
                // Failure-tolerant: a recording failure must not end the
                // session — the running score stays the user's feedback.
            }
        },
        [userId],
    );

    return {status, step, cards, stats, error, advance, recordStepAttempts};
}

/** Read the SRS inputs the plan needs: due exercise ids (priority order,
 *  deduped) + the set of attempted exercise ids. */
async function loadSrsState(
    userId: string | null,
    setId: string,
): Promise<{dueExerciseIds: string[]; seenExerciseIds: Set<string>}> {
    if (!userId) return {dueExerciseIds: [], seenExerciseIds: new Set()};
    const storage = getStorage();
    const dueExerciseIds: string[] = [];
    const dueSeen = new Set<string>();
    try {
        const queue = await storage.elementErrors.reviewQueue(userId, {setId});
        for (const item of queue) {
            if (!dueSeen.has(item.exercise_id)) {
                dueSeen.add(item.exercise_id);
                dueExerciseIds.push(item.exercise_id);
            }
        }
    } catch {
        // No due reviews available — the stream falls back to new + random.
    }
    const seenExerciseIds = new Set<string>();
    try {
        const errors = await storage.elementErrors.list(userId, {setId});
        for (const row of errors) seenExerciseIds.add(row.exercise_id);
    } catch {
        // No history — every exercise counts as new.
    }
    return {dueExerciseIds, seenExerciseIds};
}

/** Fold one answered step into the running stats (pure). */
function nextStats(
    prev: EndlessStats,
    exerciseId: string | null,
    correct: number,
    allCorrect: boolean,
    sets: {
        due: ReadonlySet<string>;
        neu: ReadonlySet<string>;
        seen: ReadonlySet<string>;
        learned: Set<string>;
    },
): EndlessStats {
    const isDue = exerciseId != null && sets.due.has(exerciseId);
    const isNew = exerciseId != null && sets.neu.has(exerciseId);
    const isSeen = exerciseId != null && sets.seen.has(exerciseId);
    let newLearned = prev.newLearned;
    if (isNew && allCorrect && exerciseId && !sets.learned.has(exerciseId)) {
        sets.learned.add(exerciseId);
        newLearned += 1;
    }
    return {
        cards: prev.cards + 1,
        correct: prev.correct + correct,
        reviewsDone: prev.reviewsDone + (isDue ? 1 : 0),
        errorsPracticed: prev.errorsPracticed + (isSeen ? 1 : 0),
        newLearned,
        xp: prev.xp + correct,
    };
}
