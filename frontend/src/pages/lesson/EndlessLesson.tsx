/**
 * /endless-lesson/:setId — Endlos-Modus session (#1015).
 *
 * A continuous, never-finishing SRS practice stream over a set: due/error
 * cards first, then new cards, then random repetition (see
 * ``useEndlessLesson`` + ``buildEndlessPlan``). There is no "lesson
 * complete" screen — the learner stops with [Pause] / [End], and End shows a
 * session recap (duration, cards, correct, reviews done, new learned, errors
 * practised, practice XP).
 *
 * Reuses the shared ``ExerciseDispatcher`` so the renderers match the main
 * viewer. Ephemeral (no LessonProgress row); the SRS updates after every
 * answer via ``recordStepAttempts``. Dexie-mode-friendly via ``getStorage()``.
 */

import {ArrowLeft, BookOpen, Pause, Play, Square} from "lucide-react";
import {
    useEffect,
    useRef,
    useState,
    type ReactElement,
    type Ref,
} from "react";
import {useNavigate, useParams, type NavigateFunction} from "react-router-dom";

import {
    ExerciseDispatcher,
    SUPPORTED_EXERCISE_TYPES,
} from "../../components/exercises";
import type {
    ExerciseHandle,
    ExerciseScored,
} from "../../components/exercises";
import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";
import {useLessonShortcuts} from "../../hooks/lesson/useLessonShortcuts";
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../../hooks/lesson/useLessonEnterKey";
import {
    useEndlessLesson,
    type EndlessStats,
} from "../../hooks/lesson/useEndlessLesson";
import type {
    ContentLessonCard,
    ContentLessonStep,
    ElementAttempt,
} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

/** mm:ss for a whole-second duration. */
function formatDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function EndlessLessonPage() {
    const params = useParams<UrlParams>();
    const navigate = useNavigate();
    const {t} = useI18n();
    const setId = params.setId ?? "";

    const {status, step, cards, stats, error, advance, recordStepAttempts} =
        useEndlessLesson({
            setId,
            title: t("endless.session_title", "Endless practice"),
        });

    // Session controls: paused freezes the timer, ended shows the summary.
    const [paused, setPaused] = useState(false);
    const [ended, setEnded] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);
    // Monotonic key so a repeated card (same step id) still remounts.
    const [cardSeq, setCardSeq] = useState(0);

    // Active-seconds timer: ticks only while playing.
    useEffect(() => {
        if (status !== "ready" || paused || ended) return;
        const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [status, paused, ended]);

    // Two-phase Check -> Next button (the exercise renders controlled).
    const exerciseRef = useRef<ExerciseHandle>(null);
    const [checked, setChecked] = useState(false);
    const [answerable, setAnswerable] = useState(false);
    const lessonShortcutsEnabled = useLessonShortcuts();
    const enterStateRef = useRef<LessonEnterNav | null>(null);
    const enterLockRef = useRef(false);

    const goNext = () => {
        advance();
        setChecked(false);
        setAnswerable(false);
        enterLockRef.current = false;
        setCardSeq((n) => n + 1);
    };

    useLessonEnterKey({
        enabled: lessonShortcutsEnabled && !paused && !ended,
        exerciseRef,
        enterStateRef,
        enterLockRef,
    });

    const statusScreen = renderEndlessStatus(setId, status, error, navigate, t);
    if (statusScreen) return statusScreen;

    if (ended) {
        return (
            <EndlessSummary
                stats={stats}
                elapsedSec={elapsedSec}
                onExit={() => navigate("/dashboard")}
                t={t}
            />
        );
    }

    const isExerciseStep =
        step != null &&
        step.type === "exercise" &&
        step.exercise != null &&
        SUPPORTED_EXERCISE_TYPES.has(step.exercise.type);

    enterStateRef.current = {
        isSummary: false,
        isExerciseStep,
        checked,
        enteredReviewed: false,
        answerable,
        goNext,
    };

    return (
        <main id="main" className="page lesson-page" data-testid="endless-page">
            <header className="lesson-header">
                <button
                    type="button"
                    className="lesson-back-btn"
                    onClick={() => navigate("/dashboard")}
                    data-testid="endless-back-btn"
                    aria-label={t("endless.back_to_dashboard", "Back to Dashboard")}
                >
                    <BookOpen size={16} aria-hidden="true" />
                    {t("endless.back_to_dashboard", "Back to Dashboard")}
                </button>
                <h1>{t("endless.page_title", "Endless practice")}</h1>
            </header>

            <EndlessStatLine
                elapsedSec={elapsedSec}
                stats={stats}
                paused={paused}
                onTogglePause={() => setPaused((p) => !p)}
                onEnd={() => setEnded(true)}
                t={t}
            />

            {paused ? (
                <section
                    className="lesson-step"
                    data-testid="endless-paused"
                    role="status"
                >
                    <p className="text-fg-secondary">
                        {t("endless.paused", "Paused — take a breather.")}
                    </p>
                </section>
            ) : step && isExerciseStep ? (
                <EndlessExercise
                    key={cardSeq}
                    step={step}
                    setId={setId}
                    cards={cards}
                    exerciseRef={exerciseRef}
                    onInteraction={setAnswerable}
                    onChecked={() => setChecked(true)}
                    recordStepAttempts={recordStepAttempts}
                />
            ) : (
                <section className="lesson-step" data-testid="endless-no-card">
                    <p className="text-fg-secondary">
                        {t("endless.no_card", "No more cards right now.")}
                    </p>
                </section>
            )}

            <nav
                className="lesson-step-nav"
                aria-label={t("lesson.nav.aria_label", "Step navigation")}
            >
                {!checked ? (
                    <Button
                        type="button"
                        disabled={!answerable || paused}
                        onClick={() => exerciseRef.current?.submit()}
                        data-testid="endless-check"
                    >
                        {t("lesson.button.check", "Check")}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={goNext}
                        data-testid="endless-next"
                    >
                        {t("lesson.action.next", "Next")}
                    </Button>
                )}
            </nav>
        </main>
    );
}

