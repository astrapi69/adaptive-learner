/**
 * useAdaptiveSource (EXP-052 slice 3, refs #3169).
 *
 * The source adapter of the adaptive lesson (Phase 53G / EXP-013): calls
 * ``useAdaptiveLesson`` exactly as the page did and normalises its result
 * to the shell's ``RunnerSource``. The adaptive wording lives here, not in
 * the shell: the generated lesson's title, the mastery delta in the
 * tallies (F-116), and the one-time ``finalize`` the first time the
 * learner lands on the summary (it recounts the mastered elements; moved
 * out of the page).
 *
 * ``lessonId`` is empty on purpose: the generator does not carry the
 * source lesson into the rendered step, and the element-attempt deriver in
 * ``ExerciseDispatcher`` stamps the right ``lesson_id`` from the card
 * metadata at submit time (the page's step-id parser always returned "").
 *
 * What the header extension and the summary need beyond ``RunnerSource``
 * sits on the same object: ``transparency`` (the F-115 block) and
 * ``lesson`` (the save-for-replay button, Phase 59F).
 *
 * @example
 * const source = useAdaptiveSource({setId, lessonId});
 * <LessonRunner source={source} policy={ADAPTIVE_POLICY}
 *   headerExtra={() => <AdaptiveTransparencyDisplay transparency={source.transparency} />}
 *   summary={(tallies) => <AdaptiveSummary {...tallies} lesson={source.lesson} />} />
 */

import {useEffect, useRef} from "react";

import type {RunnerSource, RunnerSourceStatus} from "../../../components/lesson/runner/types";
import type {ContentLesson} from "../../../storage/types";
import {useI18n} from "../../ui/useI18n";
import {useAdaptiveLesson, type AdaptiveTransparency} from "../modes/useAdaptiveLesson";

interface UseAdaptiveSourceOptions {
    setId: string;
    /** #1012: train only this lesson's failed cards (the ``?lesson=`` scope). */
    lessonId?: string;
}

export interface AdaptiveSource extends RunnerSource {
    /** F-115: what the lesson targets and why, for the header extension. */
    transparency: AdaptiveTransparency | null;
    /** The generated lesson, for the summary's save-for-replay button. */
    lesson: ContentLesson | null;
}

/** F-116: recount the mastered elements once, when the summary is first reached. */
function useFinalizeOnSummary(isSummary: boolean, finalize: () => Promise<void>): void {
    const finalisedRef = useRef(false);
    useEffect(() => {
        if (!isSummary || finalisedRef.current) return;
        finalisedRef.current = true;
        void finalize();
    }, [isSummary, finalize]);
}

/** The adaptive lesson as a ``RunnerSource`` plus transparency and the lesson. */
export function useAdaptiveSource({setId, lessonId}: UseAdaptiveSourceOptions): AdaptiveSource {
    const {t} = useI18n();
    const adaptive = useAdaptiveLesson({
        setId,
        lessonId,
        title: t("adaptive.session_title", "Adaptive lesson"),
    });

    const steps = adaptive.lesson?.steps ?? [];
    const total = steps.length;
    const index = adaptive.currentStepIndex;
    const status: RunnerSourceStatus =
        adaptive.status === "ready" && adaptive.lesson === null ? "error" : adaptive.status;
    const isSummary = status === "ready" && index >= total;
    const step = status === "ready" && !isSummary ? (steps[index] ?? null) : null;
    useFinalizeOnSummary(isSummary, adaptive.finalize);

    return {
        status,
        error: adaptive.error,
        title: adaptive.lesson?.title ?? t("adaptive.session_title", "Adaptive lesson"),
        step,
        cards: adaptive.lesson?.cards ?? [],
        setId,
        lessonId: "",
        runKey: lessonId ? `${setId}#${lessonId}` : setId,
        position: {index, total},
        isSummary,
        tallies: {
            correct: adaptive.sessionScoreCorrect,
            total: adaptive.sessionScoreTotal,
            masteredDelta: adaptive.masteredDelta,
        },
        goNext: adaptive.goNext,
        goPrev: adaptive.goPrev,
        recordStepAttempts: adaptive.recordStepAttempts,
        transparency: adaptive.transparency,
        lesson: adaptive.lesson,
    };
}
