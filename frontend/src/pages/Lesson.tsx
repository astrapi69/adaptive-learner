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

import {ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Download} from "lucide-react";
import {useMemo} from "react";
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
                    onMarkComplete={async () => {
                        await markCompleted();
                    }}
                    onRestart={() => goToStep(0)}
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
                            onComplete={async (scored) => {
                                if (step!.exercise) {
                                    await recordStepResult({
                                        step_id: step!.id,
                                        correct: scored.correct,
                                        total: scored.total,
                                    });
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
    onComplete: (result: {correct: number; total: number}) => Promise<void>;
}

function ExerciseDispatcher({step, onComplete}: ExerciseDispatcherProps) {
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
    onMarkComplete: () => Promise<void> | void;
    onRestart: () => void;
    onExit: () => void;
}

function LessonSummary({
    lesson,
    progress,
    onMarkComplete,
    onRestart,
    onExit,
}: LessonSummaryProps) {
    const {t} = useI18n();
    const correct = progress?.score_correct ?? 0;
    const total = progress?.score_total ?? 0;
    const seconds = progress?.time_spent_seconds ?? 0;
    const minutes = Math.max(1, Math.round(seconds / 60));
    const isCompleted = progress?.status === "completed";
    return (
        <section
            className="lesson-summary"
            data-testid="lesson-summary"
            aria-label={t("lesson.summary.aria_label", "Lesson summary")}
        >
            <h2>
                {isCompleted ? (
                    <CheckCircle2 size={20} aria-hidden="true" />
                ) : null}
                {t("lesson.summary.heading", "You finished")}: {lesson.title}
            </h2>
            <ul className="lesson-summary-stats">
                <li>
                    <strong>
                        {t("lesson.summary.score", "Score")}:
                    </strong>{" "}
                    <span data-testid="lesson-summary-score">
                        {correct} / {total}
                    </span>
                </li>
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
                <button
                    type="button"
                    className="btn"
                    onClick={onRestart}
                    data-testid="lesson-summary-restart"
                >
                    {t("lesson.summary.restart", "Start over")}
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
