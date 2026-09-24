/**
 * useErrorReplaySource (EXP-052 slice 3, refs #3169).
 *
 * The source adapter of "Fehler wiederholen": the exercises the learner
 * just failed arrive as router state (the lesson summary's correction
 * block, or a set's flash-round card, #2888), and this hook turns them
 * into the shell's ``RunnerSource``. It owns the round logic the page used
 * to keep inline, testable without a page for the first time:
 *
 * - the round plays ONLY the failed exercises, one exercise step each;
 * - a graded answer counts as fully correct when ``correct === total``
 *   (``onStepScored``; the element attempts alone cannot tell);
 * - "try again" narrows the round to the still-wrong exercises and starts
 *   a new SECTION of the same run (``sectionKey``): the shell re-opens the
 *   replayed steps, hint usage stays (a hint from round one still counts);
 * - a flash round retitles the run and leaves to the round's origin
 *   (``backTo``), the lesson replay back to its lesson;
 * - every graded answer merges into the SRS error list through the same
 *   ``recordBulk`` path the viewer, review and correction block use
 *   (#1304), failure-tolerant: a failed write never blocks the round.
 *
 * Ephemeral and practice-only: no LessonProgress / step_results writes.
 * Dexie-friendly (no backend). What the summary and the header extension
 * need beyond ``RunnerSource`` sits on the same object: ``flashRound``,
 * ``stepAnswered`` (the countdown pauses on a graded step), ``stillWrong``
 * and ``retryStillWrong``.
 *
 * @example
 * const source = useErrorReplaySource({state: location.state as ReplayState | null,
 *     setSlug, setId, filename});
 * <LessonRunner source={source} policy={ERROR_REPLAY_POLICY} summary={...} />
 */

import {useCallback, useMemo, useState} from "react";

import type {ExerciseScored} from "../../../components/exercises";
import type {RunnerSource} from "../../../components/lesson/runner/types";
import {readLearnerState} from "../../../lib/learning/learnerState";
import {notifyReviewsChanged} from "../../../lib/review/reviewsChanged";
import {getStorage} from "../../../storage";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
    ElementAttempt,
} from "../../../storage/types";
import {useI18n} from "../../ui/useI18n";

/** #2888 - a set flash round: seconds per exercise and where it leaves to. */
interface FlashRound {
    seconds: number;
    backTo: string;
}

/** The router state the correction block / flash-round card hands over. */
export interface ReplayState {
    exercises: ContentLessonExercise[];
    cards: ContentLessonCard[];
    lessonTitle: string;
    /** Present when this round is a set flash round (no source lesson file). */
    flashRound?: FlashRound;
}

interface UseErrorReplaySourceOptions {
    /** ``location.state``; ``null`` after a direct navigation or a refresh. */
    state: ReplayState | null;
    setSlug: string;
    setId: string;
    filename: string;
}

export interface ErrorReplaySource extends RunnerSource {
    backTo: string;
    flashRound: FlashRound | null;
    /** The current step was graded in this section (the countdown pauses). */
    stepAnswered: boolean;
    /** Exercises of this section not answered fully correct (yet). */
    stillWrong: number;
    /** Replay only the still-wrong exercises, as a new section of the run. */
    retryStillWrong: () => void;
}

/** One section of the replay: its exercises, per-exercise verdicts, position. */
interface ReplayRound {
    exercises: ContentLessonExercise[];
    /** Exercise id -> answered fully correct in this section. */
    results: Record<string, boolean>;
    index: number;
    section: number;
}

function toStep(exercise: ContentLessonExercise): ContentLessonStep {
    return {id: exercise.id, type: "exercise", exercise};
}

/** The round state and its transitions; one state object, so a retry is one update. */
function useReplayRound(initial: ContentLessonExercise[]) {
    const [round, setRound] = useState<ReplayRound>(() => ({
        exercises: initial,
        results: {},
        index: 0,
        section: 0,
    }));
    const goNext = useCallback(
        () => setRound((r) => ({...r, index: Math.min(r.index + 1, r.exercises.length)})),
        [],
    );
    const goPrev = useCallback(() => setRound((r) => ({...r, index: Math.max(r.index - 1, 0)})), []);
    const onStepScored = useCallback((stepId: string, scored: ExerciseScored) => {
        const fullyCorrect = scored.correct === scored.total;
        setRound((r) => ({...r, results: {...r.results, [stepId]: fullyCorrect}}));
    }, []);
    const retryStillWrong = useCallback(
        () =>
            setRound((r) => ({
                exercises: r.exercises.filter((ex) => r.results[ex.id] !== true),
                results: {},
                index: 0,
                section: r.section + 1,
            })),
        [],
    );
    return {round, goNext, goPrev, onStepScored, retryStillWrong};
}

/** #1304: merge the graded attempts into the learner's SRS error list. */
function useReplayRecorder(): RunnerSource["recordStepAttempts"] {
    const userId = useMemo(() => readLearnerState().userId, []);
    return useCallback(
        async (attempts: readonly ElementAttempt[]) => {
            if (attempts.length === 0 || !userId) return;
            try {
                await getStorage().elementErrors.recordBulk(userId, attempts);
                notifyReviewsChanged();
            } catch (err) {
                console.warn("elementErrors.recordBulk failed:", err);
            }
        },
        [userId],
    );
}

type Translate = (key: string, fallback?: string) => string;

function replayTitle(t: Translate, lessonTitle: string, flashRound: FlashRound | null): string {
    return flashRound
        ? t("lesson.flash_round.title", "Flash round: {set}").replace("{set}", lessonTitle)
        : t("lesson.error_replay.title", "Retry errors: {lesson}").replace("{lesson}", lessonTitle);
}

/** The Error Replay as a ``RunnerSource`` plus its round controls. */
export function useErrorReplaySource({
    state,
    setSlug,
    setId,
    filename,
}: UseErrorReplaySourceOptions): ErrorReplaySource {
    const {t} = useI18n();
    const failed = state?.exercises ?? [];
    const {round, goNext, goPrev, onStepScored, retryStillWrong} = useReplayRound(failed);
    const recordStepAttempts = useReplayRecorder();
    const steps = useMemo(() => round.exercises.map(toStep), [round.exercises]);
    const flashRound = state?.flashRound ?? null;

    const empty = failed.length === 0;
    const total = steps.length;
    const isSummary = !empty && round.index >= total;
    const step = empty || isSummary ? null : (steps[round.index] ?? null);

    return {
        status: empty ? "empty" : "ready",
        error: null,
        title: replayTitle(t, state?.lessonTitle ?? "", flashRound),
        // #2761: the title carries the lesson's (or set's) own name.
        wrapTitle: true,
        step,
        cards: state?.cards ?? [],
        setId,
        lessonId: filename,
        runKey: `${setId}/${filename}`,
        sectionKey: String(round.section),
        backTo: flashRound ? flashRound.backTo : `/lesson/${setSlug}/${setId}/${filename}`,
        position: {index: round.index, total},
        isSummary,
        tallies: {correct: Object.values(round.results).filter(Boolean).length, total},
        goNext,
        goPrev,
        recordStepAttempts,
        onStepScored,
        flashRound,
        stepAnswered: step !== null && round.results[step.id] !== undefined,
        stillWrong: round.exercises.filter((ex) => round.results[ex.id] !== true).length,
        retryStillWrong,
    };
}
