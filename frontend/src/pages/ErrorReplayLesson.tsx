/**
 * /error-replay/:setSlug/:setId/:filename — "Fehler wiederholen".
 *
 * Replays the EXACT exercises the learner just failed in a lesson,
 * one more time. Distinct from:
 *   - the Correction Block (generates NEW cloze exercises),
 *   - the Adaptive Lesson (all errors across all lessons, regenerated),
 *   - the SRS Review queue (all lessons, on a schedule).
 *
 * The failed exercises arrive via router state (the lesson summary's
 * "Retry Errors" card builds the payload from ``step_results``).
 * Ephemeral + practice-only: no LessonProgress / step_results writes
 * (re-entering the original lesson is unaffected). Reuses the shared
 * ExerciseDispatcher + the same two-phase Check→Next button as the
 * main viewer + Review, so the exercises behave identically.
 *
 * Iterative: after a round the summary shows "X/Y correct now". All
 * correct → celebration; still wrong → replay ONLY the still-wrong
 * exercises. Dexie-friendly (no backend).
 */

import {ArrowRight, BookOpen, PartyPopper, RotateCcw} from "lucide-react";
import {useEffect, useMemo, useRef, useState, type Ref} from "react";
import {useLocation, useNavigate, useParams} from "react-router-dom";

import {Button} from "@/components/ui/button";

import Confetti from "../components/feedback/Confetti";
import ProgressBar from "../shared/data-display/ProgressBar";
import {
    ExerciseDispatcher,
    SUPPORTED_EXERCISE_TYPES,
} from "../components/exercises/ExerciseDispatcher";
import type {
    ExerciseHandle,
    ExerciseScored,
} from "../components/exercises/exercise-control";
import {useI18n} from "../hooks/useI18n";

type Translate = (key: string, fallback?: string) => string;
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../hooks/useLessonEnterKey";
import {useLessonShortcuts} from "../hooks/useLessonShortcuts";
import {prefersReducedMotion} from "../lib/feedback/feedbackPref";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../storage/types";

interface ReplayState {
    exercises: ContentLessonExercise[];
    cards: ContentLessonCard[];
    lessonTitle: string;
}

interface UrlParams {
    setId?: string;
    filename?: string;
    [key: string]: string | undefined;
}

function toStep(exercise: ContentLessonExercise): ContentLessonStep {
    return {id: exercise.id, type: "exercise", exercise};
}

