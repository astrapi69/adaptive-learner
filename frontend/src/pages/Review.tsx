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

import {ArrowLeft, ArrowRight, BookOpen, Download} from "lucide-react";
import {useNavigate, useParams} from "react-router-dom";

import {ExerciseDispatcher} from "../components/exercises/ExerciseDispatcher";
import {useI18n} from "../hooks/useI18n";
import {useReviewLesson} from "../hooks/useReviewLesson";

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
    });

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
                    <button
                        type="button"
                        className="btn"
                        onClick={() => navigate("/dashboard")}
                        data-testid="review-back-to-dashboard"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t(
                            "review.back_to_dashboard",
                            "Back to Dashboard",
                        )}
                    </button>
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
                    <button
                        type="button"
                        className="btn"
                        onClick={() => navigate("/content")}
                        data-testid="review-goto-content"
                    >
                        <Download size={14} aria-hidden="true" />
                        {t(
                            "lesson.action.open_browser",
                            "Open content browser",
                        )}
                    </button>
                </p>
            </main>
        );
    }

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
                <button
                    type="button"
                    className="btn"
                    onClick={() => navigate("/dashboard")}
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("review.back_to_dashboard", "Back to Dashboard")}
                </button>
            </main>
        );
    }

    const totalSteps = lesson.steps.length;
    const isSummary = currentStepIndex >= totalSteps;
    const step = isSummary ? null : lesson.steps[currentStepIndex];
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

            <div
                className="lesson-progress-bar"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(
                    "lesson.progress.aria_label",
                    "Lesson progress",
                )}
                data-testid="review-progress-bar"
            >
                <div
                    className="lesson-progress-fill"
                    style={{width: `${progressPct}%`}}
                />
                <span className="lesson-progress-label">
                    {isSummary
                        ? t("lesson.progress.summary", "Summary")
                        : t(
                              "lesson.progress.step_of",
                              "Step {current} of {total}",
                          )
                              .replace(
                                  "{current}",
                                  String(currentStepIndex + 1),
                              )
                              .replace("{total}", String(totalSteps))}
                </span>
            </div>

            {isSummary ? (
                <ReviewSummary
                    correct={sessionScoreCorrect}
                    total={sessionScoreTotal}
                    onExit={() => navigate("/dashboard")}
                />
            ) : (
                <article
                    className="lesson-step"
                    data-testid={`review-step-${step!.id}`}
                    data-step-type={step!.type}
                >
                    <ExerciseDispatcher
                        step={step!}
                        setId={setId}
                        cards={lesson?.cards ?? []}
                        lessonId={
                            // The synthesized step embeds the
                            // source lesson_id in its id —
                            // "review-{lesson_id}-{exercise_id}
                            // -{element_key}". Parse it back
                            // out so the element-attempt
                            // deriver stamps the right
                            // lesson_id on every produced
                            // ElementAttempt.
                            _extractLessonId(step!.id)
                        }
                        onComplete={async (scored) => {
                            await recordStepAttempts(scored.attempts);
                        }}
                    />
                </article>
            )}

            <nav
                className="lesson-nav"
                aria-label={t(
                    "lesson.nav.aria_label",
                    "Step navigation",
                )}
            >
                <button
                    type="button"
                    className="btn lesson-nav-prev"
                    onClick={goPrev}
                    disabled={currentStepIndex === 0}
                    data-testid="review-prev"
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("lesson.action.prev", "Previous")}
                </button>
                {!isSummary && (
                    <button
                        type="button"
                        className="btn btn-primary lesson-nav-next"
                        onClick={goNext}
                        data-testid="review-next"
                    >
                        {currentStepIndex + 1 === totalSteps
                            ? t(
                                  "lesson.action.finish",
                                  "Finish lesson",
                              )
                            : t("lesson.action.next", "Next")}
                        <ArrowRight size={14} aria-hidden="true" />
                    </button>
                )}
            </nav>
        </main>
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
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
        <section
            className="lesson-summary"
            data-testid="review-summary"
            aria-label={t("review.summary.aria_label", "Review summary")}
        >
            <h2>{t("review.summary.heading", "Review complete")}</h2>
            <ul className="lesson-summary-stats">
                <li>
                    <strong>
                        {t("review.summary.score", "Score")}:
                    </strong>{" "}
                    <span data-testid="review-summary-score">
                        {correct} / {total} ({pct}%)
                    </span>
                </li>
            </ul>
            <p className="review-summary-note">
                {t(
                    "review.summary.note",
                    "Element scores have been updated. Mastered elements will not appear in the next session.",
                )}
            </p>
            <div className="lesson-summary-actions">
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onExit}
                    data-testid="review-summary-exit"
                >
                    {t("review.back_to_dashboard", "Back to Dashboard")}
                </button>
            </div>
        </section>
    );
}
