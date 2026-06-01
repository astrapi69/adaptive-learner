/**
 * useLesson — lesson loader + progress hook
 * (Phase 44 / EXP-002 / P-107 + P-109).
 *
 * Combines three concerns the viewer (commit 3) shouldn't
 * duplicate:
 *
 * 1. Fetch the lesson via ``getStorage().contentLoader.getLesson``.
 *    A 404 (lesson not cached / set never downloaded) surfaces
 *    as ``status === "not-cached"`` so the viewer renders a
 *    friendly "please download this set first" notice with a
 *    deep-link to /content.
 *
 * 2. Load any existing ``LessonProgress`` for the active
 *    learner. Missing progress is fine — the viewer simply
 *    starts the user at step 0.
 *
 * 3. Track the current step index locally and expose
 *    imperative helpers (``goNext`` / ``goPrev`` /
 *    ``recordStepResult`` / ``markCompleted``). Step results
 *    persist to the storage namespace via debounced upsert so
 *    the user can resume an in-progress lesson on the next
 *    visit.
 *
 * The hook returns a discriminated union so the consumer can
 * render the right state without crashing on missing data.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {readLearnerState} from "../lib/learnerState";
import {ApiError} from "../api/client";
import {getStorage} from "../storage";
import type {
    ContentLesson,
    LessonProgress,
    LessonStepResult,
} from "../storage/types";

export type LessonLoadStatus =
    | "loading"
    | "not-cached"
    | "ready"
    | "error";

export interface UseLessonOptions {
    source: string;
    setId: string;
    lessonFilename: string;
}

export interface UseLessonResult {
    status: LessonLoadStatus;
    lesson: ContentLesson | null;
    progress: LessonProgress | null;
    currentStepIndex: number;
    error: string | null;
    /** Move to the next step. No-op past the last step. */
    goNext: () => void;
    /** Move to the previous step. No-op before step 0. */
    goPrev: () => void;
    /** Jump to a specific step index. Clamps to the valid range. */
    goToStep: (index: number) => void;
    /** Jump to a step by id (used by the anchor click handler). */
    goToStepById: (stepId: string) => void;
    /** Persist a step's result + recompute the aggregate score. */
    recordStepResult: (result: LessonStepResult) => Promise<void>;
    /** Flip status to completed (lesson-summary screen). */
    markCompleted: () => Promise<void>;
    /** Phase 63A — pause the attempt; step_results stay intact
     *  for the resume. Toast + navigate are the caller's job. */
    markPaused: () => Promise<void>;
    /** Phase 63A — abandon the attempt; step_results are
     *  cleared. ElementErrors stay (what was learned stays
     *  learned). */
    markAbandoned: () => Promise<void>;
    /** Phase 63C — flip a paused row back to in_progress so
     *  the viewer can replay from the saved step_results. */
    markResumed: () => Promise<void>;
    /** Force-reload the lesson + progress (Set Browser
     *  navigated here mid-download). */
    refresh: () => void;
}

