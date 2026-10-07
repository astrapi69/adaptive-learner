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

import {readLearnerState} from "../../../lib/learning/learnerState";
import {notifyLessonProgressChanged} from "../../../lib/lesson/progress/progress-change-event";
import {resumeStepIndex} from "../../../lib/lesson/progress/resume-step";
import {ApiError} from "../../../api/client";
import {notify} from "../../../utils/notify";
import {useI18n} from "../../ui/useI18n";
import {getStorage} from "../../../storage";
import type {
    ContentLesson,
    LessonProgress,
    LessonProgressUpsertBody,
    LessonStepEvent,
    LessonStepResult,
} from "../../../storage/types";

export type LessonLoadStatus =
    | "loading"
    | "not-cached"
    | "ready"
    | "error";

export interface UseLessonOptions {
    source: string;
    setId: string;
    lessonFilename: string;
    /** #1007 Phase 2 — the lesson mode the run is played in. Sent on
     *  every progress upsert so the attempt records the mode (the
     *  server-side XP award + SRS read it). Read via a live ref so the
     *  persist callbacks aren't recreated when the pre-run toggle flips. */
    lessonMode?: string;
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
     *  for the resume. Toast + navigate are the caller's job.
     *  ``"exit"`` logs the write as leaving the lesson instead of a
     *  pause the learner chose (#3365). */
    markPaused: (reason?: "exit") => Promise<void>;
    /** Phase 63A — abandon the attempt; step_results are
     *  cleared. ElementErrors stay (what was learned stays
     *  learned). */
    markAbandoned: () => Promise<void>;
    /** Phase 63C — flip a paused row back to in_progress so
     *  the viewer can replay from the saved step_results. */
    markResumed: () => Promise<void>;
    /** Phase 63C — discard step_results + score and reset to
     *  in_progress (the resume-dialog "Start Over" path).
     *  Caller must also call goToStep(0) to reset the position. */
    markRestarted: () => Promise<void>;
    /** Phase 63E — flush accumulated time to storage without
     *  changing status. Safe to call on any interval; no-op when
     *  userId or lesson is missing. Failures are non-fatal. */
    autosave: () => Promise<void>;
    /** Force-reload the lesson + progress (Set Browser
     *  navigated here mid-download). */
    refresh: () => void;
}

export function useLesson(opts: UseLessonOptions): UseLessonResult {
    const {source, setId, lessonFilename, lessonMode} = opts;
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

    // BUG #41 — mirror currentStepIndex into a ref so the persist
    // callbacks (recordStepResult / autosave / pause) read the live
    // position without being recreated on every navigation. The
    // value is sent as ``current_step`` so a paused lesson resumes
    // at the exact step (theory steps never write a step_result).
    const currentStepIndexRef = useRef(0);
    useEffect(() => {
        currentStepIndexRef.current = currentStepIndex;
    }, [currentStepIndex]);

    // #1007 Phase 2 — mirror the active lesson mode into a ref so the
    // persist callbacks send the current value (the pre-run toggle can
    // still flip it) without being recreated on every flip.
    const lessonModeRef = useRef(lessonMode);
    useEffect(() => {
        lessonModeRef.current = lessonMode;
    }, [lessonMode]);

    // #3075 - every write to the progress row goes through one promise
    // chain, so a position write racing a step-result write (API mode:
    // two POSTs the browser may deliver out of order) cannot let the
    // older ``current_step`` land last. A rejected link never blocks the
    // chain; each caller handles its own failure.
    const upsertQueueRef = useRef<Promise<unknown>>(Promise.resolve());

    // #3364 - a failed progress write was swallowed: the learner saw
    // nothing and assumed it saved. Toast once per lesson run with the
    // reason (the i18n ``t`` travels through a ref so it never becomes a
    // callback dependency, see lessons/frontend.md).
    const {t} = useI18n();
    const tRef = useRef(t);
    useEffect(() => {
        tRef.current = t;
    }, [t]);
    const writeFailureReportedRef = useRef(false);
    const reportWriteFailure = useCallback((err: unknown) => {
        if (writeFailureReportedRef.current) return;
        writeFailureReportedRef.current = true;
        notify.error(
            tRef.current(
                "lesson.progress_io.save_error",
                "Your progress in this lesson could not be saved.",
            ),
            {error: err},
        );
    }, []);
    const upsertSerial = useCallback(
        (body: LessonProgressUpsertBody): Promise<LessonProgress> => {
            if (!userId) {
                return Promise.reject(new Error("no active learner"));
            }
            const next = upsertQueueRef.current
                .catch(() => undefined)
                .then(() => getStorage().lessonProgress.upsert(userId, body))
                .then((updated) => {
                    notifyLessonProgressChanged();
                    return updated;
                });
            upsertQueueRef.current = next;
            return next;
        },
        [userId],
    );

    const fetchInitial = useCallback(async () => {
        setStatus("loading");
        setError(null);
        writeFailureReportedRef.current = false;
        let loadedLesson: ContentLesson | null;
        try {
            loadedLesson = await getStorage().contentLoader.getLesson(
                source,
                setId,
                lessonFilename,
            );
        } catch (err) {
            // Both storage modes reject a missing set or lesson with an
            // ApiError 404 (#3443), so no message matching is needed.
            if (err instanceof ApiError && err.status === 404) {
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
            } catch (err) {
                // #3364 - starting fresh here silently threw the saved
                // position away (the first write then overwrote it).
                // Stop with the reason instead; "retry" reloads.
                const detail = err instanceof Error ? err.message : String(err);
                console.error("[lesson] progress read failed", err);
                setError(
                    tRef.current(
                        "lesson.progress_io.load_failed",
                        "Your saved progress for this lesson could not be loaded: {detail}",
                    ).replace("{detail}", detail),
                );
                setStatus("error");
                return;
            }
        }
        setProgress(loadedProgress);
        // Resume where the run left off: after the furthest graded
        // exercise or at the persisted navigation position, whichever is
        // further (BUG #41), on the summary for a completed run. The rule
        // lives in lib/lesson/resume-step so the dashboard's "continue
        // learning" row names the same step (#3076).
        const restored = resumeStepIndex(
            loadedLesson.steps.map((step) => step.id),
            loadedProgress,
        );
        setCurrentStepIndex(restored);
        persistedStepRef.current = restored;
        stepEntryTimeRef.current = performance.now();
        setStatus("ready");
    }, [source, setId, lessonFilename, userId]);

    // #3075 - persist the navigation position on EVERY step change, not
    // only alongside a graded exercise. Before this, ``current_step``
    // reached storage through recordStepResult, the 30 s autosave and
    // the lifecycle flags, and every one of those was gated on a row
    // that only the first graded exercise created: a learner who read
    // through the theory steps and closed the tab, switched apps or
    // pressed the pause glyph started over at step 0 next time, and
    // theory steps after the last graded exercise were lost on any exit.
    // The write is position-only (no step_result, no lifecycle flag), so
    // the storage layer creates the row on first use and leaves a
    // paused/abandoned status untouched. The marker skips the index
    // fetchInitial restored (a resumed run must not be rewritten while
    // the resume dialog is up), the summary index (markCompleted owns
    // that transition) and completed runs (their position is ignored on
    // read and browsing a finished lesson is not a run).
    const persistedStepRef = useRef<number | null>(null);
    useEffect(() => {
        if (status !== "ready" || !userId || lesson === null) return;
        if (currentStepIndex >= lesson.steps.length) return;
        if (progress?.status === "completed") return;
        if (persistedStepRef.current === currentStepIndex) return;
        persistedStepRef.current = currentStepIndex;
        upsertSerial({
            source,
            set_id: setId,
            lesson_filename: lessonFilename,
            lesson_mode: lessonModeRef.current,
            current_step: currentStepIndex,
            // #3365 - arriving on a step is an action; this effect runs
            // once per real step change, never on a re-render or reload.
            step_event: {
                kind: "step",
                step_index: currentStepIndex,
                step_id: lesson.steps[currentStepIndex].id,
            },
        })
            .then((updated) => setProgress(updated))
            .catch((err: unknown) => {
                // The next step change (or any other write) carries the
                // position again; the learner is told once (#3364).
                persistedStepRef.current = null;
                reportWriteFailure(err);
            });
    }, [
        status,
        userId,
        lesson,
        currentStepIndex,
        progress?.status,
        source,
        setId,
        lessonFilename,
        upsertSerial,
        reportWriteFailure,
    ]);

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

    // #3364 - study time consumed by a write that then failed. The next
    // write carries it, so a failed autosave no longer loses its time.
    const pendingSecondsRef = useRef(0);
    const _consumeStepTime = useCallback((): number => {
        const now = performance.now();
        const elapsedMs = now - stepEntryTimeRef.current;
        stepEntryTimeRef.current = now;
        const seconds = Math.max(0, Math.round(elapsedMs / 1000)) + pendingSecondsRef.current;
        pendingSecondsRef.current = 0;
        return seconds;
    }, []);
    /** Hand the seconds of a failed write back to the next one. */
    const _returnStepTime = useCallback((seconds: number) => {
        pendingSecondsRef.current += seconds;
    }, []);

    /** #3365 - the action log entry for the step the learner is on;
     *  ``step_id`` is null on the summary. */
    const _stepEvent = useCallback(
        (kind: LessonStepEvent["kind"]): LessonStepEvent => {
            const stepIndex = currentStepIndexRef.current;
            return {
                kind,
                step_index: stepIndex,
                step_id: lesson?.steps[stepIndex]?.id ?? null,
            };
        },
        [lesson],
    );

    const recordStepResult = useCallback(
        async (result: LessonStepResult) => {
            if (!userId || lesson === null) return;
            const timeDelta = _consumeStepTime();
            try {
                const updated = await upsertSerial({
                    source,
                    set_id: setId,
                    lesson_filename: lessonFilename,
                    lesson_mode: lessonModeRef.current,
                    step_result: result,
                    time_spent_seconds_delta: timeDelta,
                    current_step: currentStepIndexRef.current,
                    step_event: {
                        kind: "answer",
                        step_index: currentStepIndexRef.current,
                        step_id: result.step_id,
                        correct: result.total > 0 && result.correct === result.total,
                    },
                });
                setProgress(updated);
            } catch (err) {
                // The viewer keeps working with in-memory state; the
                // time goes to the next write and the learner is told
                // once (#3364).
                _returnStepTime(timeDelta);
                reportWriteFailure(err);
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
            _returnStepTime,
            reportWriteFailure,
            upsertSerial,
        ],
    );

    const markCompleted = useCallback(async (options?: {
        /** #2893 - game-mode combo bonus for this run (already capped). */
        comboBonusXp?: number;
    }) => {
        if (!userId || lesson === null) return;
        const timeDelta = _consumeStepTime();
        try {
            const updated = await upsertSerial({
                source,
                set_id: setId,
                lesson_filename: lessonFilename,
                lesson_mode: lessonModeRef.current,
                time_spent_seconds_delta: timeDelta,
                mark_completed: true,
                step_event: _stepEvent("complete"),
                combo_bonus_xp: Math.max(
                    0,
                    Math.min(20, Math.trunc(options?.comboBonusXp ?? 0)),
                ),
            });
            setProgress(updated);
        } catch (err) {
            _returnStepTime(timeDelta);
            setError(err instanceof Error ? err.message : String(err));
            // #1787 — rethrow so the summary click handler can toast:
            // on the summary screen the hook's error state is never
            // rendered (LessonStatusView only shows load failures), so
            // swallowing here made a failed completion invisible.
            throw err;
        }
    }, [
        userId,
        source,
        setId,
        lessonFilename,
        lesson,
        _consumeStepTime,
        _returnStepTime,
        _stepEvent,
        upsertSerial,
    ]);

    // Phase 63A — shared transition writer for pause / abandon /
    // resume. Each just sets one flag; the backend service + Dexie
    // mirror enforce the same one-flag-per-call rule and the
    // correct status / timestamp / step_results invariants.
    const _markLifecycle = useCallback(
        async (
            flag:
                | "mark_paused"
                | "mark_abandoned"
                | "mark_resumed"
                | "mark_restarted",
            // #3365 - the action this transition logs; resume and abandon
            // are not actions in the log.
            eventKind?: "pause" | "exit" | "restart",
        ) => {
            if (!userId || lesson === null) return;
            const timeDelta = _consumeStepTime();
            try {
                const updated = await upsertSerial({
                    source,
                    set_id: setId,
                    lesson_filename: lessonFilename,
                    lesson_mode: lessonModeRef.current,
                    time_spent_seconds_delta: timeDelta,
                    current_step: currentStepIndexRef.current,
                    ...(eventKind ? {step_event: _stepEvent(eventKind)} : {}),
                    [flag]: true,
                });
                persistedStepRef.current = updated.current_step ?? null;
                setProgress(updated);
            } catch (err) {
                _returnStepTime(timeDelta);
                reportWriteFailure(err);
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
            _returnStepTime,
            _stepEvent,
            reportWriteFailure,
            upsertSerial,
        ],
    );

    const markPaused = useCallback(
        (reason?: "exit") =>
            _markLifecycle("mark_paused", reason === "exit" ? "exit" : "pause"),
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
    const markRestarted = useCallback(
        () => _markLifecycle("mark_restarted", "restart"),
        [_markLifecycle],
    );

    // Phase 63E — periodic time flush. Consumes the step-entry
    // timer (same as _consumeStepTime) so the subsequent
    // recordStepResult only charges the time since the last flush,
    // preventing double-counting.
    const autosave = useCallback(async () => {
        if (!userId || lesson === null) return;
        const delta = _consumeStepTime();
        if (delta < 1) return;
        try {
            await upsertSerial({
                source,
                set_id: setId,
                lesson_filename: lessonFilename,
                lesson_mode: lessonModeRef.current,
                time_spent_seconds_delta: delta,
                current_step: currentStepIndexRef.current,
            });
        } catch (err) {
            // The next interval or step-result write carries the time
            // (#3364: it used to be consumed and lost here).
            _returnStepTime(delta);
            reportWriteFailure(err);
        }
    }, [
        userId,
        source,
        setId,
        lessonFilename,
        lesson,
        _consumeStepTime,
        _returnStepTime,
        reportWriteFailure,
        upsertSerial,
    ]);

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
        markRestarted,
        autosave,
        refresh,
    };
}
