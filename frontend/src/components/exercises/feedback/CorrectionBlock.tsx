/**
 * CorrectionBlock — generated cloze drills at lesson end
 * (Phase 52F / v1.35.0 / P-128, F-113).
 *
 * Walks the just-finished lesson's ``ElementError`` records, synthesises
 * a Cloze exercise for each non-mastered failure via the Phase 52E
 * generator, and runs the user through up to ``maxClozes`` of them
 * before they advance to the next lesson. Each completed cloze writes
 * fresh ``ElementAttempt`` rows so SRS streak + mastery tracking
 * advances against the SAME element_key the original failure was
 * recorded against.
 *
 * Surface contract (Decision 5 / handover § 4):
 *   - Only renders when at least one error record exists for the
 *     just-finished lesson AND at least one of them produces a
 *     generated cloze. Perfect-score lessons OR error-only-but-no-
 *     generator-applicable lessons skip the block entirely.
 *   - Sits BETWEEN the score display and the action-button row in
 *     the LessonSummary surface.
 *   - The "Next lesson" button at the parent level stays visible
 *     throughout the correction round; users can skip it at any
 *     time and lose nothing (the original attempts are already
 *     persisted by the lesson; the correction round is the OPT-IN
 *     improvement pass).
 *
 * Best-effort: if any IO fails (loading errors, recording bulk),
 * the user keeps their position and the block degrades to "skip
 * available" — never a hard error toast at the celebration moment.
 */

import {ChevronRight, X} from "lucide-react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonShortcuts} from "../../../hooks/lesson/interaction/useLessonShortcuts";
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../../../hooks/lesson/interaction/useLessonEnterKey";
import {generateClozeFromError} from "../../../lib/exercises/grading/cloze-generator";
import {getStorage} from "../../../storage";
import type {
    ContentLesson,
    ContentLessonExercise,
    ElementAttempt,
    ElementError,
    LessonProgress,
} from "../../../storage/types";
import type {ExerciseHandle} from "../shell/exercise-control";
import ClozeExercise from "../renderers/ClozeExercise";

export interface CorrectionBlockProps {
    lesson: ContentLesson;
    progress: LessonProgress;
    userId: string;
    setId: string;
    lessonFilename: string;
    /** Max number of clozes to surface. Defaults to 5; the cap keeps
     *  the celebration moment from devolving into a slog when the
     *  user got a lot wrong. */
    maxClozes?: number;
    /** Called when the user finishes all generated clozes. ``improved``
     *  is the count of clozes the user got right (= the count of
     *  elements whose mastery streak advanced). */
    onComplete: (improved: number) => void;
    /** Called when the user skips. The parent re-shows the action
     *  row so the user can still advance to the next lesson. */
    onSkip: () => void;
}

interface PreparedCloze {
    exercise: ContentLessonExercise;
    sourceError: ElementError;
}

type Status = "loading" | "ready" | "active" | "complete" | "empty";

