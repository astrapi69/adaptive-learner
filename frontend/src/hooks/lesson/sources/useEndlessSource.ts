/**
 * useEndlessSource (EXP-052 slice 2, refs #3169).
 *
 * The source adapter of the Endless stream: calls ``useEndlessLesson``
 * exactly as the page did and normalises it to the shell's
 * ``RunnerSource``. It is the first source without a position, and it
 * owns the three pieces of run state the page used to keep inline:
 *
 * - ``streamStep``: a monotonic counter, one up per ``goNext``. The shell
 *   keys the per-step two-phase reset and the re-anchor on it, because the
 *   stream may hand out the SAME card (same step id) again.
 * - the pause (``pause.paused`` / ``onToggle``): pausing freezes the
 *   active-seconds timer; the shell hides the step and switches Enter off.
 * - the end (``pause.onEnd``): Endless is the only run without a last
 *   step, so End is what leads to the summary (``isSummary``).
 *
 * No ``goPrev``: there is no previous step to materialise from a stream
 * (``ENDLESS_POLICY.prevStep`` is false for that structural reason). The
 * tallies carry the running ``stats`` and ``elapsedSec``, which feed both
 * the stat line in the progress slot and the recap.
 *
 * @example
 * const source = useEndlessSource({ setId });
 * <LessonRunner source={source} policy={ENDLESS_POLICY}
 *   summary={(tallies) => <EndlessSummary stats={tallies.stats!}
 *     elapsedSec={tallies.elapsedSec ?? 0} onExit={exit} />} />
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import type {RunnerSource} from "../../../components/lesson/runner/types";
import {useI18n} from "../../ui/useI18n";
import {useEndlessLesson} from "../modes/useEndlessLesson";

export interface UseEndlessSourceOptions {
    setId: string;
}

/** Active seconds of the run: ticks once a second while ready, not paused, not ended. */
function useActiveSeconds(running: boolean): number {
    const [elapsedSec, setElapsedSec] = useState(0);
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [running]);
    return elapsedSec;
}

/** The Endless stream as a ``RunnerSource`` (no position, own step counter, pause, end). */
export function useEndlessSource({setId}: UseEndlessSourceOptions): RunnerSource {
    const {t} = useI18n();
    const endless = useEndlessLesson({
        setId,
        title: t("endless.session_title", "Endless practice"),
    });
    const [paused, setPaused] = useState(false);
    const [ended, setEnded] = useState(false);
    const [streamStep, setStreamStep] = useState(0);
    const elapsedSec = useActiveSeconds(endless.status === "ready" && !paused && !ended);

    const {advance} = endless;
    const goNext = useCallback(() => {
        advance();
        setStreamStep((n) => n + 1);
    }, [advance]);
    const pause = useMemo(
        () => ({
            paused,
            onToggle: () => setPaused((p) => !p),
            onEnd: () => {
                setPaused(false);
                setEnded(true);
            },
        }),
        [paused],
    );

    const isSummary = endless.status === "ready" && ended;
    const step = endless.status === "ready" && !ended ? endless.step : null;

    return {
        status: endless.status,
        error: endless.error,
        title: t("endless.page_title", "Endless practice"),
        step,
        cards: endless.cards,
        setId,
        lessonId: step?.review_lesson_id ?? "",
        runKey: setId,
        position: null,
        streamStep,
        pause,
        isSummary,
        tallies: {
            correct: endless.stats.correct,
            total: endless.stats.cards,
            stats: endless.stats,
            elapsedSec,
        },
        goNext,
        recordStepAttempts: endless.recordStepAttempts,
    };
}
