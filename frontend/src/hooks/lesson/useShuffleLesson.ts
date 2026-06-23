/**
 * useShuffleLesson — the Zufall-Modus session hook (#1014).
 *
 * Composes:
 *   1. ``contentLoader.listSets()`` to resolve the ``source`` slug for the
 *      requested setId.
 *   2. ``contentLoader.listLessons(source, setId)`` for every lesson filename
 *      in the set.
 *   3. ``contentLoader.getLesson(source, setId, filename)`` for each.
 *   4. ``buildShuffleLesson(sources, opts)`` to pool + Fisher-Yates shuffle +
 *      interleave (no 3+ from one lesson) + cap.
 *
 * Discriminated status (mirrors ``useReviewLesson``):
 *   loading    → fetches in flight
 *   not-cached → setId isn't in any downloaded set
 *   empty      → fewer than two lessons actually contribute exercises
 *   error      → a fetch threw
 *   ready      → a shuffled lesson with >= 1 step
 *
 * Attempts persist through the same ``elementErrors.recordBulk`` path the main
 * viewer + review use — a correct answer grows the card's streak (SRS level-up
 * / longer interval), a wrong one re-increments its error count.
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {readLearnerState} from "../../lib/learning/learnerState";
import {
    buildShuffleLesson,
    type ShuffleSourceLesson,
} from "../../lib/shuffle/shuffle-lesson";
import {notifyReviewsChanged} from "../../lib/review/reviewsChanged";
import {stampHintUsage} from "../../lib/hints/hint-usage";
import {getStorage} from "../../storage";
import type {ContentLesson, ElementAttempt} from "../../storage/types";

export type ShuffleLessonStatus =
    | "loading"
    | "empty"
    | "not-cached"
    | "ready"
    | "error";

export interface UseShuffleLessonOptions {
    setId: string;
    /** Localised title for the synthesised lesson. */
    title: string;
    description?: string | null;
    /** Session length cap. Default 20 (the builder's default). */
    limit?: number;
}

export interface UseShuffleLessonResult {
    status: ShuffleLessonStatus;
    lesson: ContentLesson | null;
    currentStepIndex: number;
    /** Distinct source lessons the synthesised steps draw from. */
    sourceLessonCount: number;
    error: string | null;
    goNext: () => void;
    goPrev: () => void;
    recordStepAttempts: (
        attempts: readonly ElementAttempt[],
    ) => Promise<void>;
    sessionScoreCorrect: number;
    sessionScoreTotal: number;
    /** Re-shuffle + restart the session in place. */
    reload: () => void;
}

/** A lesson contributes to the shuffle only if it has >= 1 exercise step. */
function hasExercise(lesson: ContentLesson): boolean {
    return lesson.steps.some((s) => s.type === "exercise" && s.exercise != null);
}

export function useShuffleLesson(
    opts: UseShuffleLessonOptions,
): UseShuffleLessonResult {
    const {setId, title, description, limit} = opts;
    const [status, setStatus] = useState<ShuffleLessonStatus>("loading");
    const [lesson, setLesson] = useState<ContentLesson | null>(null);
    const [sourceLessonCount, setSourceLessonCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [sessionScoreCorrect, setSessionScoreCorrect] = useState(0);
    const [sessionScoreTotal, setSessionScoreTotal] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);

    const userId = useMemo(() => readLearnerState().userId, []);

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

                const sources: ShuffleSourceLesson[] = [];
                for (const filename of list.lessons) {
                    if (cancelled) return;
                    try {
                        const fetched = await storage.contentLoader.getLesson(
                            match.source,
                            setId,
                            filename,
                        );
                        if (hasExercise(fetched)) {
                            sources.push({
                                lessonId: filename,
                                title: fetched.title,
                                lesson: fetched,
                            });
                        }
                    } catch {
                        // Skip lessons we can't fetch (evicted from cache).
                    }
                }
                if (cancelled) return;

                // Shuffle mode needs >= 2 lessons with exercises to interleave.
                if (sources.length < 2) {
                    setStatus("empty");
                    return;
                }

                const built = buildShuffleLesson(sources, {
                    title,
                    description,
                    limit,
                });
                if (built.steps.length === 0) {
                    setStatus("empty");
                    return;
                }
                setLesson(built);
                setSourceLessonCount(sources.length);
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
    }, [setId, title, description, limit, reloadKey]);

    const reload = useCallback(() => {
        setCurrentStepIndex(0);
        setSessionScoreCorrect(0);
        setSessionScoreTotal(0);
        setLesson(null);
        setStatus("loading");
        setReloadKey((k) => k + 1);
    }, []);

    const totalSteps = lesson?.steps.length ?? 0;

    const goNext = useCallback(() => {
        setCurrentStepIndex((idx) => Math.min(idx + 1, totalSteps));
    }, [totalSteps]);

    const goPrev = useCallback(() => {
        setCurrentStepIndex((idx) => Math.max(idx - 1, 0));
    }, []);

    const recordStepAttempts = useCallback(
        async (attempts: readonly ElementAttempt[]) => {
            if (attempts.length === 0 || !userId) return;
            const correct = attempts.filter((a) => a.correct).length;
            setSessionScoreCorrect((n) => n + correct);
            setSessionScoreTotal((n) => n + attempts.length);
            try {
                await getStorage().elementErrors.recordBulk(
                    userId,
                    stampHintUsage(attempts),
                );
                // A correct/incorrect answer moved the element's SRS schedule;
                // refresh the header due badge live.
                notifyReviewsChanged();
            } catch {
                // Failure-tolerant: a recording failure must not crash the
                // session — the per-step score stays the user's feedback.
            }
        },
        [userId],
    );

    return {
        status,
        lesson,
        currentStepIndex,
        sourceLessonCount,
        error,
        goNext,
        goPrev,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
        reload,
    };
}