export function useLesson(opts: UseLessonOptions): UseLessonResult {
    const {source, setId, lessonFilename} = opts;
    const [status, setStatus] = useState<LessonLoadStatus>("loading");
    const [lesson, setLesson] = useState<ContentLesson | null>(null);
    const [progress, setProgress] = useState<LessonProgress | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);

    const userId = useMemo(() => readLearnerState().userId, []);

    // Track the time spent on each step + the lesson as a
    // whole. The viewer uses this for the summary screen.
    const stepEntryTimeRef = useRef<number>(performance.now());

    const fetchInitial = useCallback(async () => {
        setStatus("loading");
        setError(null);
        let loadedLesson: ContentLesson | null = null;
        try {
            loadedLesson = await getStorage().contentLoader.getLesson(
                source,
                setId,
                lessonFilename,
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setStatus("not-cached");
                return;
            }
            if (
                err instanceof Error &&
                /not found|not cached/i.test(err.message)
            ) {
                setStatus("not-cached");
                return;
            }
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
            return;
        }
        setLesson(loadedLesson);

        // Existing progress (or null on first visit).
        let loadedProgress: LessonProgress | null = null;
        if (userId) {
            try {
                loadedProgress = await getStorage().lessonProgress.get(
                    userId,
                    source,
                    setId,
                    lessonFilename,
                );
            } catch {
                // Progress is non-fatal — start fresh.
                loadedProgress = null;
            }
        }
        setProgress(loadedProgress);
        // Resume on the LAST completed step + 1, capped at the
        // lesson length. If the user has finished, drop them
        // at the summary (one past the last step).
        if (loadedProgress) {
            const completed = Object.keys(loadedProgress.step_results);
            // Find the highest step index that has a stored
            // result; resume on the next one.
            let nextIndex = 0;
            for (let i = 0; i < loadedLesson.steps.length; i++) {
                if (completed.includes(loadedLesson.steps[i].id)) {
                    nextIndex = i + 1;
                }
            }
            if (loadedProgress.status === "completed") {
                nextIndex = loadedLesson.steps.length;  // summary view
            }
            setCurrentStepIndex(
                Math.min(nextIndex, loadedLesson.steps.length),
            );
        } else {
            setCurrentStepIndex(0);
        }
        stepEntryTimeRef.current = performance.now();
        setStatus("ready");
    }, [source, setId, lessonFilename, userId]);

    useEffect(() => {
        void fetchInitial();
    }, [fetchInitial, refreshTick]);

    const refresh = useCallback(() => {
        setRefreshTick((t) => t + 1);
    }, []);

    const goToStep = useCallback(
        (index: number) => {
            if (lesson === null) return;
            const clamped = Math.max(
                0,
                Math.min(index, lesson.steps.length),  // length = summary index
            );
            setCurrentStepIndex(clamped);
            stepEntryTimeRef.current = performance.now();
        },
        [lesson],
    );

    const goNext = useCallback(() => {
        if (lesson === null) return;
        setCurrentStepIndex((idx) =>
            Math.min(idx + 1, lesson.steps.length),
        );
        stepEntryTimeRef.current = performance.now();
    }, [lesson]);

    const goPrev = useCallback(() => {
        setCurrentStepIndex((idx) => Math.max(0, idx - 1));
        stepEntryTimeRef.current = performance.now();
    }, []);

    const goToStepById = useCallback(
        (stepId: string) => {
            if (lesson === null) return;
            const target = lesson.steps.findIndex((s) => s.id === stepId);
            if (target >= 0) goToStep(target);
        },
        [lesson, goToStep],
    );

    const _consumeStepTime = useCallback((): number => {
        const now = performance.now();
        const elapsedMs = now - stepEntryTimeRef.current;
        stepEntryTimeRef.current = now;
        return Math.max(0, Math.round(elapsedMs / 1000));
    }, []);

    const recordStepResult = useCallback(
        async (result: LessonStepResult) => {
            if (!userId || lesson === null) return;
            const timeDelta = _consumeStepTime();
            try {
                const updated =
                    await getStorage().lessonProgress.upsert(userId, {
                        source,
                        set_id: setId,
                        lesson_filename: lessonFilename,
                        step_result: result,
                        time_spent_seconds_delta: timeDelta,
                    });
                setProgress(updated);
            } catch (err) {
                // Persistence failures are non-fatal — the
                // viewer keeps working with in-memory state;
                // the user can retry on the next step.
                setError(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
        [
            userId,
            source,
            setId,
            lessonFilename,
            lesson,
            _consumeStepTime,
        ],
    );

    const markCompleted = useCallback(async () => {
        if (!userId || lesson === null) return;
        const timeDelta = _consumeStepTime();
        try {
            const updated = await getStorage().lessonProgress.upsert(
                userId,
                {
                    source,
                    set_id: setId,
                    lesson_filename: lessonFilename,
                    time_spent_seconds_delta: timeDelta,
                    mark_completed: true,
                },
            );
            setProgress(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [
        userId,
        source,
        setId,
        lessonFilename,
        lesson,
        _consumeStepTime,
    ]);

    // Phase 63A — shared transition writer for pause / abandon /
    // resume. Each just sets one flag; the backend service + Dexie
    // mirror enforce the same one-flag-per-call rule and the
    // correct status / timestamp / step_results invariants.
    const _markLifecycle = useCallback(
        async (
            flag: "mark_paused" | "mark_abandoned" | "mark_resumed",
        ) => {
            if (!userId || lesson === null) return;
            const timeDelta = _consumeStepTime();
            try {
                const updated =
                    await getStorage().lessonProgress.upsert(userId, {
                        source,
                        set_id: setId,
                        lesson_filename: lessonFilename,
                        time_spent_seconds_delta: timeDelta,
                        [flag]: true,
                    });
                setProgress(updated);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
        [
            userId,
            source,
            setId,
            lessonFilename,
            lesson,
            _consumeStepTime,
        ],
    );

    const markPaused = useCallback(
        () => _markLifecycle("mark_paused"),
        [_markLifecycle],
    );
    const markAbandoned = useCallback(
        () => _markLifecycle("mark_abandoned"),
        [_markLifecycle],
    );
    const markResumed = useCallback(
        () => _markLifecycle("mark_resumed"),
        [_markLifecycle],
    );

    return {
        status,
        lesson,
        progress,
        currentStepIndex,
        error,
        goNext,
        goPrev,
        goToStep,
        goToStepById,
        recordStepResult,
        markCompleted,
        markPaused,
        markAbandoned,
        markResumed,
        refresh,
    };
}
