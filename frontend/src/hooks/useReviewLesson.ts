/**
 * useReviewLesson — SRS review-session hook
 * (Phase 46D / C15 / P-129).
 *
 * Composes:
 *   1. ``elementErrors.reviewQueue(userId, {setId})`` to
 *      get the prioritised queue of due elements.
 *   2. ``contentLoader.listSets()`` to resolve the
 *      ``source`` slug for the requested setId (the queue
 *      stores set_id but not source).
 *   3. ``contentLoader.getLesson(source, setId, filename)``
 *      for each unique ``lesson_id`` the queue references.
 *   4. ``synthesizeReviewLesson(queue, lessons, opts)`` to
 *      build the in-memory review ContentLesson.
 *
 * Returns a discriminated-union status so consumers
 * (ReviewPage) render the right state without crashing on
 * missing data:
 *
 *   loading  → fetches in flight
 *   empty    → queue resolved but no elements due (success
 *              state: "all caught up!")
 *   not-cached → setId isn't in any downloaded set; user
 *                must download from /content first
 *   error    → fetch threw (network down, etc.)
 *   ready    → lesson synthesised + currentStepIndex valid
 *
 * Element attempts persist via the same
 * ``elementErrors.recordBulk`` path the main viewer uses —
 * a wrong answer during review re-increments error_count
 * + last_error_at; a correct answer grows correct_streak +
 * eventually flips mastered. No separate "review attempt"
 * concept.
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {readLearnerState} from "../lib/learnerState";
import {synthesizeReviewLesson} from "../lib/review-lesson";
import {stampHintUsage} from "../lib/hints/hint-usage";
import {getStorage} from "../storage";
import type {
    ContentLesson,
    ElementAttempt,
    ReviewQueueItem,
} from "../storage/types";

export type ReviewLessonStatus =
    | "loading"
    | "empty"
    | "not-cached"
    | "ready"
    | "error";

export interface UseReviewLessonOptions {
    setId: string;
    /** Localised title for the synthesised lesson — caller
     *  passes the i18n string. */
    title: string;
    description?: string | null;
    /** Cap; default 10 (matches DEFAULT_REVIEW_LIMIT). */
    limit?: number;
}

export interface UseReviewLessonResult {
    status: ReviewLessonStatus;
    lesson: ContentLesson | null;
    queue: ReviewQueueItem[];
    /** How many elements in this synthesised review are
     *  mastered as the session ends. Computed by counting
     *  queue items whose correct_streak BEFORE the session
     *  was 2 (one correct away from mastery) and where the
     *  user got the matching exercise right. v1 surfaces
     *  the simpler "session_correct of session_total" via
     *  per-step scoring; the mastered-this-session count is
     *  reserved for the C16 review-mode summary. */
    currentStepIndex: number;
    error: string | null;
    goNext: () => void;
    goPrev: () => void;
    goToStep: (index: number) => void;
    /** Persist a step's element attempts. The hook does NOT
     *  track per-step scores in LessonProgress (review
     *  sessions are ephemeral — only ElementError rows are
     *  affected). */
    recordStepAttempts: (
        attempts: readonly ElementAttempt[],
    ) => Promise<void>;
    /** Tally for the summary screen — incremented when
     *  recordStepAttempts gets a non-empty payload. */
    sessionScoreCorrect: number;
    sessionScoreTotal: number;
}

export function useReviewLesson(
    opts: UseReviewLessonOptions,
): UseReviewLessonResult {
    const {setId, title, description, limit} = opts;
    const [status, setStatus] = useState<ReviewLessonStatus>("loading");
    const [lesson, setLesson] = useState<ContentLesson | null>(null);
    const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [sessionScoreCorrect, setSessionScoreCorrect] = useState(0);
    const [sessionScoreTotal, setSessionScoreTotal] = useState(0);

    const userId = useMemo(() => readLearnerState().userId, []);

    useEffect(() => {
        if (!setId || !userId) {
            setStatus("empty");
            return;
        }
        let cancelled = false;
        setStatus("loading");
        setError(null);
        void (async () => {
            try {
                const storage = getStorage();
                const fetchedQueue = await storage.elementErrors.reviewQueue(
                    userId,
                    {setId},
                );
                if (cancelled) return;
                setQueue(fetchedQueue);

                if (fetchedQueue.length === 0) {
                    setStatus("empty");
                    return;
                }

                // Resolve source from the user's downloaded
                // sets that contain this setId.
                const sets = await storage.contentLoader.listSets();
                if (cancelled) return;
                const match = sets.sets.find((s) => s.id === setId);
                if (!match) {
                    setStatus("not-cached");
                    return;
                }

                // Fetch each unique source lesson the queue
                // references. Sequential to keep the fetch
                // pattern predictable + cache-friendly.
                const uniqueLessons = Array.from(
                    new Set(fetchedQueue.map((q) => q.lesson_id)),
                );
                const lessonMap = new Map<string, ContentLesson>();
                for (const lessonId of uniqueLessons) {
                    if (cancelled) return;
                    try {
                        const fetched =
                            await storage.contentLoader.getLesson(
                                match.source,
                                setId,
                                lessonId,
                            );
                        lessonMap.set(lessonId, fetched);
                    } catch {
                        // Skip lessons we can't fetch — the
                        // synthesizer drops items whose source
                        // exercise is missing.
                    }
                }
                if (cancelled) return;
                const synthesised = synthesizeReviewLesson(
                    fetchedQueue,
                    lessonMap,
                    {title, description, limit},
                );
                if (synthesised.steps.length === 0) {
                    // Every queued lesson was evicted from
                    // cache — treat as empty session.
                    setStatus("empty");
                    return;
                }
                setLesson(synthesised);
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
    }, [setId, userId, title, description, limit]);

    const totalSteps = lesson?.steps.length ?? 0;

    const goNext = useCallback(() => {
        setCurrentStepIndex((idx) => Math.min(idx + 1, totalSteps));
    }, [totalSteps]);

    const goPrev = useCallback(() => {
        setCurrentStepIndex((idx) => Math.max(idx - 1, 0));
    }, []);

    const goToStep = useCallback(
        (index: number) => {
            setCurrentStepIndex(
                Math.max(0, Math.min(index, totalSteps)),
            );
        },
        [totalSteps],
    );

    const recordStepAttempts = useCallback(
        async (attempts: readonly ElementAttempt[]) => {
            if (attempts.length === 0 || !userId) return;
            // Tally for the session summary (correct items
            // beat attempts since matching produces multiple
            // attempts per submit).
            const correct = attempts.filter((a) => a.correct).length;
            setSessionScoreCorrect((n) => n + correct);
            setSessionScoreTotal((n) => n + attempts.length);
            try {
                await getStorage().elementErrors.recordBulk(
                    userId,
                    stampHintUsage(attempts),
                );
            } catch {
                // Same failure-tolerance as the main viewer —
                // a recording failure must not crash the
                // session. Per-step score is the user's
                // primary feedback.
            }
        },
        [userId],
    );

    return {
        status,
        lesson,
        queue,
        currentStepIndex,
        error,
        goNext,
        goPrev,
        goToStep,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
    };
}
