import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router";

import {useI18n} from "../../ui/useI18n";
import {notify} from "../../../utils/notify";
import type {LessonLoadStatus} from "./useLesson";
import type {LessonProgress} from "../../../storage/types";

/**
 * Inputs for {@link useLessonFlowControl} — the lifecycle slice of
 * ``useLesson``'s result plus the step setter the start-over path
 * needs. Everything else (steps, results, scoring) stays with the
 * page.
 */
export interface UseLessonFlowControlOptions {
    /** Lesson load state from ``useLesson``. */
    status: LessonLoadStatus;
    /** Stored progress row, ``null`` until the first upsert lands. */
    progress: LessonProgress | null;
    /** ``"exit"`` marks the pause as leaving the lesson (navigation, tab
     *  close) rather than a pause the learner chose (#3365). */
    markPaused: (reason?: "exit") => Promise<void>;
    markAbandoned: () => Promise<void>;
    markResumed: () => Promise<void>;
    /** Reset progress for a fresh run (resume dialog "start over"). */
    markRestarted: () => Promise<void>;
    /** Flush accumulated time without changing lesson status. */
    autosave: () => Promise<void>;
    goToStep: (index: number) => void;
    /**
     * True while the step view shows the summary (index past the last
     * step). Leaving from there is not an interruption: the run is
     * played through, only "mark complete" is pending, so the unmount
     * pause (#3075) stays off and the row keeps its ``in_progress``
     * status (listed under "continue learning", not as paused).
     */
    atSummary?: boolean;
}

/**
 * Result of {@link useLessonFlowControl}: the exit-dialog state, the
 * resume prompt visibility, and the dialog action handlers the page
 * wires into ``LessonExitDialog`` / ``LessonResumeDialog``.
 */
export interface UseLessonFlowControlResult {
    /** Back-button exit dialog visibility (Phase 63B). */
    exitOpen: boolean;
    setExitOpen: (open: boolean) => void;
    /** True while the lesson run can still be paused/abandoned. */
    isInProgress: boolean;
    /** True when the paused-lesson resume prompt must overlay the
     *  step view (Phase 63C). */
    showResumePrompt: boolean;
    handleResume: () => Promise<void>;
    handleStartOver: () => Promise<void>;
    handlePauseFromDialog: () => Promise<void>;
    handleAbandonFromDialog: () => Promise<void>;
}

/**
 * Lesson lifecycle flow control (Phase 63 B/C/E), extracted from
 * ``LessonPage`` (#354).
 *
 * Owns the back-button exit dialog, the paused-lesson resume prompt,
 * a time-and-position flush when the tab is hidden (#3361), auto-pause
 * when the window unloads, auto-pause when the page
 * is left by in-app navigation (#3075), the 30-second autosave
 * interval, and the pause/abandon dialog actions (toast + navigate
 * back to the Content Browser).
 */
