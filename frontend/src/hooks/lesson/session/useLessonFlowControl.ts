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
    markPaused: () => Promise<void>;
    markAbandoned: () => Promise<void>;
    markResumed: () => Promise<void>;
    /** Reset progress for a fresh run (resume dialog "start over"). */
    markRestarted: () => Promise<void>;
    /** Flush accumulated time without changing lesson status. */
    autosave: () => Promise<void>;
    goToStep: (index: number) => void;
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
 * auto-pause when the tab is hidden or the window unloads (with
 * silent auto-resume on a brief tab switch), the 30-second autosave
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

    // Phase 63B + 63E — auto-pause on hide, auto-resume on return.
    // ``autoSuspendedRef`` tracks whether THIS effect fired a pause
    // so the return-visible handler can reverse it without showing
    // the resume dialog (brief tab-switch case).
    const autoSuspendedRef = useRef(false);
    useEffect(() => {
        if (!isInProgress) return;
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                autoSuspendedRef.current = true;
                void markPaused();
            } else if (autoSuspendedRef.current) {
                autoSuspendedRef.current = false;
                void markResumed();
            }
        };
        const onUnload = () => void markPaused();
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [isInProgress, markPaused, markResumed]);

    // Phase 63E — 30-second autosave interval. Flushes accumulated
    // time to storage without changing lesson status so the
    // summary shows accurate time even on long theory steps.
    useEffect(() => {
        if (status !== "ready" || !isInProgress) return;
        const id = setInterval(() => void autosave(), 30_000);
        return () => clearInterval(id);
    }, [status, isInProgress, autosave]);

    const handlePauseFromDialog = async () => {
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
