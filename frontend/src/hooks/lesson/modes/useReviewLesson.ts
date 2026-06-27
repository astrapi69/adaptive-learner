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

import {readLearnerState} from "../../../lib/learning/learnerState";
import {
    dedupeReviewQueueByElement,
    synthesizeReviewLesson,
} from "../../../lib/review/review-lesson";
import {notifyReviewsChanged} from "../../../lib/review/reviewsChanged";
import {stampHintUsage} from "../../../lib/hints/hint-usage";
import {getStorage} from "../../../storage";
import type {
    ContentLesson,
    ElementAttempt,
    ReviewQueueItem,
} from "../../../storage/types";

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
    /** #664 — total UNIQUE elements due for review in this set (deduped by
     *  ``element_key``, uncapped). The session presents at most ``limit`` of
     *  these; the page shows "{presented} of {dueCount}" so the cap is
     *  transparent. ``lesson.steps.length`` is the presented count. */
    dueCount: number;
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
    /** #718 — re-fetch the (now smaller) due queue and start a fresh round
     *  in place: resets the step index + session tallies and rebuilds the
     *  synthesised lesson from whatever is still due. */
    reload: () => void;
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
    const [dueCount, setDueCount] = useState(0);
    const [sessionScoreCorrect, setSessionScoreCorrect] = useState(0);
    const [sessionScoreTotal, setSessionScoreTotal] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);

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
                // #629 BUG 2 — fetch the FULL due list (no storage-level
                // limit), de-dup by element, THEN cap. Capping at the
                // storage layer first could fill the cap with repeats of
                // one word, leaving the session short on unique elements.
                const fetchedQueue = await storage.elementErrors.reviewQueue(
                    userId,
                    {setId},
                );
                if (cancelled) return;
                // #664 — de-dup by element_key but do NOT cap here. The cap is
                // applied AFTER the synthesizer collapses duplicate questions
                // (a matching/picture_choice exercise covering several due
                // cards is one question, not N), so capping the queue first
                // would leave the session short on unique questions.
                const dedupedQueue = dedupeReviewQueueByElement(fetchedQueue);
                setQueue(dedupedQueue);
                setDueCount(dedupedQueue.length);

                if (dedupedQueue.length === 0) {
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
                    new Set(dedupedQueue.map((q) => q.lesson_id)),
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
                    dedupedQueue,
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
    }, [setId, userId, title, description, limit, reloadKey]);

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
                // #629 BUG 3c — the element's suggested-review time just
                // moved; tell the header badge to recompute the due count
                // live instead of staying stale until a route change.
                notifyReviewsChanged();
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
        dueCount,
        error,
        goNext,
        goPrev,
        goToStep,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
        reload,
    };
}
