/**
 * /review/:setId — SRS review session
 * (Phase 46D / C15 / P-129).
 *
 * Lightweight page that walks the user through a synthesised
 * mini-lesson built from the SRS review queue for the
 * requested setId. Reuses the shared ExerciseDispatcher
 * (Phase 46D extract commit) so the four exercise renderers
 * are exactly the same as in the main viewer — only the
 * lesson source + summary screen differ.
 *
 * Review sessions are ephemeral: no LessonProgress row, no
 * step_results persistence. ElementError rows DO get
 * updated on every attempt via the same recordBulk path the
 * main viewer uses (so a wrong answer here re-increments
 * error_count + last_error_at; a correct answer grows
 * correct_streak → eventually masters the element).
 *
 * Dexie-mode-friendly: ``useReviewLesson`` routes through
 * ``getStorage()`` so GH-Pages users get the full feature
 * without a backend roundtrip.
 */

import {ArrowLeft, BookOpen, Download} from "lucide-react";
import {useEffect, useRef, useState, type ReactElement, type Ref} from "react";
import {
    useNavigate,
    useParams,
    type NavigateFunction,
} from "react-router-dom";

import {
    ExerciseDispatcher,
    SUPPORTED_EXERCISE_TYPES,
} from "../components/exercises/ExerciseDispatcher";
import type {
    ExerciseHandle,
    ExerciseScored,
} from "../components/exercises/exercise-control";
import {Button} from "@/components/ui/button";
import ProgressBar from "../shared/ProgressBar";
import LessonStepNav from "../shared/LessonStepNav";
import {useI18n} from "../hooks/useI18n";
import {useReviewLesson} from "../hooks/useReviewLesson";
import ReviewSummaryView from "../shared/ReviewSummary";
import type {
    ContentLesson,
    ContentLessonStep,
    ElementAttempt,
} from "../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