export default function ErrorReplayLesson() {
    const params = useParams<UrlParams>();
    const navigate = useNavigate();
    const location = useLocation();
    const {t} = useI18n();
    const setId = params.setId ?? "";
    const filename = params.filename ?? "";

    const state = location.state as ReplayState | null;
    const cards = state?.cards ?? [];
    const lessonTitle = state?.lessonTitle ?? "";

    // The exercises to replay THIS round + the running per-exercise
    // result (true = answered fully correct this round). A "Try again"
    // narrows the round to the still-wrong exercises.
    const [round, setRound] = useState<ContentLessonExercise[]>(
        () => state?.exercises ?? [],
    );
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [index, setIndex] = useState(0);
    const [checked, setChecked] = useState(false);
    const [answerable, setAnswerable] = useState(false);

    const exerciseRef = useRef<ExerciseHandle>(null);
    // #154 — Enter-key shortcut, identical to the main lesson runner.
    const lessonShortcutsEnabled = useLessonShortcuts();
    const enterStateRef = useRef<LessonEnterNav | null>(null);
    const enterLockRef = useRef(false);
    useEffect(() => {
        setChecked(false);
        setAnswerable(false);
        enterLockRef.current = false;
    }, [index, round]);

    const steps = useMemo(() => round.map(toStep), [round]);
    const total = steps.length;
    const isSummary = index >= total;
    const step = isSummary ? null : steps[index];
    const isExerciseStep =
        step != null &&
        step.exercise != null &&
        SUPPORTED_EXERCISE_TYPES.has(step.exercise.type);

    // Refresh the Enter-decision state every render (no re-subscribe);
    // the listener reads it through the ref. Error-Replay has no
    // "reviewed/locked" step, so ``enteredReviewed`` is always false.
    enterStateRef.current = {
        isSummary,
        isExerciseStep,
        checked,
        enteredReviewed: false,
        answerable,
        goNext: () => setIndex((i) => i + 1),
    };
    useLessonEnterKey({
        enabled: lessonShortcutsEnabled,
        exerciseRef,
        enterStateRef,
        enterLockRef,
    });

    // No exercises to replay (direct nav / refresh lost the state, or a
    // clean run). Offer a graceful exit.
    if (!state || (state.exercises?.length ?? 0) === 0) {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="error-replay-empty"
            >
                <header className="lesson-header">
                    <h1>{t("lesson.next_step.error_replay", "Retry Errors")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "lesson.error_replay.empty",
                        "Nothing to retry — open this from a lesson summary after making some mistakes.",
                    )}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/content")}
                    data-testid="error-replay-exit"
                >
                    <BookOpen size={14} aria-hidden="true" />
                    {t("lesson.action.open_browser", "Open content browser")}
                </Button>
            </main>
        );
    }

    const correctNow = Object.values(results).filter(Boolean).length;
    const stillWrong = round.filter((ex) => results[ex.id] !== true);

    const retryStillWrong = () => {
        setRound(stillWrong);
        setResults({});
        setIndex(0);
    };

    const backToLesson = () =>
        navigate(`/lesson/${params.setSlug}/${setId}/${filename}`);

    const progressPct =
        total === 0 ? 100 : Math.round((index / total) * 100);

    return (
        <main
            id="main"
            className="page lesson-page"
            data-testid="error-replay-page"
        >
            <header className="lesson-header">
                <button
                    type="button"
                    className="lesson-back-btn"
                    onClick={backToLesson}
                    data-testid="error-replay-back-btn"
                    aria-label={t(
                        "lesson.action.back_to_lesson",
                        "Back to lesson",
                    )}
                >
                    <BookOpen size={16} aria-hidden="true" />
                    {t("lesson.action.back_to_lesson", "Back to lesson")}
                </button>
                <h1>
                    {t(
                        "lesson.error_replay.title",
                        "Retry errors: {lesson}",
                    ).replace("{lesson}", lessonTitle)}
                </h1>
            </header>

            <ProgressBar
                valueNow={progressPct}
                ariaLabel={t("lesson.progress.aria_label", "Lesson progress")}
                className="lesson-progress-bar"
                fillClassName="lesson-progress-fill"
                labelClassName="lesson-progress-label"
                testId="error-replay-progress-bar"
            >
                {isSummary
                    ? t("lesson.progress.summary", "Summary")
                    : t("lesson.progress.step_of", "Step {current} of {total}")
                          .replace("{current}", String(index + 1))
                          .replace("{total}", String(total))}
            </ProgressBar>

            {isSummary ? (
                <ErrorReplaySummary
                    correct={correctNow}
                    total={total}
                    stillWrong={stillWrong.length}
                    onRetry={retryStillWrong}
                    onDone={backToLesson}
                />
            ) : (
                <ErrorReplayExercise
                    step={step!}
                    setId={setId}
                    filename={filename}
                    cards={cards}
                    exerciseRef={exerciseRef}
                    onInteraction={setAnswerable}
                    onChecked={() => setChecked(true)}
                    onResult={(exerciseId, correct) =>
                        setResults((prev) => ({...prev, [exerciseId]: correct}))
                    }
                />
            )}

            <ErrorReplayNav
                isSummary={isSummary}
                isExerciseStep={isExerciseStep}
                checked={checked}
                answerable={answerable}
                isLast={index + 1 === total}
                onCheck={() => exerciseRef.current?.submit()}
                onNext={() => setIndex((i) => i + 1)}
                t={t}
            />
        </main>
    );
}

interface ErrorReplayExerciseProps {
    step: ContentLessonStep;
    setId: string;
    filename: string;
    cards: ContentLessonCard[];
    exerciseRef: Ref<ExerciseHandle>;
    onInteraction: (answerable: boolean) => void;
    onChecked: () => void;
    onResult: (exerciseId: string, correct: boolean) => void;
}

/** The active replay exercise step: the controlled ExerciseDispatcher
 *  wrapped in the lesson-step article. On completion it flips to the
 *  "Weiter" phase and records whether the exercise was fully correct
 *  this round. */
