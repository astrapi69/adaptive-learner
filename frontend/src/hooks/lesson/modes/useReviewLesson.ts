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

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {readLearnerState} from "../../../lib/learning/learnerState";
import {
    dedupeReviewQueueByElement,
    synthesizeReviewLesson,
} from "../../../lib/review/review-lesson";
import {loadReviewQueue} from "../../../lib/review/review-queue";
import {notifyReviewsChanged} from "../../../lib/review/reviewsChanged";
import {clearHintUsage, stampHintUsage} from "../../../lib/hints/hint-usage";
import {getStorage} from "../../../storage";
import type {
    ContentLesson,
    ContentLessonStep,
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
     *  passes the i18n string. Read once per fetch (a ref, not a
     *  dependency, see the effect below) so a translation catalog
     *  landing after first paint can never restart the session. */
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
    /** #664 — total UNIQUE elements due for review in this round (deduped
     *  by ``element_key``, uncapped; #3170: minus the elements already
     *  played earlier in this session). The session presents at most
     *  ``limit`` questions covering these; the page shows "{covered} of
     *  {dueCount}" so the cap is transparent. */
    dueCount: number;
    error: string | null;
    goNext: () => void;
    goPrev: () => void;
    goToStep: (index: number) => void;
    /** Persist a step's element attempts. The hook does NOT
     *  track per-step scores in LessonProgress (review
     *  sessions are ephemeral — only ElementError rows are
     *  affected). #3170: pass the completed ``step`` so the elements it
     *  covers (a collapsed matching question covers several, #664) count
     *  as played even when the recorder reports fewer keys. */
    recordStepAttempts: (
        attempts: readonly ElementAttempt[],
        step?: ContentLessonStep,
    ) => Promise<void>;
    /** Tally for the summary screen, per ELEMENT (#3170): distinct
     *  element keys recorded this round, and how many of them ended
     *  correct (a later attempt on the same element wins). Same basis as
     *  the subtitle's element count. */
    sessionScoreCorrect: number;
    sessionScoreTotal: number;
    /** #3170 — elements of this round's queue not yet played. Drives the
     *  "Noch {n} fällig. Weitermachen?" offer; 0 once every due element
     *  was played, so a round cannot loop on a dedupe rest. */
    remaining: number;
    /** #718 — re-fetch the due queue and start a fresh round in place:
     *  resets the step index + round tallies and rebuilds the synthesised
     *  lesson from whatever is still due AND not yet played this session
     *  (#3170), so "Weitere Runde" walks the rest and then ends. */
    reload: () => void;
}

/** Element keys a completed step counts as played: the recorded attempts
 *  plus every queue element the step covers (#3170). */
function playedKeysOf(
    attempts: readonly ElementAttempt[],
    step: ContentLessonStep | undefined,
): string[] {
    const keys = attempts.map((a) => a.element_key);
    for (const key of step?.review_element_keys ?? []) keys.push(key);
    return keys;
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
    // #3170 — element keys played in THIS SESSION (across rounds). The ref
    // is the source of truth the fetch effect reads; the state mirror
    // re-renders ``remaining``. The tally map is per round (reset by
    // ``reload``) and keyed by element, so a matching question that fans
    // out three attempts scores three elements, and a retried element
    // scores once (last outcome wins).
    const playedRef = useRef<Set<string>>(new Set());
    const [played, setPlayed] = useState<ReadonlySet<string>>(() => new Set());
    const tallyRef = useRef<Map<string, boolean>>(new Map());

    const userId = useMemo(() => readLearnerState().userId, []);

    // #2703 — ``title``/``description`` are DISPLAY-ONLY strings (they end
    // up on ``lesson.title``/``.description``, never in a fetch parameter).
    // ``title`` in particular comes from ``t("review.session_title", ...)``:
    // on first paint (before the async i18n catalog resolves) it's the
    // caller-supplied English fallback; once the catalog lands it flips to
    // the translated string. Depending on that value in the fetch effect
    // meant the catalog landing mid-session tore down an already-ready
    // review session (back to "loading", then re-querying the SRS queue) —
    // the #1540-class coin flip this time hitting AFTER first paint, which
    // is how a review-session visual baseline could show the ready state and
    // then collapse to the empty state before the screenshot fired. Latest
    // values live in refs so the effect always uses fresh text without
    // treating a text-only change as a reason to refetch.
    const titleRef = useRef(title);
    titleRef.current = title;
    const descriptionRef = useRef(description);
    descriptionRef.current = description;

    useEffect(() => {
        if (!setId || !userId) {
            setStatus("empty");
            return;
        }
        let cancelled = false;
        setStatus("loading");
        // #3196 — hint usage is per run: forget the previous run's reveals.
        clearHintUsage();
        setError(null);
        void (async () => {
            try {
                const storage = getStorage();
                // #629 BUG 2 — fetch the FULL due list (no storage-level
                // limit), de-dup by element, THEN cap. Capping at the
                // storage layer first could fill the cap with repeats of
                // one word, leaving the session short on unique elements.
                // #3170 — ``loadReviewQueue`` applies the "also review
                // error-free elements" toggle (errors only by default).
                const fetchedQueue = await loadReviewQueue(userId, {setId});
                if (cancelled) return;
                // #664 — de-dup by element_key but do NOT cap here. The cap is
                // applied AFTER the synthesizer collapses duplicate questions
                // (a matching/picture_choice exercise covering several due
                // cards is one question, not N), so capping the queue first
                // would leave the session short on unique questions.
                // #3170 — a further round presents only what this session
                // has not played yet; a played element is rescheduled by
                // its recording, not re-served because it is still in the
                // (uncapped, non-overdue-filtered) queue.
                const dedupedQueue = dedupeReviewQueueByElement(
                    fetchedQueue,
                ).filter((item) => !playedRef.current.has(item.element_key));
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
                    {title: titleRef.current, description: descriptionRef.current, limit},
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
        // title/description intentionally excluded — see the refs above;
        // they are read via titleRef/descriptionRef, not as dependencies,
        // so a display-only text change never retriggers the SRS fetch.
    }, [setId, userId, limit, reloadKey]);

    const reload = useCallback(() => {
        setCurrentStepIndex(0);
        // #3170 — the tally is per round; the played set is per session.
        tallyRef.current = new Map();
        setSessionScoreCorrect(0);
        setSessionScoreTotal(0);
        setLesson(null);
        setStatus("loading");
        setReloadKey((k) => k + 1);
    }, []);

    // #3170 — elements of this round's queue not yet played.
    const remaining = useMemo(
        () => queue.filter((item) => !played.has(item.element_key)).length,
        [queue, played],
    );

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
        async (attempts: readonly ElementAttempt[], step?: ContentLessonStep) => {
            if (attempts.length === 0 || !userId) return;
            // #3170 — mark the elements played BEFORE the storage call, so a
            // failed write still ends the round instead of re-serving them.
            const next = new Set(playedRef.current);
            for (const key of playedKeysOf(attempts, step)) next.add(key);
            playedRef.current = next;
            setPlayed(next);
            // Tally per element for the session summary: a matching
            // question fans out one attempt per pair (several elements), a
            // retried element counts once.
            for (const a of attempts) tallyRef.current.set(a.element_key, a.correct);
            let correct = 0;
            for (const ok of tallyRef.current.values()) if (ok) correct += 1;
            setSessionScoreCorrect(correct);
            setSessionScoreTotal(tallyRef.current.size);
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
        remaining,
        reload,
    };
}
