/**
 * /shuffle-lesson/:setId — Zufall-Modus session (#1014).
 *
 * Walks the learner through a synthesised mini-lesson that INTERLEAVES the
 * exercises of every lesson in a set (Fisher-Yates, no 3+ from one lesson in a
 * row, capped — see ``buildShuffleLesson``). Reuses the shared
 * ``ExerciseDispatcher`` so the renderers are identical to the main viewer;
 * only the lesson source + summary differ.
 *
 * Sessions are ephemeral (no LessonProgress row); ``ElementError`` rows DO
 * update on every attempt via the same ``recordBulk`` path the viewer + review
 * use, so a correct answer levels the card up in the SRS. Dexie-mode-friendly:
 * ``useShuffleLesson`` routes through ``getStorage()``.
 */

import {ArrowLeft, BookOpen, Download, RotateCcw} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactElement,
    type Ref,
} from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
    type NavigateFunction,
} from "react-router-dom";

import {
    ExerciseDispatcher,
    SUPPORTED_EXERCISE_TYPES,
} from "../../components/exercises";
import type {
    ExerciseHandle,
    ExerciseScored,
} from "../../components/exercises";
import {Button} from "@/components/ui/button";
import ProgressBar from "../../shared/data-display/ProgressBar";
import LessonStepNav from "../../shared/layout/LessonStepNav";
import {useI18n} from "../../hooks/ui/useI18n";
import {useLessonShortcuts} from "../../hooks/lesson/interaction/useLessonShortcuts";
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../../hooks/lesson/interaction/useLessonEnterKey";
import {useShuffleLesson} from "../../hooks/lesson/modes/useShuffleLesson";
import {DEFAULT_SHUFFLE_LIMIT} from "../../lib/shuffle/shuffle-lesson";
import type {
    ContentLesson,
    ContentLessonStep,
    ElementAttempt,
} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

/** Selectable session lengths (issue #1014); default 20. */
const ALLOWED_LENGTHS = [10, 20, 30, 50];

