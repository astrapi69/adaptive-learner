/**
 * useAdaptiveLesson — adaptive-lesson session hook
 * (Phase 53G / v1.36.0 / EXP-013 / P-137).
 *
 * Mirrors the structure of ``useReviewLesson`` but the
 * synthesis pipeline is different:
 *
 *   1. ``elementErrors.list(userId, {setId, includeMastered:
 *      true})`` → every active + mastered ElementError row
 *      for the requested setId (mastered are read so the
 *      transparency display can show "X mastered" alongside
 *      "Y active").
 *   2. ``analyzeErrors(errors)`` (53A) → ErrorAnalysis with
 *      prioritized + clusters + weakness_profile + suggested.
 *   3. ``contentLoader.listSets()`` → source slug lookup.
 *   4. ``contentLoader.listLessons(source, setId)`` +
 *      ``getLesson`` per lesson → cached lesson map.
 *   5. ``buildExercisePool(targetElements, {lessons,
 *      errorsByElementKey})`` (53B) → candidate pool with
 *      generated cloze augmentation.
 *   6. ``generateAdaptiveLesson(analysis, pool, opts)`` (53C
 *      + 53D variation) → synthetic ContentLesson.
 *
 * Status discriminant:
 *   loading   → fetches in flight
 *   empty     → no active errors for this setId
 *   not-cached → setId isn't in the user's downloaded sets
 *   ready     → lesson synthesised; render via the standard
 *               ExerciseDispatcher
 *   error     → fetch threw
 *
 * Like useReviewLesson, attempts persist via the same
 * recordBulk path the main viewer uses — adaptive sessions
 * also feed the error/mastery loop.
 *
 * Dexie-mode-friendly: every storage call routes through
 * getStorage() so the GH-Pages build works fully client-side
 * (no backend roundtrip). The 53H smoke gate pins this.
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {analyzeErrors} from "../lib/adaptive/error-analyzer";
import {buildExercisePool} from "../lib/adaptive/exercise-pool";
import {focusAreaTags} from "../lib/adaptive/error-classifier";
import {generateAdaptiveLesson} from "../lib/adaptive/lesson-generator";
import type {ErrorTag} from "../lib/adaptive/error-classifier";
import type {ErrorAnalysis} from "../lib/adaptive/types";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import type {
    ContentLesson,
    ElementAttempt,
    ElementError,
} from "../storage/types";

export type AdaptiveLessonStatus =
    | "loading"
    | "empty"
    | "not-cached"
    | "ready"
    | "error";

export interface UseAdaptiveLessonOptions {
    setId: string;
    /** Localised title — caller passes the i18n string. */
    title: string;
    description?: string | null;
    /** Cap on emitted exercises. Default 10 (matches the
     *  generator's default). */
    limit?: number;
}

export interface AdaptiveTransparency {
    /** What the lesson is targeting in terms a learner can
     *  read: the focus_area tags from the classifier, sorted. */
    tags: ErrorTag[];
    /** Sum of active error_count contributing to this
     *  generation. */
    total_errors: number;
    /** Active (non-mastered) element count this generation
     *  targets. */
    active_elements: number;
    /** Mastered element count for this setId — used by the
     *  post-lesson improvement indicator (F-116). */
    mastered_before: number;
}

export interface UseAdaptiveLessonResult {
    status: AdaptiveLessonStatus;
    lesson: ContentLesson | null;
    analysis: ErrorAnalysis | null;
    transparency: AdaptiveTransparency | null;
    currentStepIndex: number;
    error: string | null;
    goNext: () => void;
    goPrev: () => void;
    goToStep: (index: number) => void;
    recordStepAttempts: (
        attempts: readonly ElementAttempt[],
    ) => Promise<void>;
    sessionScoreCorrect: number;
    sessionScoreTotal: number;
    /** Post-session mastery delta — populated when the user
     *  reaches the summary screen. Computed by counting
     *  elements that flipped to mastered DURING the session
     *  via the cached "mastered_before" snapshot. */
    masteredDelta: number | null;
    finalize: () => Promise<void>;
}

const MAX_LESSONS_TO_FETCH = 30;