interface EndlessStatLineProps {
    elapsedSec: number;
    stats: EndlessStats;
    paused: boolean;
    onTogglePause: () => void;
    onEnd: () => void;
    t: Translate;
}

/** Running stat line: ``12:34 | 45 cards | 38 correct (84%)`` + Pause / End. */
function EndlessStatLine({
    elapsedSec,
    stats,
    paused,
    onTogglePause,
    onEnd,
    t,
}: EndlessStatLineProps) {
    const pct = stats.cards > 0 ? Math.round((stats.correct / stats.cards) * 100) : 0;
    return (
        <div className="flex flex-wrap items-center gap-3 px-2 py-1">
            <p
                className="m-0 font-mono text-sm text-fg-primary"
                data-testid="endless-stat-line"
            >
                {formatDuration(elapsedSec)}
                {" | "}
                {t("endless.stat.cards", "{n} cards").replace(
                    "{n}",
                    String(stats.cards),
                )}
                {" | "}
                {t("endless.stat.correct", "{n} correct").replace(
                    "{n}",
                    String(stats.correct),
                )}{" "}
                ({pct}%)
            </p>
            <div className="ml-auto flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onTogglePause}
                    data-testid="endless-pause"
                    aria-pressed={paused}
                >
                    {paused ? (
                        <Play size={14} aria-hidden="true" />
                    ) : (
                        <Pause size={14} aria-hidden="true" />
                    )}
                    {paused
                        ? t("endless.resume", "Resume")
                        : t("endless.pause", "Pause")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onEnd}
                    data-testid="endless-end"
                >
                    <Square size={14} aria-hidden="true" />
                    {t("endless.end", "End")}
                </Button>
            </div>
        </div>
    );
}

interface EndlessExerciseProps {
    step: ContentLessonStep;
    setId: string;
    cards: ContentLessonCard[];
    exerciseRef: Ref<ExerciseHandle>;
    onInteraction: (answerable: boolean) => void;
    onChecked: () => void;
    recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
}

/** The active endless exercise: the controlled ExerciseDispatcher. The step
 *  carries its source ``review_lesson_id`` so attempts record against the
 *  right SRS row. */