export default function ShuffleLessonPage() {
    const params = useParams<UrlParams>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const {t} = useI18n();
    const setId = params.setId ?? "";
    // Configurable session length via ?len= (10/20/30/50); default 20.
    const limit = useMemo(() => {
        const raw = Number(searchParams.get("len"));
        return ALLOWED_LENGTHS.includes(raw) ? raw : DEFAULT_SHUFFLE_LIMIT;
    }, [searchParams]);

    const {
        status,
        lesson,
        currentStepIndex,
        sourceLessonCount,
        error,
        goNext,
        goPrev,
        recordStepAttempts,
        sessionScoreCorrect,
        sessionScoreTotal,
        reload,
    } = useShuffleLesson({
        setId,
        title: t("shuffle.session_title", "Shuffle session"),
        limit,
    });

    // Single two-phase Check -> Weiter button (the exercise renders controlled).
    const exerciseRef = useRef<ExerciseHandle>(null);
    const [checked, setChecked] = useState(false);
    const [answerable, setAnswerable] = useState(false);
    const lessonShortcutsEnabled = useLessonShortcuts();
    const enterStateRef = useRef<LessonEnterNav | null>(null);
    const enterLockRef = useRef(false);
    useLessonEnterKey({
        enabled: lessonShortcutsEnabled,
        exerciseRef,
        enterStateRef,
        enterLockRef,
    });
    useEffect(() => {
        setChecked(false);
        setAnswerable(false);
        enterLockRef.current = false;
    }, [currentStepIndex]);

    const statusScreen = renderShuffleStatus(setId, status, navigate, t);
    if (statusScreen) return statusScreen;

    if (status === "error" || lesson === null) {
        return (
            <main id="main" className="page lesson-page" data-testid="shuffle-error">
                <p>
                    {t("shuffle.error.load_failed", "Could not load shuffle session.")}
                    {error ? ` (${error})` : ""}
                </p>
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("shuffle.back_to_dashboard", "Back to Dashboard")}
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
        totalSteps === 0 ? 100 : Math.round((currentStepIndex / totalSteps) * 100);

    enterStateRef.current = {
        isSummary,
        isExerciseStep,
        checked,
        enteredReviewed: false,
        answerable,
        goNext,
    };

    return (
        <main id="main" className="page lesson-page" data-testid="shuffle-page">
            <header className="lesson-header">
                <button
                    type="button"
                    className="lesson-back-btn"
                    onClick={() => navigate("/dashboard")}
                    data-testid="shuffle-back-btn"
                    aria-label={t("shuffle.back_to_dashboard", "Back to Dashboard")}
                >
                    <BookOpen size={16} aria-hidden="true" />
                    {t("shuffle.back_to_dashboard", "Back to Dashboard")}
                </button>
                <h1>{lesson.title}</h1>
                <p className="lesson-description" data-testid="shuffle-subtitle">
                    {t(
                        "shuffle.subtitle",
                        "Mixing {n} questions from {lessons} lessons",
                    )
                        .replace("{n}", String(totalSteps))
                        .replace("{lessons}", String(sourceLessonCount))}
                </p>
            </header>

            <ProgressBar
                valueNow={progressPct}
                ariaLabel={t("lesson.progress.aria_label", "Lesson progress")}
                className="lesson-progress-bar"
                fillClassName="lesson-progress-fill"
                labelClassName="lesson-progress-label"
                testId="shuffle-progress-bar"
            >
                {isSummary
                    ? t("lesson.progress.summary", "Summary")
                    : t("lesson.progress.step_of", "Step {current} of {total}")
                          .replace("{current}", String(currentStepIndex + 1))
                          .replace("{total}", String(totalSteps))}
            </ProgressBar>

            {isSummary ? (
                <ShuffleSummary
                    correct={sessionScoreCorrect}
                    total={sessionScoreTotal}
                    lessons={sourceLessonCount}
                    onAnotherRound={reload}
                    onExit={() => navigate("/dashboard")}
                    t={t}
                />
            ) : (
                <ShuffleExercise
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
                testIdPrefix="shuffle"
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

/** Non-playing status screen (missing param / loading / empty / not-cached),
 *  or ``null`` once a playable session is ready. */
function renderShuffleStatus(
    setId: string,
    status: string,
    navigate: NavigateFunction,
    t: Translate,
): ReactElement | null {
    if (!setId) {
        return (
            <main id="main" className="page lesson-page" data-testid="shuffle-missing-params">
                <h1>{t("shuffle.page_title", "Shuffle")}</h1>
                <p>{t("shuffle.error.missing_params", "No content set selected.")}</p>
            </main>
        );
    }
    if (status === "loading") {
        return (
            <main id="main" className="page lesson-page" data-testid="shuffle-loading">
                <p>{t("shuffle.loading", "Loading shuffle session…")}</p>
            </main>
        );
    }
    if (status === "empty") {
        return (
            <main id="main" className="page lesson-page" data-testid="shuffle-empty">
                <header className="lesson-header">
                    <h1>{t("shuffle.page_title", "Shuffle")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "shuffle.empty_body",
                        "This set needs at least two lessons with exercises to shuffle.",
                    )}
                </p>
                <p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/dashboard")}
                        data-testid="shuffle-back-to-dashboard"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t("shuffle.back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </p>
            </main>
        );
    }
    if (status === "not-cached") {
        return (
            <main id="main" className="page lesson-page" data-testid="shuffle-not-cached">
                <header className="lesson-header">
                    <h1>{t("shuffle.page_title", "Shuffle")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "shuffle.not_cached_body",
                        "This set isn't downloaded yet. Open the content browser to download it first.",
                    )}
                </p>
                <p>
                    <Button
                        type="button"
                        onClick={() => navigate("/content?tab=my")}
                        data-testid="shuffle-goto-content"
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

interface ShuffleExerciseProps {
    step: ContentLessonStep;
    setId: string;
    cards: ContentLesson["cards"];
    exerciseRef: Ref<ExerciseHandle>;
    onInteraction: (answerable: boolean) => void;
    onChecked: () => void;
    recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
}

/** The active shuffle exercise: the controlled ExerciseDispatcher. Each
 *  synthesised step carries its source ``review_lesson_id`` so attempts record
 *  against the right SRS row. */
function ShuffleExercise({
    step,
    setId,
    cards,
    exerciseRef,
    onInteraction,
    onChecked,
    recordStepAttempts,
}: ShuffleExerciseProps) {
    return (
        <article
            className="lesson-step"
            data-testid={`shuffle-step-${step.id}`}
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
                lessonId={step.review_lesson_id ?? ""}
                onComplete={async (scored: ExerciseScored) => {
                    onChecked();
                    await recordStepAttempts(scored.attempts);
                }}
            />
        </article>
    );
}

interface ShuffleSummaryProps {
    correct: number;
    total: number;
    lessons: number;
    onAnotherRound: () => void;
    onExit: () => void;
    t: Translate;
}

/** Shuffle-session recap: score + "from N lessons" + re-shuffle / exit. */
function ShuffleSummary({
    correct,
    total,
    lessons,
    onAnotherRound,
    onExit,
    t,
}: ShuffleSummaryProps) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
        <section
            className="lesson-summary"
            data-testid="shuffle-summary"
            aria-label={t("shuffle.summary.heading", "Shuffle training complete!")}
        >
            <h2>{t("shuffle.summary.heading", "Shuffle training complete!")}</h2>
            <p
                className="text-lg font-semibold text-fg-primary"
                data-testid="shuffle-summary-score"
            >
                {t("shuffle.summary.score", "{correct} of {total} correct")
                    .replace("{correct}", String(correct))
                    .replace("{total}", String(total))}{" "}
                ({pct}%)
            </p>
            <p
                className="mt-1 text-sm text-fg-muted"
                data-testid="shuffle-summary-lessons"
            >
                {t("shuffle.summary.from_lessons", "from {n} different lessons").replace(
                    "{n}",
                    String(lessons),
                )}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                    type="button"
                    onClick={onAnotherRound}
                    data-testid="shuffle-another-round"
                >
                    <RotateCcw size={14} aria-hidden="true" />
                    {t("shuffle.summary.another", "Shuffle again")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onExit}
                    data-testid="shuffle-exit"
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("shuffle.back_to_dashboard", "Back to Dashboard")}
                </Button>
            </div>
        </section>
    );
}
