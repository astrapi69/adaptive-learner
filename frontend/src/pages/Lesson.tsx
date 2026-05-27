/**
 * /lesson/:setSlug/:setId/:filename — lesson viewer
 * (Phase 44 / EXP-002 / 3B — F-102 + F-103).
 *
 * Walks the user through a downloaded lesson step-by-step:
 * theory bodies render via react-markdown (same pipeline the
 * help drawer + Learning-Repo page use), exercise steps land
 * a placeholder for now (commit 4 + 5 add MatchingExercise +
 * PictureChoiceExercise; commit 6 wires them into the
 * dispatch). After the last step, a summary card surfaces the
 * aggregate score + time-spent + a "Mark complete" button.
 *
 * Storage-mode-agnostic: the underlying ``useLesson`` hook
 * routes through ``getStorage().contentLoader.*`` /
 * ``lessonProgress.*`` so the page works in API mode AND
 * Dexie-mode (GitHub Pages). When a user lands here for a set
 * they haven't downloaded yet, the viewer shows a friendly
 * "Open the Set Browser to download" notice instead of
 * crashing with a 404 toast.
 *
 * Mobile-first: prev / next buttons stretch to fill on small
 * viewports so the touch target stays above 44px.
 */

import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Download,
    RotateCcw,
    Star,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import Markdown from "react-markdown";
import {Link, useNavigate, useParams} from "react-router-dom";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import FreeTextExercise from "../components/exercises/FreeTextExercise";
import MatchingExercise from "../components/exercises/MatchingExercise";
import PictureChoiceExercise from "../components/exercises/PictureChoiceExercise";
import WordTilesExercise from "../components/exercises/WordTilesExercise";
import {useI18n} from "../hooks/useI18n";
import {useLesson} from "../hooks/useLesson";
import {
    parseStepAnchor,
    rewriteAnchors,
} from "../lib/lesson-anchors";
import {readLearnerState} from "../lib/learnerState";
import {
    buildExerciseBreakdown,
    computeStars,
    type StarRating,
} from "../lib/lesson-summary";
import {getStorage} from "../storage";
import type {
    ContentLessonExercise,
    ContentLessonStep,
} from "../storage/types";

const SUPPORTED_EXERCISE_TYPES: ReadonlySet<string> = new Set([
    "matching",
    "picture_choice",
    "free_text",
    "word_tiles",
]);

interface UrlParams {
    setSlug: string;
    setId: string;
    filename: string;
    [key: string]: string | undefined;
}