function ErrorReplayExercise({
    step,
    setId,
    filename,
    cards,
    exerciseRef,
    onInteraction,
    onChecked,
    onResult,
}: ErrorReplayExerciseProps) {
    return (
        <article
            className="lesson-step"
            data-testid={`error-replay-step-${step.id}`}
            data-step-type="exercise"
        >
            <ExerciseDispatcher
                key={step.id}
                ref={exerciseRef}
                controlled
                onInteraction={onInteraction}
                step={step}
                setId={setId}
                lessonId={filename}
                cards={cards}
                onComplete={async (scored: ExerciseScored) => {
                    onChecked();
                    onResult(step.exercise!.id, scored.correct === scored.total);
                }}
            />
        </article>
    );
}

interface ErrorReplayNavProps {
    isSummary: boolean;
    isExerciseStep: boolean;
    checked: boolean;
    answerable: boolean;
    isLast: boolean;
    onCheck: () => void;
    onNext: () => void;
    t: Translate;
}

/** Step navigation footer for the replay: the single two-phase
 *  Check/Next button (no "Previous"; hidden entirely on the summary). */
function ErrorReplayNav({
    isSummary,
    isExerciseStep,
    checked,
    answerable,
    isLast,
    onCheck,
    onNext,
    t,
}: ErrorReplayNavProps) {
    if (isSummary) return null;
    return (
        <nav
            className="lesson-nav"
            aria-label={t("lesson.nav.aria_label", "Step navigation")}
        >
            {isExerciseStep && !checked ? (
                <Button
                    type="button"
                    className="lesson-nav-check"
                    onClick={onCheck}
                    disabled={!answerable}
                    title={
                        !answerable
                            ? t(
                                  "lesson.button.check_disabled_hint",
                                  "Answer the exercise first",
                              )
                            : undefined
                    }
                    data-testid="error-replay-check"
                >
                    {t("lesson.button.check", "Check")}
                </Button>
            ) : (
                <Button
                    type="button"
                    className="lesson-nav-next"
                    onClick={onNext}
                    data-testid="error-replay-next"
                >
                    {isLast
                        ? t("lesson.action.finish", "Finish lesson")
                        : t("lesson.action.next", "Next")}
                    <ArrowRight size={14} aria-hidden="true" />
                </Button>
            )}
        </nav>
    );
}

interface ErrorReplaySummaryProps {
    correct: number;
    total: number;
    stillWrong: number;
    onRetry: () => void;
    onDone: () => void;
}

function ErrorReplaySummary({
    correct,
    total,
    stillWrong,
    onRetry,
    onDone,
}: ErrorReplaySummaryProps) {
    const {t} = useI18n();
    const allCorrected = stillWrong === 0;
    const [showConfetti, setShowConfetti] = useState(
        () => allCorrected && !prefersReducedMotion(),
    );

    return (
        <section
            className={`lesson-summary${allCorrected ? " is-celebrating" : ""}`}
            data-testid="error-replay-summary"
            data-all-corrected={allCorrected ? "true" : "false"}
            aria-label={t(
                "lesson.error_replay.summary_aria",
                "Retry errors summary",
            )}
        >
            {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
            <h2>
                {allCorrected ? (
                    <>
                        <PartyPopper size={20} aria-hidden="true" />{" "}
                        {t(
                            "lesson.next_step.errors_corrected",
                            "All errors corrected!",
                        )}
                    </>
                ) : (
                    t("lesson.error_replay.heading", "Retry complete")
                )}
            </h2>
            <p
                className="error-replay-summary-score"
                data-testid="error-replay-summary-score"
            >
                {t("lesson.error_replay.score", "{correct}/{total} correct now!")
                    .replace("{correct}", String(correct))
                    .replace("{total}", String(total))}
            </p>
            <div className="lesson-summary-actions">
                {allCorrected ? (
                    <Button
                        type="button"
                        onClick={onDone}
                        data-testid="error-replay-summary-done"
                    >
                        {t("lesson.error_replay.done", "Back to lesson")}
                    </Button>
                ) : (
                    <>
                        <Button
                            type="button"
                            onClick={onRetry}
                            data-testid="error-replay-summary-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.next_step.still_errors",
                                "Still {count} errors. Try again?",
                            ).replace("{count}", String(stillWrong))}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onDone}
                            data-testid="error-replay-summary-done"
                        >
                            {t("lesson.error_replay.done", "Back to lesson")}
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
}