export default function CorrectionBlock({
    lesson,
    progress,
    userId,
    setId,
    lessonFilename,
    maxClozes = 5,
    onComplete,
    onSkip,
}: CorrectionBlockProps) {
    const {t} = useI18n();
    const [status, setStatus] = useState<Status>("loading");
    const [clozes, setClozes] = useState<PreparedCloze[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);

    // #187 — Enter-key shortcut, identical to the lesson + error-replay
    // runners. The cloze runs CONTROLLED (ref + onInteraction) so an
    // external "Check answers" button drives it and Enter checks the
    // answered cloze via the shared hook. ``answerable`` mirrors the
    // cloze's "all blanks filled" state; ``enterLockRef`` blocks a double
    // check between submit() and the advance, reset on each cloze.
    const exerciseRef = useRef<ExerciseHandle>(null);
    const lessonShortcutsEnabled = useLessonShortcuts();
    const enterStateRef = useRef<LessonEnterNav | null>(null);
    const enterLockRef = useRef(false);
    const [answerable, setAnswerable] = useState(false);
    useEffect(() => {
        setAnswerable(false);
        enterLockRef.current = false;
    }, [currentIndex]);

    // Filter step_results for wrong attempts. Used to short-circuit
    // the IO call when the lesson was a perfect score.
    const hasWrongAttempts = useMemo(() => {
        const stepResults = progress.step_results ?? {};
        return Object.values(stepResults).some(
            (sr) => sr.total > 0 && sr.correct < sr.total,
        );
    }, [progress.step_results]);

    useEffect(() => {
        let cancelled = false;
        if (!hasWrongAttempts || !userId) {
            setStatus("empty");
            return;
        }
        (async () => {
            try {
                const errors = await getStorage().elementErrors.list(
                    userId,
                    {setId},
                );
                if (cancelled) return;
                // Restrict to this lesson + non-mastered + recently-erred.
                const lessonErrors = errors.filter(
                    (e) =>
                        e.lesson_id === lessonFilename &&
                        !e.mastered,
                );
                // Synthesise a cloze per error; null results fall
                // through silently (generator's documented graceful-
                // degradation contract). Cap at maxClozes.
                const prepared: PreparedCloze[] = [];
                for (const err of lessonErrors) {
                    if (prepared.length >= maxClozes) break;
                    const sourceExercise = _findSourceExercise(
                        lesson,
                        err.exercise_id,
                    );
                    if (!sourceExercise) continue;
                    const sourceCard =
                        lesson.cards.find(
                            (c) => c.id === err.element_key,
                        ) ??
                        // Fallback: look for any card referenced by the source exercise
                        lesson.cards.find((c) =>
                            sourceExercise.card_ids.includes(c.id),
                        ) ??
                        null;
                    const cloze = generateClozeFromError({
                        error: err,
                        sourceExercise,
                        sourceCard,
                    });
                    if (!cloze) continue;
                    prepared.push({exercise: cloze, sourceError: err});
                }
                if (cancelled) return;
                setClozes(prepared);
                setStatus(prepared.length === 0 ? "empty" : "ready");
            } catch {
                if (cancelled) return;
                // Best-effort: any IO failure hides the block. The
                // user still gets Next-Lesson at the parent level.
                setStatus("empty");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        userId,
        setId,
        lessonFilename,
        lesson,
        maxClozes,
        hasWrongAttempts,
    ]);

    const persistAttempts = useCallback(
        async (attempts: ElementAttempt[]) => {
            if (attempts.length === 0) return;
            try {
                await getStorage().elementErrors.recordBulk(
                    userId,
                    attempts,
                );
            } catch {
                // Non-blocking — the user sees their result locally,
                // SRS just doesn't advance on the failure case.
            }
        },
        [userId],
    );

    const handleClozeComplete = useCallback(
        async (scored: {
            correct: number;
            total: number;
            attempts: ElementAttempt[];
        }) => {
            await persistAttempts(scored.attempts);
            if (scored.correct === scored.total && scored.total > 0) {
                setCorrectCount((c) => c + 1);
            }
            const next = currentIndex + 1;
            if (next >= clozes.length) {
                setStatus("complete");
                onComplete(
                    scored.correct === scored.total && scored.total > 0
                        ? correctCount + 1
                        : correctCount,
                );
            } else {
                setCurrentIndex(next);
            }
        },
        [
            persistAttempts,
            currentIndex,
            clozes.length,
            correctCount,
            onComplete,
        ],
    );

    const handleSkip = useCallback(() => {
        setStatus("complete");
        onSkip();
    }, [onSkip]);

    // Refresh the Enter-decision state every render (no re-subscribe);
    // the listener reads it through the ref. A cloze is "active" only
    // in the ready/active status; otherwise the state reads as a summary
    // so Enter is a no-op. The cloze auto-advances on submit, so there
    // is no separate "Next" step here — ``goNext`` is unused.
    const clozeActive = status === "ready" || status === "active";
    enterStateRef.current = {
        isSummary: !clozeActive,
        isExerciseStep: clozeActive,
        checked: false,
        enteredReviewed: false,
        answerable,
        goNext: () => {},
    };
    useLessonEnterKey({
        enabled: lessonShortcutsEnabled,
        exerciseRef,
        enterStateRef,
        enterLockRef,
    });

    if (status === "loading" || status === "empty") {
        return null;
    }

    if (status === "complete") {
        const message =
            correctCount === 1
                ? t(
                      "lesson.correction.improvement_singular",
                      "{n} element improved.",
                  ).replace("{n}", String(correctCount))
                : t(
                      "lesson.correction.improvement",
                      "{n} elements improved.",
                  ).replace("{n}", String(correctCount));
        return (
            <section
                className="lesson-correction-block lesson-correction-block-complete"
                data-testid="lesson-correction-block"
                data-status="complete"
                aria-label={t(
                    "lesson.correction.complete_heading",
                    "Correction round complete",
                )}
            >
                <h3>
                    {t(
                        "lesson.correction.complete_heading",
                        "Correction round complete",
                    )}
                </h3>
                <p data-testid="lesson-correction-improvement">
                    {message}
                </p>
            </section>
        );
    }

    const current = clozes[currentIndex];

    return (
        <section
            className="lesson-correction-block"
            data-testid="lesson-correction-block"
            data-status={status}
            data-cloze-index={String(currentIndex)}
            data-cloze-total={String(clozes.length)}
            aria-label={t(
                "lesson.correction.title",
                "Correction round",
            )}
        >
            <header className="lesson-correction-block-header">
                <h3>
                    {t(
                        "lesson.correction.title",
                        "Correction round",
                    )}{" "}
                    <span className="lesson-correction-block-progress">
                        ({currentIndex + 1} / {clozes.length})
                    </span>
                </h3>
                <p className="lesson-correction-block-subtitle">
                    {t(
                        "lesson.correction.subtitle",
                        "A few quick drills on the words you missed.",
                    )}
                </p>
                <button
                    type="button"
                    className="btn btn-text lesson-correction-block-skip"
                    onClick={handleSkip}
                    data-testid="lesson-correction-block-skip"
                >
                    <X size={14} aria-hidden="true" />
                    {t("lesson.correction.skip", "Skip")}
                    <ChevronRight size={14} aria-hidden="true" />
                </button>
            </header>
            <ClozeExercise
                key={current.exercise.id}
                ref={exerciseRef}
                controlled
                onInteraction={setAnswerable}
                exercise={current.exercise}
                setId={setId}
                lessonId={lessonFilename}
                onComplete={(scored) => {
                    void handleClozeComplete(scored);
                }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    disabled={!answerable}
                    onClick={() => exerciseRef.current?.submit()}
                    data-testid="lesson-correction-block-check"
                >
                    {t("lesson.exercise.cloze.submit", "Check answers")}
                </Button>
            </div>
        </section>
    );
}

function _findSourceExercise(
    lesson: ContentLesson,
    exerciseId: string,
): ContentLessonExercise | null {
    for (const step of lesson.steps) {
        if (step.exercise?.id === exerciseId) {
            return step.exercise;
        }
    }
    return null;
}