export function useLessonFlowControl({
    status,
    progress,
    markPaused,
    markAbandoned,
    markResumed,
    markRestarted,
    autosave,
    goToStep,
    atSummary = false,
}: UseLessonFlowControlOptions): UseLessonFlowControlResult {
    const navigate = useNavigate();
    const {t} = useI18n();

    // Phase 63B — back-button intercept + browser-close
    // auto-pause. The dialog gives the user explicit pause /
    // abandon / continue paths; the lifecycle handlers below
    // also auto-pause when the tab is hidden or the window
    // unloads while the lesson is still in progress.
    const [exitOpen, setExitOpen] = useState(false);
    // A run is "in progress" ONLY once a started progress row exists
    // (status ``in_progress``). ``progress`` is null until the first
    // answer triggers an upsert, so a freshly-opened lesson is NOT yet
    // under way: the mode toggle stays switchable and the back button
    // just leaves (nothing to pause). Treating ``progress === null`` as
    // in-progress (the old behaviour) locked the mode toggle for the
    // whole lesson and auto-paused a lesson the learner never started
    // (#1027). ``paused``/``completed`` are likewise not in-progress.
    const isInProgress = progress?.status === "in_progress";

    // Phase 63C — resume prompt. Shown once when the lesson is
    // loaded and the stored progress is in the ``paused`` state.
    // The user must choose before interacting with the step view.
    const [resumeChoiceMade, setResumeChoiceMade] = useState(false);
    // #3361 - the choice belongs to one lesson. The summary's next-lesson
    // button keeps this page mounted, so without a reset a paused next
    // lesson opened without asking.
    const lessonKey = progress
        ? `${progress.source}#${progress.set_id}#${progress.lesson_filename}`
        : null;
    const [choiceLessonKey, setChoiceLessonKey] = useState(lessonKey);
    if (lessonKey !== null && lessonKey !== choiceLessonKey) {
        setChoiceLessonKey(lessonKey);
        setResumeChoiceMade(false);
    }
    const showResumePrompt =
        status === "ready" &&
        progress?.status === "paused" &&
        !resumeChoiceMade;

    const handleResume = async () => {
        await markResumed();
        setResumeChoiceMade(true);
        // currentStepIndex is already at the right position
        // (fetchInitial computed it from step_results on load).
    };

    const handleStartOver = async () => {
        await markRestarted();
        setResumeChoiceMade(true);
        goToStep(0);
    };

    // #3361 - a hidden tab, a phone lock or an app switch only flushes
    // time and position. It used to mark the run paused: that removed
    // this very listener (``isInProgress`` turned false), so the return
    // never resumed, the resume dialog opened mid-lesson and the row stayed
    // ``paused`` while the learner played on. ``pagehide`` covers iOS,
    // which never fires ``beforeunload``. Closing the tab still pauses.
    useEffect(() => {
        if (!isInProgress) return;
        const flush = () => void autosave();
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flush();
        };
        const onUnload = () => void markPaused("exit");
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", flush);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", flush);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [isInProgress, autosave, markPaused]);

    // Phase 63E — 30-second autosave interval. Flushes accumulated
    // time to storage without changing lesson status so the
    // summary shows accurate time even on long theory steps.
    useEffect(() => {
        if (status !== "ready" || !isInProgress) return;
        const id = setInterval(() => void autosave(), 30_000);
        return () => clearInterval(id);
    }, [status, isInProgress, autosave]);

    // #3075 - leaving the lesson by any in-app route (logo, nav link,
    // browser back, the set link in the header) unmounts this hook
    // without firing ``beforeunload``; the effect cleanup above only
    // REMOVES that listener. Until now such an exit wrote nothing: the
    // row stayed ``in_progress`` at the last graded exercise, every
    // theory step after it was lost, and the lesson never reached the
    // paused-lessons card. Pause a started run on unmount instead, the
    // same write the exit dialog's "Pause" performs. The refs carry
    // the latest values into the unmount closure; the dialog paths
    // set ``leftViaDialogRef`` so their own lifecycle write is not
    // followed by a second one.
    const isInProgressRef = useRef(isInProgress);
    useEffect(() => {
        isInProgressRef.current = isInProgress;
    }, [isInProgress]);
    const markPausedRef = useRef(markPaused);
    useEffect(() => {
        markPausedRef.current = markPaused;
    }, [markPaused]);
    const atSummaryRef = useRef(atSummary);
    useEffect(() => {
        atSummaryRef.current = atSummary;
    }, [atSummary]);
    const leftViaDialogRef = useRef(false);
    useEffect(
        () => () => {
            if (
                isInProgressRef.current &&
                !leftViaDialogRef.current &&
                !atSummaryRef.current
            ) {
                void markPausedRef.current("exit");
            }
        },
        [],
    );

    const handlePauseFromDialog = async () => {
        leftViaDialogRef.current = true;
        await markPaused();
        setExitOpen(false);
        notify.info(
            t(
                "lesson.exit.paused_toast",
                "Lesson paused. You can resume anytime.",
            ),
        );
        navigate("/content");
    };

    const handleAbandonFromDialog = async () => {
        leftViaDialogRef.current = true;
        await markAbandoned();
        setExitOpen(false);
        notify.info(t("lesson.exit.abandoned_toast", "Lesson abandoned."));
        navigate("/content");
    };

    return {
        exitOpen,
        setExitOpen,
        isInProgress,
        showResumePrompt,
        handleResume,
        handleStartOver,
        handlePauseFromDialog,
        handleAbandonFromDialog,
    };
}