export default function LessonPage() {
    const params = useParams<UrlParams>();
    const navigate = useNavigate();
    const {t} = useI18n();

    const source = useMemo(
        () => (params.setSlug ?? "").replace(/--/g, "/"),
        [params.setSlug],
    );
    const setId = params.setId ?? "";
    const filename = params.filename ?? "";

    const {
        status,
        lesson,
        progress,
        currentStepIndex,
        error,
        goNext,
        goPrev,
        goToStep,
        goToStepById,
        recordStepResult,
        markCompleted,
    } = useLesson({source, setId, lessonFilename: filename});

    // Phase 46B — userId for the elementErrors.recordBulk
    // call inside ExerciseDispatcher's onComplete. Read once
    // on mount; useLesson already reads it for the progress
    // path but doesn't expose it.
    const learnerUserId = useMemo(() => readLearnerState().userId, []);

    // Phase 46A — fetch the set's lesson list so the summary
    // screen's "Next lesson" button knows whether there's a
    // successor + what filename to navigate to. One extra
    // storage round-trip on mount; cached by both storages.
    // ``null`` means "no next lesson" (last in set OR list not
    // yet loaded). Failures degrade silently — the button just
    // doesn't render.
    const [nextLessonFilename, setNextLessonFilename] = useState<
        string | null
    >(null);
    useEffect(() => {
        if (!source || !setId || !filename) {
            setNextLessonFilename(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const list = await getStorage().contentLoader.listLessons(
                    source,
                    setId,
                );
                if (cancelled) return;
                const idx = list.lessons.indexOf(filename);
                if (idx >= 0 && idx < list.lessons.length - 1) {
                    setNextLessonFilename(list.lessons[idx + 1]);
                } else {
                    setNextLessonFilename(null);
                }
            } catch {
                if (!cancelled) setNextLessonFilename(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, setId, filename]);

    if (!source || !setId || !filename) {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="lesson-missing-params"
            >
                <h1>{t("lesson.page_title", "Lesson")}</h1>
                <p>
                    {t(
                        "lesson.error.missing_params",
                        "No lesson selected. Browse content sets to pick one.",
                    )}
                </p>
                <Link to="/content" className="btn">
                    {t("lesson.action.open_browser", "Open content browser")}
                </Link>
            </main>
        );
    }

    if (status === "loading") {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="lesson-loading"
            >
                <p>{t("lesson.loading", "Loading lesson…")}</p>
            </main>
        );
    }

    if (status === "not-cached") {
        return (
            <main
                id="main"
                className="page lesson-page"
                data-testid="lesson-not-cached"
            >
                <header className="lesson-header">
                    <h1>{t("lesson.page_title", "Lesson")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "lesson.not_cached_body",
                        "This lesson isn't downloaded yet. Open the content browser and download the set first.",
                    )}
                </p>
                <p>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => navigate("/content")}
                        data-testid="lesson-goto-content"
                    >
                        <Download size={14} aria-hidden="true" />
                        {t("lesson.action.open_browser", "Open content browser")}
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
                data-testid="lesson-error"
            >
                <p>
                    {t("lesson.error.load_failed", "Could not load lesson.")}
                    {error ? ` (${error})` : ""}
                </p>
                <button
                    type="button"
                    className="btn"
                    onClick={() => navigate("/content")}
                >
                    {t("lesson.action.open_browser", "Open content browser")}
                </button>
            </main>
        );
    }

    const totalSteps = lesson.steps.length;
    const isSummary = currentStepIndex >= totalSteps;
    const step = isSummary ? null : lesson.steps[currentStepIndex];
    const progressPct = totalSteps === 0
        ? 100
        : Math.round((currentStepIndex / totalSteps) * 100);

    return (
        <main
            id="main"
            className="page lesson-page"
            data-testid="lesson-page"
        >
            <header className="lesson-header">
                <button
                    type="button"
                    className="lesson-back-btn"
                    onClick={() => navigate("/content")}
                    data-testid="lesson-back-btn"
                    aria-label={t(
                        "lesson.action.back_to_browser",
                        "Back to content browser",
                    )}
                >
                    <BookOpen size={16} aria-hidden="true" />
                    {t("lesson.action.back_to_browser", "Back to content browser")}
                </button>
                <h1>{lesson.title}</h1>
                {lesson.description && (
                    <p className="lesson-description">{lesson.description}</p>
                )}
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
                data-testid="lesson-progress-bar"
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
                <LessonSummary
                    lesson={lesson}
                    progress={progress}
                    nextLessonFilename={nextLessonFilename}
                    onMarkComplete={async () => {
                        await markCompleted();
                    }}
                    onNextLesson={() => {
                        if (nextLessonFilename) {
                            navigate(
                                `/lesson/${params.setSlug}/${setId}/${nextLessonFilename}`,
                            );
                        }
                    }}
                    onRepeat={() => goToStep(0)}
                    onExit={() => navigate("/content")}
                />
            ) : (
                <article
                    className="lesson-step"
                    data-testid={`lesson-step-${step!.id}`}
                    data-step-type={step!.type}
                >
                    {step!.title && <h2>{step!.title}</h2>}
                    {step!.type === "theory" ? (
                        <TheoryStep
                            body={step!.body ?? ""}
                            lessonRewriteFn={(s) =>
                                rewriteAnchors(s, lesson)
                            }
                            onAnchorClick={goToStepById}
                        />
                    ) : (
                        <ExerciseDispatcher
                            step={step!}
                            setId={setId}
                            lessonId={filename}
                            onComplete={async (scored) => {
                                if (!step!.exercise) return;
                                await recordStepResult({
                                    step_id: step!.id,
                                    correct: scored.correct,
                                    total: scored.total,
                                });
                                // Phase 46B — persist per-element
                                // attempts alongside the per-step
                                // score. Failures here MUST NOT
                                // block the step from advancing
                                // (the per-step score is the
                                // user's primary feedback).
                                if (
                                    scored.attempts.length > 0 &&
                                    learnerUserId
                                ) {
                                    try {
                                        await getStorage().elementErrors.recordBulk(
                                            learnerUserId,
                                            scored.attempts,
                                        );
                                    } catch (err) {
                                        // eslint-disable-next-line no-console
                                        console.warn(
                                            "elementErrors.recordBulk failed:",
                                            err,
                                        );
                                    }
                                }
                            }}
                        />
                    )}
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
                    data-testid="lesson-prev"
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("lesson.action.prev", "Previous")}
                </button>
                {!isSummary && (
                    <button
                        type="button"
                        className="btn btn-primary lesson-nav-next"
                        onClick={goNext}
                        data-testid="lesson-next"
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


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


interface TheoryStepProps {
    body: string;
    lessonRewriteFn: (body: string) => string;
    onAnchorClick: (stepId: string) => void;
}

function TheoryStep({
    body,
    lessonRewriteFn,
    onAnchorClick,
}: TheoryStepProps) {
    const rewritten = useMemo(
        () => lessonRewriteFn(body),
        [body, lessonRewriteFn],
    );
    return (
        <div
            className="lesson-theory markdown-body"
            data-testid="lesson-theory-body"
        >
            <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
                components={{
                    a: ({href, children, ...rest}) => {
                        const stepId =
                            href !== undefined
                                ? parseStepAnchor(href)
                                : null;
                        if (stepId !== null) {
                            return (
                                <a
                                    {...rest}
                                    href={href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onAnchorClick(stepId);
                                    }}
                                >
                                    {children}
                                </a>
                            );
                        }
                        return (
                            <a {...rest} href={href}>
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {rewritten}
            </Markdown>
        </div>
    );
}


interface ExerciseDispatcherProps {
    step: ContentLessonStep;
    /** Phase 46B context propagated to each exercise so the
     *  element-attempt deriver can stamp set_id + lesson_id
     *  on every produced ElementAttempt. */
    setId: string;
    lessonId: string;
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: import("../storage/types").ElementAttempt[];
    }) => Promise<void>;
}

function ExerciseDispatcher({
    step,
    setId,
    lessonId,
    onComplete,
}: ExerciseDispatcherProps) {
    const ex: ContentLessonExercise | null = step.exercise ?? null;
    if (ex === null) return <ExerciseStepPlaceholder step={step} />;
    const supported = SUPPORTED_EXERCISE_TYPES.has(ex.type);
    if (!supported) {
        return <ExerciseStepPlaceholder step={step} />;
    }
    if (ex.type === "matching") {
        return (
            <MatchingExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "picture_choice") {
        return (
            <PictureChoiceExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "free_text") {
        return (
            <FreeTextExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "word_tiles") {
        return (
            <WordTilesExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    return <ExerciseStepPlaceholder step={step} />;
}


function ExerciseStepPlaceholder({step}: {step: ContentLessonStep}) {
    const {t} = useI18n();
    const exerciseType = step.exercise?.type ?? "unknown";
    const supported = SUPPORTED_EXERCISE_TYPES.has(exerciseType);
    return (
        <div
            className="lesson-exercise-placeholder"
            data-testid={`lesson-exercise-placeholder-${exerciseType}`}
        >
            <p>
                {supported
                    ? t(
                          "lesson.exercise.loading",
                          "Exercise loading…",
                      )
                    : t(
                          "lesson.exercise.coming_soon",
                          "This exercise type ({type}) ships in a future version. Skip to the next step.",
                      ).replace("{type}", exerciseType)}
            </p>
            {step.exercise?.prompt && (
                <p className="lesson-exercise-prompt-preview">
                    <em>{step.exercise.prompt}</em>
                </p>
            )}
        </div>
    );
}


interface LessonSummaryProps {
    lesson: import("../storage/types").ContentLesson;
    progress: import("../storage/types").LessonProgress | null;
    /** Next lesson's filename within the set, or null when
     *  there is no successor (last lesson OR list not yet
     *  fetched). When null, the "Next lesson" button hides. */
    nextLessonFilename: string | null;
    onMarkComplete: () => Promise<void> | void;
    onNextLesson: () => void;
    onRepeat: () => void;
    onExit: () => void;
}

function LessonSummary({
    lesson,
    progress,
    nextLessonFilename,
    onMarkComplete,
    onNextLesson,
    onRepeat,
    onExit,
}: LessonSummaryProps) {
    const {t} = useI18n();
    const correct = progress?.score_correct ?? 0;
    const total = progress?.score_total ?? 0;
    const seconds = progress?.time_spent_seconds ?? 0;
    const minutes = Math.max(1, Math.round(seconds / 60));
    const isCompleted = progress?.status === "completed";

    const stars: StarRating = computeStars(correct, total);
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const breakdown = useMemo(
        () => buildExerciseBreakdown(lesson, progress),
        [lesson, progress],
    );

    return (
        <section
            className={`lesson-summary${stars === 3 ? " is-celebrating" : ""}`}
            data-testid="lesson-summary"
            data-stars={String(stars)}
            aria-label={t("lesson.summary.aria_label", "Lesson summary")}
        >
            <h2>
                {isCompleted ? (
                    <CheckCircle2 size={20} aria-hidden="true" />
                ) : null}
                {t("lesson.summary.heading", "You finished")}: {lesson.title}
            </h2>

            <div
                className="lesson-summary-stars"
                data-testid="lesson-summary-stars"
                role="img"
                aria-label={t(
                    "lesson.summary.stars_aria",
                    "{n} of 3 stars",
                ).replace("{n}", String(stars))}
            >
                {[1, 2, 3].map((n) => {
                    const earned = n <= stars;
                    return (
                        <Star
                            key={n}
                            size={28}
                            aria-hidden="true"
                            className={`lesson-summary-star${
                                earned ? " is-earned" : ""
                            }`}
                            fill={earned ? "currentColor" : "none"}
                            data-earned={earned ? "true" : "false"}
                            data-testid={`lesson-summary-star-${n}`}
                        />
                    );
                })}
            </div>

            <div
                className="lesson-summary-score-bar"
                role="progressbar"
                aria-valuenow={scorePct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(
                    "lesson.summary.score_bar_aria",
                    "Score: {pct} percent",
                ).replace("{pct}", String(scorePct))}
                data-testid="lesson-summary-score-bar"
            >
                <div
                    className="lesson-summary-score-fill"
                    style={{width: `${scorePct}%`}}
                />
                <span className="lesson-summary-score-label">
                    <strong>
                        {t("lesson.summary.score", "Score")}:
                    </strong>{" "}
                    <span data-testid="lesson-summary-score">
                        {correct} / {total}
                    </span>{" "}
                    ({scorePct}%)
                </span>
            </div>

            <ul className="lesson-summary-stats">
                <li>
                    <strong>
                        {t("lesson.summary.time", "Time")}:
                    </strong>{" "}
                    <span data-testid="lesson-summary-time">
                        {t(
                            "lesson.summary.minutes",
                            "{n} min",
                        ).replace("{n}", String(minutes))}
                    </span>
                </li>
            </ul>

            {breakdown.length > 0 && (
                <section
                    className="lesson-summary-breakdown"
                    data-testid="lesson-summary-breakdown"
                    aria-label={t(
                        "lesson.summary.breakdown_heading",
                        "Exercise breakdown",
                    )}
                >
                    <h3>
                        {t(
                            "lesson.summary.breakdown_heading",
                            "Exercise breakdown",
                        )}
                    </h3>
                    <ul className="lesson-summary-breakdown-list">
                        {breakdown.map((entry) => {
                            const rowStatus = !entry.attempted
                                ? "unattempted"
                                : entry.fullyCorrect
                                  ? "correct"
                                  : "wrong";
                            return (
                                <li
                                    key={entry.stepId}
                                    className={`lesson-summary-breakdown-row is-${rowStatus}`}
                                    data-testid={`lesson-summary-breakdown-${entry.stepId}`}
                                    data-status={rowStatus}
                                >
                                    <span className="lesson-summary-breakdown-title">
                                        {entry.title}
                                    </span>
                                    {entry.attempted ? (
                                        <span className="lesson-summary-breakdown-score">
                                            {entry.correct} / {entry.total}
                                        </span>
                                    ) : (
                                        <span className="lesson-summary-breakdown-score lesson-summary-breakdown-unattempted">
                                            {t(
                                                "lesson.summary.breakdown_unattempted",
                                                "Not attempted",
                                            )}
                                        </span>
                                    )}
                                    {entry.attempted &&
                                        !entry.fullyCorrect &&
                                        entry.canonicalAnswer && (
                                            <span className="lesson-summary-breakdown-canonical">
                                                {t(
                                                    "lesson.summary.breakdown_correct_answer",
                                                    "Correct answer: {answer}",
                                                ).replace(
                                                    "{answer}",
                                                    entry.canonicalAnswer,
                                                )}
                                            </span>
                                        )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            <div className="lesson-summary-actions">
                {!isCompleted && (
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            void onMarkComplete();
                        }}
                        data-testid="lesson-summary-mark-complete"
                    >
                        {t(
                            "lesson.summary.mark_complete",
                            "Mark as complete",
                        )}
                    </button>
                )}
                {nextLessonFilename && (
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onNextLesson}
                        data-testid="lesson-summary-next"
                    >
                        {t("lesson.summary.next_lesson", "Next lesson")}
                        <ChevronRight size={14} aria-hidden="true" />
                    </button>
                )}
                <button
                    type="button"
                    className="btn"
                    onClick={onRepeat}
                    data-testid="lesson-summary-repeat"
                >
                    <RotateCcw size={14} aria-hidden="true" />
                    {t("lesson.summary.repeat", "Repeat lesson")}
                </button>
                <button
                    type="button"
                    className="btn"
                    onClick={onExit}
                    data-testid="lesson-summary-exit"
                >
                    {t("lesson.summary.back_to_browser", "Back to content browser")}
                </button>
            </div>
        </section>
    );
}