export default function ReviewPage() {
    const params = useParams<UrlParams>();
    const navigate = useNavigate();
    const {t} = useI18n();
    const setId = params.setId ?? "";

    const {
        status,
        lesson,
        queue,
        currentStepIndex,
        error,
        goNext,
        goPrev,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
    } = useReviewLesson({
        setId,
        title: t("review.session_title", "Review session"),
        // #603 — a focused, finishable session: at most 20 elements,
        // the weakest + oldest first (the queue already prioritises).
        limit: 20,
    });

    // BUG P1 — single two-phase button (Check -> Weiter). The exercise
    // renders in controlled mode (its internal "Prüfen"/retry buttons
    // are hidden) and the page drives one shared button via the ref, so
    // the exercise's submit and the page's "Weiter" never both show.
    const exerciseRef = useRef<ExerciseHandle>(null);
    const [checked, setChecked] = useState(false);
    const [answerable, setAnswerable] = useState(false);
    // Reset the two-phase button whenever the step changes.
    useEffect(() => {
        setChecked(false);
        setAnswerable(false);
    }, [currentStepIndex]);

    const statusScreen = renderReviewStatus(setId, status, navigate, t);
    if (statusScreen) return statusScreen;

    if (status === "error" || lesson === null) {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="review-error"
            >
                <p>
                    {t("review.error.load_failed", "Could not load review session.")}
                    {error ? ` (${error})` : ""}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("review.back_to_dashboard", "Back to Dashboard")}
                </Button>
            </main>
        );
    }

    const totalSteps = lesson.steps.length;
    const isSummary = currentStepIndex >= totalSteps;
    const step = isSummary ? null : lesson.steps[currentStepIndex];
    const isExerciseStep =
        step != null &&
        step.type === "exercise" &&
        step.exercise != null &&
        SUPPORTED_EXERCISE_TYPES.has(step.exercise.type);
    const progressPct =
        totalSteps === 0
            ? 100
            : Math.round((currentStepIndex / totalSteps) * 100);

    return (
        <main
            id="main"
            className="page lesson-page"
            data-testid="review-page"
        >
            <header className="lesson-header">
                <button
                    type="button"
                    className="lesson-back-btn"
                    onClick={() => navigate("/dashboard")}
                    data-testid="review-back-btn"
                    aria-label={t(
                        "review.back_to_dashboard",
                        "Back to Dashboard",
                    )}
                >
                    <BookOpen size={16} aria-hidden="true" />
                    {t("review.back_to_dashboard", "Back to Dashboard")}
                </button>
                <h1>{lesson.title}</h1>
                <p className="lesson-description">
                    {t(
                        "review.subtitle",
                        "Reviewing {n} element(s) due for SRS",
                    ).replace("{n}", String(queue.length))}
                </p>
            </header>

            <ProgressBar
                valueNow={progressPct}
                ariaLabel={t("lesson.progress.aria_label", "Lesson progress")}
                className="lesson-progress-bar"
                fillClassName="lesson-progress-fill"
                labelClassName="lesson-progress-label"
                testId="review-progress-bar"
            >
                {isSummary
                    ? t("lesson.progress.summary", "Summary")
                    : t("lesson.progress.step_of", "Step {current} of {total}")
                          .replace("{current}", String(currentStepIndex + 1))
                          .replace("{total}", String(totalSteps))}
            </ProgressBar>

            {isSummary ? (
                <ReviewSummary
                    correct={sessionScoreCorrect}
                    total={sessionScoreTotal}
                    onExit={() => navigate("/dashboard")}
                />
            ) : (
                <ReviewExercise
                    step={step!}
                    setId={setId}
                    cards={lesson.cards ?? []}
                    exerciseRef={exerciseRef}
                    onInteraction={setAnswerable}
                    onChecked={() => setChecked(true)}
                    recordStepAttempts={recordStepAttempts}
                />
            )}

            <LessonStepNav
                testIdPrefix="review"
                isSummary={isSummary}
                isExerciseStep={isExerciseStep}
                checked={checked}
                answerable={answerable}
                isFirstStep={currentStepIndex === 0}
                isLastStep={currentStepIndex + 1 === totalSteps}
                onPrev={goPrev}
                onNext={goNext}
                onCheck={() => exerciseRef.current?.submit()}
                labels={{
                    navAria: t("lesson.nav.aria_label", "Step navigation"),
                    prev: t("lesson.action.prev", "Previous"),
                    check: t("lesson.button.check", "Check"),
                    checkDisabledHint: t(
                        "lesson.button.check_disabled_hint",
                        "Answer the exercise first",
                    ),
                    next: t("lesson.action.next", "Next"),
                    finish: t("lesson.action.finish", "Finish lesson"),
                }}
            />
        </main>
    );
}

/** Render the non-playing status screen for a review session
 *  (missing param / loading / empty / not-cached), or ``null`` once a
 *  playable session is ready. The ``error`` / ``lesson === null`` case
 *  stays inline in the page so TypeScript narrows ``lesson``. */
function renderReviewStatus(
    setId: string,
    status: string,
    navigate: NavigateFunction,
    t: Translate,
): ReactElement | null {
    if (!setId) {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="review-missing-params"
            >
                <h1>{t("review.page_title", "Review")}</h1>
                <p>
                    {t(
                        "review.error.missing_params",
                        "No content set selected.",
                    )}
                </p>
            </main>
        );
    }
    if (status === "loading") {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="review-loading"
            >
                <p>{t("review.loading", "Loading review session…")}</p>
            </main>
        );
    }
    if (status === "empty") {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="review-empty"
            >
                <header className="lesson-header">
                    <h1>{t("review.page_title", "Review")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "review.empty_body",
                        "All caught up! No elements due for review in this set.",
                    )}
                </p>
                <p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/dashboard")}
                        data-testid="review-back-to-dashboard"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t("review.back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </p>
            </main>
        );
    }
    if (status === "not-cached") {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="review-not-cached"
            >
                <header className="lesson-header">
                    <h1>{t("review.page_title", "Review")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "review.not_cached_body",
                        "This set isn't downloaded yet. Open the content browser to download it first.",
                    )}
                </p>
                <p>
                    <Button
                        type="button"
                        onClick={() => navigate("/content")}
                        data-testid="review-goto-content"
                    >
                        <Download size={14} aria-hidden="true" />
                        {t("lesson.action.open_browser", "Open content browser")}
                    </Button>
                </p>
            </main>
        );
    }
    return null;
}

