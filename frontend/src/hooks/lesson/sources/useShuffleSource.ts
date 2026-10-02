/**
 * useShuffleSource (EXP-052 slice 2, refs #3169).
 *
 * The source adapter of the shuffle session: calls ``useShuffleLesson``
 * exactly as the page did and normalises its result to the shell's
 * ``RunnerSource``. The shuffle wording lives here, not in the shell: the
 * title the builder stamped on the synthesised lesson, the subtitle
 * "Mixing {n} questions from {lessons} lessons", and the ``lesson_id``
 * the dispatcher stamps (each synthesised step carries its source
 * lesson's ``review_lesson_id``, so an attempt records against the right
 * SRS row).
 *
 * What the shuffle summary needs beyond ``RunnerSource`` sits on the SAME
 * returned object, the review adapter's pattern: ``reload`` ("Shuffle
 * again", which is a new run for the shell: hints cleared, run-local
 * results dropped) and ``sourceLessonCount`` ("from {n} different
 * lessons").
 *
 * @example
 * const source = useShuffleSource({ setId, limit });
 * <LessonRunner source={source} policy={SHUFFLE_POLICY}
 *   summary={(tallies) => <ShuffleSummary {...tallies} lessons={source.sourceLessonCount}
 *     onAnotherRound={source.reload} onExit={exit} />} />
 */

import {useCallback, useState} from "react";

import type {RunnerSource, RunnerSourceStatus} from "../../../components/lesson/runner/types";
import {useI18n} from "../../ui/useI18n";
import {useShuffleLesson} from "../modes/useShuffleLesson";

export interface UseShuffleSourceOptions {
    setId: string;
    /** #1014: the session length the page read from ``?len=``. */
    limit: number;
}

export interface ShuffleSource extends RunnerSource {
    /** Re-shuffle and restart in place; a new run for the shell. */
    reload: () => void;
    /** How many source lessons the round interleaves (the summary line). */
    sourceLessonCount: number;
}

/** The shuffle session as a ``RunnerSource`` plus ``reload`` and the lesson count. */
export function useShuffleSource({setId, limit}: UseShuffleSourceOptions): ShuffleSource {
    const {t} = useI18n();
    const shuffle = useShuffleLesson({
        setId,
        title: t("shuffle.session_title", "Shuffle session"),
        limit,
    });
    const [round, setRound] = useState(0);
    const {reload: reloadRound} = shuffle;
    const reload = useCallback(() => {
        setRound((r) => r + 1);
        reloadRound();
    }, [reloadRound]);

    const steps = shuffle.lesson?.steps ?? [];
    const total = steps.length;
    const index = shuffle.currentStepIndex;
    const status: RunnerSourceStatus =
        shuffle.status === "ready" && shuffle.lesson === null ? "error" : shuffle.status;
    const isSummary = status === "ready" && index >= total;
    const step = status === "ready" && !isSummary ? (steps[index] ?? null) : null;

    return {
        status,
        error: shuffle.error,
        title: shuffle.lesson?.title ?? t("shuffle.session_title", "Shuffle session"),
        subtitle: t("shuffle.subtitle", "Mixing {n} questions from {lessons} lessons")
            .replace("{n}", String(total))
            .replace("{lessons}", String(shuffle.sourceLessonCount)),
        step,
        cards: shuffle.lesson?.cards ?? [],
        setId,
        lessonId: step?.review_lesson_id ?? "",
        runKey: `${setId}#${round}`,
        position: {index, total},
        isSummary,
        tallies: {correct: shuffle.sessionScoreCorrect, total: shuffle.sessionScoreTotal},
        goNext: shuffle.goNext,
        goPrev: shuffle.goPrev,
        recordStepAttempts: shuffle.recordStepAttempts,
        reload,
        sourceLessonCount: shuffle.sourceLessonCount,
    };
}
