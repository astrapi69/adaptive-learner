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
 * #2496 — this is now the SINGLE "your mistakes" section on the
 * summary. It lands COLLAPSED (a "Fix your mistakes (N)" card with a
 * "Fix now" button); expanding is the user's explicit opt-in and only
 * THEN does the cloze mount and take focus — so the mobile keyboard no
 * longer pops the moment the summary appears. The full-replay path
 * (redo the exact failed exercises, any type) is folded in as a
 * secondary "Redo all exercises" CTA, retiring the standalone
 * ``NextStepSuggestions`` error-replay card so the two no longer
 * duplicate each other.
 *
 * Surface contract (Decision 5 / handover § 4, revised #2496):
 *   - Renders when the just-finished lesson has open failures — either
 *     a generated cloze drill OR a replayable set (``replayHref`` +
 *     ``errorCount``). Perfect-score runs skip the section entirely.
 *   - When every originally-failed exercise is already corrected it
 *     shows a short success note instead (folded #1372 all-corrected).
 *   - Sits BETWEEN the score display and the action-button row in
 *     the LessonSummary surface.
 *   - The "Next lesson" button at the parent level stays visible
 *     throughout; users can ignore or skip the section at any time and
 *     lose nothing (the original attempts are already persisted by the
 *     lesson; this is the OPT-IN improvement pass).
 *
 * Best-effort: if any IO fails (loading errors, recording bulk),
 * the user keeps their position and the block degrades to "skip
 * available" — never a hard error toast at the celebration moment.
 */

import {ArrowRight, CheckCircle2, ChevronDown, ChevronRight, X} from "lucide-react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link} from "react-router";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonShortcuts} from "../../../hooks/lesson/interaction/useLessonShortcuts";
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../../../hooks/lesson/interaction/useLessonEnterKey";
import {generateClozeFromError} from "../../../lib/exercises/grading/cloze-generator";
import type {ErrorReplayPayload} from "../../../lib/lesson/error-replay";
import {notifyReviewsChanged} from "../../../lib/review/reviewsChanged";
import {resolveCorrectionSourceCard} from "./correction-source-card";
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
    /** #2496 — the full-replay ("redo the exact exercises") folded into
     *  this single mistakes section. ``replayHref`` is the ErrorReplay
     *  route; ``replayState`` its router-state payload. Null when there
     *  is nothing left to replay (clean run or every error corrected). */
    replayHref?: string | null;
    replayState?: ErrorReplayPayload | null;
    /** #2496 — exercises the learner FAILED and still has open, mirrored
     *  from ``useNextStepSuggestions``. Drives the collapsed count and
     *  whether the full replay is offered. */
    errorCount?: number;
    /** #1372 — of the originally-failed exercises, how many are already
     *  corrected (live SRS). Drives the "{corrected} von {total}" note. */
    correctedCount?: number;
    /** #1372 — every originally-failed exercise is now corrected: show a
     *  short success note instead of a drill or a replay CTA. */
    allCorrected?: boolean;
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
    replayHref = null,
    replayState = null,
    errorCount = 0,
    correctedCount = 0,
    allCorrected = false,
}: CorrectionBlockProps) {
    const {t} = useI18n();
    const [status, setStatus] = useState<Status>("loading");
    const [clozes, setClozes] = useState<PreparedCloze[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    // #2496 — the section lands COLLAPSED on the summary. Mounting the cloze
    // eagerly auto-focuses its first blank (ClozeExercise #692) and pops the
    // mobile keyboard, covering the score the moment the user arrives.
    // Collapsed, no input exists to grab focus; expanding is the user's
    // explicit opt-in and only THEN does the cloze mount and take focus.
    const [expanded, setExpanded] = useState(false);

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
                    const sourceCard = resolveCorrectionSourceCard(
                        lesson,
                        sourceExercise,
                        err.element_key,
                    );
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
                // #2479 — the SRS state changed, so the lesson summary's live
                // ElementError read (useLessonSessionErrors) must refresh: the
                // correction-adjusted score bar + the "Fehler wiederholen"
                // open-count both depend on it. Mirrors the notify the
                // error-replay / review runners already fire.
                notifyReviewsChanged();
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
    // when the section is EXPANDED and in the ready/active status;
    // otherwise the state reads as a summary so Enter is a no-op (and
    // never fires while the section is collapsed). The cloze auto-advances
    // on submit, so there is no separate "Next" step — ``goNext`` is unused.
    const clozeActive =
        expanded && (status === "ready" || status === "active");
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

    // Still preparing the clozes: wait so the section appears at the same
    // moment as the rest of the summary rather than flashing an empty shell.
    if (status === "loading") {
        return null;
    }

    const hasReplay = Boolean(replayHref) && errorCount > 0;
    const drillsAvailable =
        (status === "ready" || status === "active") && clozes.length > 0;
    const drillsDone = status === "complete";
    // Collapsed-header count: open failed exercises, falling back to the
    // generated-drill count on the (defensive) chance the exercise-level
    // count was not supplied.
    const mistakeCount = errorCount > 0 ? errorCount : clozes.length;

    const correctedNote =
        correctedCount > 0
            ? t(
                  "lesson.next_step.error_replay_corrected",
                  "{corrected} of {total} corrected",
              )
                  .replace("{corrected}", String(correctedCount))
                  .replace("{total}", String(correctedCount + errorCount))
            : null;

    // #2496 — the full-replay CTA, folded in from the retired standalone
    // next-step card (redo the EXACT failed exercises, all types).
    const replayLink =
        hasReplay && replayHref ? (
            <Button asChild variant="secondary">
                <Link
                    to={replayHref}
                    state={replayState ?? undefined}
                    data-testid="lesson-correction-replay"
                >
                    {t(
                        "lesson.correction.replay_all",
                        "Redo all exercises ({count})",
                    ).replace("{count}", String(errorCount))}
                    <ArrowRight size={16} aria-hidden="true" />
                </Link>
            </Button>
        ) : null;

    // Every originally-failed exercise already corrected — nothing left to
    // drill or replay: a short success note (mirrors the retired #1372 card).
    if (allCorrected && !drillsAvailable && !hasReplay && !drillsDone) {
        return (
            <section
                className="lesson-correction-block lesson-correction-block-complete"
                data-testid="lesson-correction-block"
                data-status="complete"
                data-expanded="true"
                aria-label={t(
                    "lesson.next_step.all_corrected",
                    "All errors corrected!",
                )}
            >
                <h3>
                    <CheckCircle2 size={18} aria-hidden="true" />{" "}
                    {t(
                        "lesson.next_step.all_corrected",
                        "All errors corrected!",
                    )}
                </h3>
                <p data-testid="lesson-correction-improvement">
                    {t(
                        "lesson.next_step.all_corrected_detail",
                        "Nice - no open errors left.",
                    )}
                </p>
            </section>
        );
    }

    // Finished the inline drills: the improvement note, plus the full-replay
    // CTA when errors remain that no generated cloze covered.
    if (drillsDone) {
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
                data-expanded="true"
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
                <p data-testid="lesson-correction-improvement">{message}</p>
                {replayLink && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {replayLink}
                    </div>
                )}
            </section>
        );
    }

    // Nothing actionable (no drills, no replay) and not a success state.
    if (!drillsAvailable && !hasReplay) {
        return null;
    }

    // COLLAPSED shell (default) — the single opt-in "your mistakes" entry.
    // Collapsed there is no input to grab focus, so no mobile keyboard pops.
    if (!expanded) {
        return (
            <section
                className="lesson-correction-block lesson-correction-block-collapsed"
                data-testid="lesson-correction-block"
                data-status={status}
                data-expanded="false"
                aria-label={t(
                    "lesson.correction.mistakes_heading",
                    "Fix your mistakes",
                )}
            >
                <header className="lesson-correction-block-header">
                    <h3>
                        {t(
                            "lesson.correction.mistakes_heading",
                            "Fix your mistakes",
                        )}{" "}
                        <span className="lesson-correction-block-progress">
                            ({mistakeCount})
                        </span>
                    </h3>
                    <p className="lesson-correction-block-subtitle">
                        {t(
                            "lesson.correction.subtitle",
                            "A few quick drills on the words you missed.",
                        )}
                    </p>
                    {correctedNote && (
                        <p
                            className="lesson-correction-block-corrected"
                            data-testid="lesson-correction-corrected"
                        >
                            {correctedNote}
                        </p>
                    )}
                </header>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        onClick={() => setExpanded(true)}
                        data-testid="lesson-correction-block-expand"
                    >
                        {t("lesson.correction.expand", "Fix now")}
                        <ChevronDown size={16} aria-hidden="true" />
                    </Button>
                </div>
            </section>
        );
    }

    // EXPANDED — the drill (if any generated cloze exists) + the full-replay
    // CTA. The cloze mounts HERE, so its #692 auto-focus (and the mobile
    // keyboard) fire only now, on the user's explicit opt-in.
    const current = drillsAvailable ? clozes[currentIndex] : null;

    return (
        <section
            className="lesson-correction-block"
            data-testid="lesson-correction-block"
            data-status={status}
            data-expanded="true"
            data-cloze-index={String(currentIndex)}
            data-cloze-total={String(clozes.length)}
            aria-label={t(
                "lesson.correction.mistakes_heading",
                "Fix your mistakes",
            )}
        >
            <header className="lesson-correction-block-header">
                <h3>
                    {t(
                        "lesson.correction.mistakes_heading",
                        "Fix your mistakes",
                    )}{" "}
                    {drillsAvailable && (
                        <span className="lesson-correction-block-progress">
                            ({currentIndex + 1} / {clozes.length})
                        </span>
                    )}
                </h3>
                <p className="lesson-correction-block-subtitle">
                    {t(
                        "lesson.correction.subtitle",
                        "A few quick drills on the words you missed.",
                    )}
                </p>
                {drillsAvailable && (
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
                )}
            </header>
            {current && (
                <>
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
                </>
            )}
            {replayLink && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {replayLink}
                </div>
            )}
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