function EndlessExercise({
    step,
    setId,
    cards,
    exerciseRef,
    onInteraction,
    onChecked,
    recordStepAttempts,
}: EndlessExerciseProps) {
    return (
        <article
            className="lesson-step"
            data-testid="endless-step"
            data-step-type={step.type}
        >
            <ExerciseDispatcher
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

interface EndlessSummaryProps {
    stats: EndlessStats;
    elapsedSec: number;
    onExit: () => void;
    t: Translate;
}

/** End-of-session recap: duration + the running counters + exit. */
function EndlessSummary({stats, elapsedSec, onExit, t}: EndlessSummaryProps) {
    const pct = stats.cards > 0 ? Math.round((stats.correct / stats.cards) * 100) : 0;
    const rows: Array<[string, string, string]> = [
        ["duration", t("endless.summary.duration", "Duration"), formatDuration(elapsedSec)],
        [
            "cards",
            t("endless.summary.cards", "Cards"),
            `${stats.cards}`,
        ],
        [
            "correct",
            t("endless.summary.correct", "Correct"),
            `${stats.correct} (${pct}%)`,
        ],
        [
            "reviews",
            t("endless.summary.reviews", "Reviews done"),
            `${stats.reviewsDone}`,
        ],
        [
            "new",
            t("endless.summary.new", "New learned"),
            `${stats.newLearned}`,
        ],
        [
            "errors",
            t("endless.summary.errors", "Errors practised"),
            `${stats.errorsPracticed}`,
        ],
        ["xp", t("endless.summary.xp", "Practice XP"), `${stats.xp}`],
    ];
    return (
        <main id="main" className="page lesson-page" data-testid="endless-page">
            <section
                className="lesson-summary"
                data-testid="endless-summary"
                aria-label={t("endless.summary.heading", "Practice session complete!")}
            >
                <h2>{t("endless.summary.heading", "Practice session complete!")}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {rows.map(([key, label, value]) => (
                        <div key={key} className="contents">
                            <dt className="text-fg-muted">{label}</dt>
                            <dd
                                className="m-0 font-semibold text-fg-primary"
                                data-testid={`endless-summary-${key}`}
                            >
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
                <div className="mt-4">
                    <Button type="button" variant="outline" onClick={onExit} data-testid="endless-summary-exit">
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t("endless.back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </div>
            </section>
        </main>
    );
}

/** Non-playing status screen (missing param / loading / empty / not-cached /
 *  error), or ``null`` once a playable session is ready. */
function renderEndlessStatus(
    setId: string,
    status: string,
    error: string | null,
    navigate: NavigateFunction,
    t: Translate,
): ReactElement | null {
    if (!setId) {
        return (
            <main id="main" className="page lesson-page" data-testid="endless-missing-params">
                <h1>{t("endless.page_title", "Endless practice")}</h1>
                <p>{t("endless.error.missing_params", "No content set selected.")}</p>
            </main>
        );
    }
    if (status === "loading") {
        return (
            <main id="main" className="page lesson-page" data-testid="endless-loading">
                <p>{t("endless.loading", "Loading practice session…")}</p>
            </main>
        );
    }
    if (status === "error") {
        return (
            <main id="main" className="page lesson-page" data-testid="endless-error">
                <p>
                    {t("endless.error.load_failed", "Could not load the practice session.")}
                    {error ? ` (${error})` : ""}
                </p>
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("endless.back_to_dashboard", "Back to Dashboard")}
                </Button>
            </main>
        );
    }
    if (status === "empty") {
        return (
            <main id="main" className="page lesson-page" data-testid="endless-empty">
                <header className="lesson-header">
                    <h1>{t("endless.page_title", "Endless practice")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t("endless.empty_body", "This set has no exercises to practise yet.")}
                </p>
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} data-testid="endless-back-to-dashboard">
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t("endless.back_to_dashboard", "Back to Dashboard")}
                </Button>
            </main>
        );
    }
    if (status === "not-cached") {
        return (
            <main id="main" className="page lesson-page" data-testid="endless-not-cached">
                <header className="lesson-header">
                    <h1>{t("endless.page_title", "Endless practice")}</h1>
                </header>
                <p className="lesson-not-cached-body">
                    {t(
                        "endless.not_cached_body",
                        "This set isn't downloaded yet. Open the content browser to download it first.",
                    )}
                </p>
                <Button type="button" onClick={() => navigate("/content?tab=my")} data-testid="endless-goto-content">
                    {t("lesson.action.open_browser", "Open content browser")}
                </Button>
            </main>
        );
    }
    return null;
}