export function useAdaptiveLesson(
    opts: UseAdaptiveLessonOptions,
): UseAdaptiveLessonResult {
    const {setId, title, description, limit} = opts;
    const [status, setStatus] = useState<AdaptiveLessonStatus>("loading");
    const [lesson, setLesson] = useState<ContentLesson | null>(null);
    const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
    const [transparency, setTransparency] =
        useState<AdaptiveTransparency | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [sessionScoreCorrect, setSessionScoreCorrect] = useState(0);
    const [sessionScoreTotal, setSessionScoreTotal] = useState(0);
    const [masteredDelta, setMasteredDelta] = useState<number | null>(null);

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
                const errors = await storage.elementErrors.list(userId, {
                    setId,
                    includeMastered: true,
                });
                if (cancelled) return;
                const active = errors.filter((e) => !e.mastered);
                const masteredBefore = errors.length - active.length;
                if (active.length === 0) {
                    setStatus("empty");
                    return;
                }
                const result = analyzeErrors(errors);
                setAnalysis(result);

                const sets = await storage.contentLoader.listSets();
                if (cancelled) return;
                const match = sets.sets.find((s) => s.id === setId);
                if (!match) {
                    setStatus("not-cached");
                    return;
                }

                // Fetch every lesson the active errors reference.
                // We pull ALL referenced lessons (not just the
                // top-N) so the pool builder has the widest pool
                // of alternative exercises to pick from.
                const lessonIds = Array.from(
                    new Set(active.map((e) => e.lesson_id)),
                ).slice(0, MAX_LESSONS_TO_FETCH);
                const lessonMap = new Map<string, ContentLesson>();
                for (const lessonId of lessonIds) {
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
                        // Lessons may have been evicted from the
                        // cache; skip silently — the pool builder
                        // tolerates missing lessons.
                    }
                }
                if (cancelled) return;

                const errorsByElementKey = new Map<string, ElementError>();
                for (const err of active) {
                    // Latest-wins (last_attempt_at desc would be
                    // semantically more correct, but the analyzer
                    // sort already gives us priority order; we
                    // just need one error per element_key for the
                    // pool/generator).
                    errorsByElementKey.set(err.element_key, err);
                }
                const pool = buildExercisePool(
                    result.prioritized_elements,
                    {lessons: lessonMap, errorsByElementKey},
                );
                const generated = generateAdaptiveLesson(result, pool, {
                    lessons: lessonMap,
                    title,
                    description: description ?? undefined,
                    set_id: setId,
                    now: new Date().toISOString(),
                    errorsByElementKey,
                    config: limit ? {max_exercises: limit} : undefined,
                });

                if (generated.steps.length === 0) {
                    // No candidate exercises found for the target
                    // elements (e.g. lessons evicted from cache).
                    setStatus("empty");
                    return;
                }

                setLesson(generated);
                setTransparency({
                    tags: focusAreaTags(
                        result.suggested_focus,
                        errors,
                        {lessons: lessonMap},
                    ),
                    total_errors: result.total_errors,
                    active_elements: result.active_elements,
                    mastered_before: masteredBefore,
                });
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
            const correct = attempts.filter((a) => a.correct).length;
            setSessionScoreCorrect((n) => n + correct);
            setSessionScoreTotal((n) => n + attempts.length);
            try {
                await getStorage().elementErrors.recordBulk(
                    userId,
                    attempts,
                );
            } catch {
                // Same failure-tolerance as the review session.
            }
        },
        [userId],
    );

    /** Recompute mastered count after the session ends to
     *  produce the F-116 improvement indicator. The Dashboard's
     *  ReviewQueueCard already does the right thing on its own
     *  remount; this hook surfaces the per-session delta so the
     *  summary screen can say "+2 mastered this session". */
    const finalize = useCallback(async () => {
        if (!userId || !setId) return;
        if (!transparency) return;
        try {
            const refreshed = await getStorage().elementErrors.list(userId, {
                setId,
                includeMastered: true,
            });
            const masteredAfter = refreshed.filter((e) => e.mastered).length;
            setMasteredDelta(masteredAfter - transparency.mastered_before);
        } catch {
            // Non-fatal — the summary just won't show the delta.
        }
    }, [userId, setId, transparency]);

    return {
        status,
        lesson,
        analysis,
        transparency,
        currentStepIndex,
        error,
        goNext,
        goPrev,
        goToStep,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
        masteredDelta,
        finalize,
    };
}