interface ReviewExerciseProps {
    step: ContentLessonStep;
    setId: string;
    cards: ContentLesson["cards"];
    exerciseRef: Ref<ExerciseHandle>;
    onInteraction: (answerable: boolean) => void;
    onChecked: () => void;
    recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
}

/** The active review exercise step: the controlled ExerciseDispatcher
 *  wrapped in the lesson-step article. The synthesized step id embeds
 *  the source lesson_id ("review-{lesson_id}-{exercise_id}-
 *  {element_key}"); ``_extractLessonId`` parses it back out so the
 *  element-attempt deriver stamps the right lesson_id. */
function ReviewExercise({
    step,
    setId,
    cards,
    exerciseRef,
    onInteraction,
    onChecked,
    recordStepAttempts,
}: ReviewExerciseProps) {
    return (
        <article
            className="lesson-step"
            data-testid={`review-step-${step.id}`}
            data-step-type={step.type}
        >
            <ExerciseDispatcher
                key={step.id}
                ref={exerciseRef}
                controlled
                onInteraction={onInteraction}
                step={step}
                setId={setId}
                cards={cards}
                lessonId={_extractLessonId(step.id)}
                onComplete={async (scored: ExerciseScored) => {
                    // Flip to the "Weiter" phase the moment the answer
                    // is graded, then record attempts.
                    onChecked();
                    await recordStepAttempts(scored.attempts);
                }}
            />
        </article>
    );
}

/** Parse the lesson_id back out of a synthesised step id
 *  produced by ``synthesizeReviewLesson`` —
 *  ``"review-{lesson_id}-{exercise_id}-{element_key}"``.
 *  The exercise_id + element_key are both slug-safe so the
 *  last two hyphen-separated tokens are unambiguous; the
 *  middle is the lesson_id. */
function _extractLessonId(stepId: string): string {
    // Strip the "review-" prefix.
    if (!stepId.startsWith("review-")) return "";
    const remainder = stepId.slice("review-".length);
    // Find the last two hyphens for exercise_id + element_key.
    const lastDash = remainder.lastIndexOf("-");
    if (lastDash <= 0) return remainder;
    const secondLastDash = remainder.lastIndexOf("-", lastDash - 1);
    if (secondLastDash <= 0) return remainder;
    return remainder.slice(0, secondLastDash);
}

interface ReviewSummaryProps {
    correct: number;
    total: number;
    onExit: () => void;
}

function ReviewSummary({correct, total, onExit}: ReviewSummaryProps) {
    const {t} = useI18n();
    return (
        <ReviewSummaryView
            heading={t("review.summary.heading", "Review complete")}
            corrected={correct}
            total={total}
            correctedLabel={t(
                "review.summary_corrected",
                "{corrected} of {total} corrected",
            )
                .replace("{corrected}", String(correct))
                .replace("{total}", String(total))}
            trendLabel={
                correct > 0
                    ? t(
                          "review.summary_trend",
                          "Nice — your weak spots are getting stronger.",
                      )
                    : undefined
            }
            nextReviewLabel={t(
                "review.summary_next",
                "Mastered items drop out; the rest return for review soon.",
            )}
            exitLabel={t("review.back_to_dashboard", "Back to Dashboard")}
            onExit={onExit}
            testId="review-summary"
        >
            <p className="review-summary-note">
                {t(
                    "review.summary.note",
                    "Element scores have been updated. Mastered elements will not appear in the next session.",
                )}
            </p>
        </ReviewSummaryView>
    );
}
