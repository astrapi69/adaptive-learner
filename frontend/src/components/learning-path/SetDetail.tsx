/**
 * SetDetail — the inline Level-2 panel revealed when a SetRow is
 * expanded (feature/learning-path-redesign; SRS surface added in #588).
 *
 * Lists every lesson of the set (LessonRow) with a "Show only due"
 * filter and a per-lesson element-detail expansion (the SRS element
 * breakdown), plus a context-aware action bar: "Start adaptive lesson"
 * and, when the set has active errors, "Retry errors" (the set-wide SRS
 * review queue). "Repeat everything" (#3171) resets the set's results
 * behind a confirmation and reopens it at lesson 1. Tailwind, 44px targets.
 */

import {
    ChevronDown,
    Infinity as InfinityIcon,
    ListChecks,
    RefreshCw,
    RotateCcw,
    Shuffle,
} from "lucide-react";
import {useState} from "react";
import {Link, useNavigate} from "react-router";

import {useI18n} from "../../hooks/ui/useI18n";
import {useFavorites} from "../../hooks/learning/useFavorites";
import {lessonRoute} from "../../lib/content/browse/continue-learning";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    resetSetResults,
    summarizeSetResults,
    type SetResultsSummary,
} from "../../lib/learning-path/reset-set-results";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import ElementDetailList, {
    type ElementDetailItem,
} from "../../shared/gamification/ElementDetailList";
import FavoriteToggle from "../../shared/media/FavoriteToggle";
import type {SrsBadgeTone} from "../../shared/gamification/SrsStatusBadge";
import LessonRow from "./LessonRow";
import ResetSetResultsDialog from "./ResetSetResultsDialog";
import TrainErrorsButton from "../lesson/TrainErrorsButton";
import type {
    PersonalPathLesson,
    PersonalPathSet,
} from "../../lib/learning-path/personal-path";
import type {SrsElementDetail} from "../../lib/srs/status";

export interface SetDetailProps {
    set: PersonalPathSet;
    /** Called after "Repeat everything" reset the set (#3171), so the
     *  owning page can reload its progress data. */
    onResultsReset?: () => void;
}

type T = (key: string, fallback?: string) => string;

/** Active (non-mastered) error-card count for one lesson, derived from its
 *  SRS roll-up (total tracked elements minus mastered). Mirrors the set-wide
 *  ``errorCount`` definition in ``buildPersonalPath`` (#1012). */
function lessonErrorCount(lesson: PersonalPathLesson): number {
    const srs = lesson.srs;
    if (!srs) return 0;
    return Math.max(0, srs.total - srs.mastered);
}

/** "Repeat everything" only makes sense once the set has results: any
 *  progress row (``lastActivity``) or an active error card (#3171). */
function hasResults(set: PersonalPathSet): boolean {
    return set.lastActivity !== null || set.errorCount > 0;
}

function toElementItems(
    details: SrsElementDetail[],
    t: T,
): ElementDetailItem[] {
    return details.map((d, i) => {
        let tone: SrsBadgeTone;
        let statusLabel: string;
        if (d.mastered) {
            tone = "success";
            statusLabel = t("srs.element_mastered", "Mastered");
        } else if (d.overdue) {
            tone = "warning";
            statusLabel = t("srs.element_due", "Due now");
        } else {
            tone = "info";
            statusLabel = t("srs.element_scheduled", "Scheduled");
        }
        const metaKey = d.mastered
            ? "srs.element_meta"
            : "srs.element_meta_review";
        const metaFallback = d.mastered
            ? "Streak {streak} · {errors} errors"
            : "Streak {streak} · {errors} errors · review in {days}d";
        const metaLabel = t(metaKey, metaFallback)
            .replace("{streak}", String(d.correctStreak))
            .replace("{errors}", String(d.errorCount))
            .replace("{days}", String(d.intervalDays));
        // #603 — the learning trajectory: "Attempt N: correct/wrong".
        let trajectoryLabel: string | undefined;
        if (d.attemptCount > 0 && d.lastAttemptCorrect !== null) {
            const outcome = d.lastAttemptCorrect
                ? t("srs.attempt_correct", "correct")
                : t("srs.attempt_wrong", "wrong");
            trajectoryLabel = t("srs.attempt_trajectory", "Attempt {n}: {outcome}")
                .replace("{n}", String(d.attemptCount))
                .replace("{outcome}", outcome);
        }
        return {
            id: `${d.elementKey}-${d.direction}-${i}`,
            element: d.elementKey,
            tone,
            statusLabel,
            metaLabel,
            trajectoryLabel,
            lastAnswer: d.mastered ? undefined : d.lastAnswer || undefined,
            correctAnswer: d.correctAnswer || undefined,
        };
    });
}

export default function SetDetail({set, onResultsReset}: SetDetailProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const userId = readLearnerState().userId;
    const {isFavorite, toggle} = useFavorites(userId);
    const [showOnlyDue, setShowOnlyDue] = useState(false);
    const [openLesson, setOpenLesson] = useState<string | null>(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetSummary, setResetSummary] = useState<SetResultsSummary | null>(null);
    const [resetting, setResetting] = useState(false);

    // #3171 — open the confirmation, then load the set's current results so
    // the dialog can name the average; confirm stays disabled until then.
    const requestReset = async () => {
        if (!userId) return;
        setResetSummary(null);
        setResetOpen(true);
        try {
            const summary = await summarizeSetResults(getStorage(), userId, {
                source: set.source,
                setId: set.setId,
            });
            setResetSummary(summary);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                `${t("learning_path.reset_all.failed", "The results could not be reset.")} ${detail}`,
            );
            setResetOpen(false);
        }
    };

    // #3171 — delete the set's progress, open a new run (the previous run's
    // mistakes stay as history), then land in lesson 1. XP/badges untouched.
    const confirmReset = async () => {
        if (!userId) return;
        setResetting(true);
        try {
            await resetSetResults(getStorage(), userId, {
                source: set.source,
                setId: set.setId,
            });
            notify.success(
                t(
                    "learning_path.reset_all.success",
                    "Results reset. A new run starts with lesson 1.",
                ),
            );
            setResetOpen(false);
            onResultsReset?.();
            const first = set.lessons[0];
            if (first) {
                navigate(lessonRoute(set.source, set.setId, first.filename));
            }
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                `${t("learning_path.reset_all.failed", "The results could not be reset.")} ${detail}`,
            );
        } finally {
            setResetting(false);
        }
    };

    const actionClass =
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-app px-3 py-2 text-sm font-medium";

    const dueCount = set.lessons.filter(
        (l) => l.srs?.status === "due",
    ).length;
    const lessons = showOnlyDue
        ? set.lessons.filter((l) => l.srs?.status === "due")
        : set.lessons;

    return (
        <div
            className="border-t border-border px-3 pb-3 pt-1"
            data-testid={`set-detail-${set.setId}`}
        >
            {dueCount > 0 && (
                <div className="flex justify-end py-1">
                    <button
                        type="button"
                        onClick={() => setShowOnlyDue((v) => !v)}
                        aria-pressed={showOnlyDue}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-app px-2 text-sm text-fg-secondary hover:bg-muted"
                        data-testid={`set-due-filter-${set.setId}`}
                    >
                        <ListChecks size={14} aria-hidden="true" />
                        {showOnlyDue
                            ? t("srs.show_all", "Show all")
                            : t("srs.show_only_due", "Show only due")}
                    </button>
                </div>
            )}

            <ul className="flex flex-col">
                {lessons.map((lesson) => {
                    const details = lesson.elementDetails ?? [];
                    const isOpen = openLesson === lesson.filename;
                    return (
                        <li key={lesson.filename}>
                            <div className="flex items-center gap-1">
                                <div className="min-w-0 flex-1">
                                    <LessonRow lesson={lesson} />
                                </div>
                                <FavoriteToggle
                                    isFavorite={isFavorite(
                                        lesson.setId,
                                        lesson.filename,
                                    )}
                                    onToggle={() =>
                                        toggle({
                                            source: lesson.source,
                                            setId: lesson.setId,
                                            filename: lesson.filename,
                                            title: lesson.title,
                                            setTitle: set.title,
                                        })
                                    }
                                    addLabel={t(
                                        "favorites.add",
                                        "Add to favorites",
                                    )}
                                    removeLabel={t(
                                        "favorites.remove",
                                        "Remove from favorites",
                                    )}
                                    size={16}
                                    testId={`favorite-toggle-${lesson.filename}`}
                                />
                            </div>
                            <div className="ml-7 flex flex-wrap items-center gap-3">
                                {details.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenLesson(
                                                isOpen ? null : lesson.filename,
                                            )
                                        }
                                        aria-expanded={isOpen}
                                        className="inline-flex items-center gap-1 py-1 text-xs text-fg-muted hover:text-fg-secondary"
                                        data-testid={`lesson-details-toggle-${lesson.filename}`}
                                    >
                                        <ChevronDown
                                            size={12}
                                            aria-hidden="true"
                                            className={isOpen ? "rotate-180" : ""}
                                        />
                                        {isOpen
                                            ? t("srs.hide_details", "Hide details")
                                            : t("srs.details", "Element details")}
                                    </button>
                                )}
                                {/* #1012 — per-lesson "Fehler trainieren":
                                    scoped to this lesson's failed cards, hidden
                                    when the lesson has no active errors. */}
                                <TrainErrorsButton
                                    setId={lesson.setId}
                                    lessonId={lesson.filename}
                                    errorCount={lessonErrorCount(lesson)}
                                    className="px-2 py-1 text-xs"
                                />
                            </div>
                            {isOpen && (
                                <div className="ml-7 mb-2">
                                    <ElementDetailList
                                        items={toElementItems(details, t)}
                                        lastAnswerLabel={t(
                                            "srs.last_answer",
                                            "Your answer:",
                                        )}
                                        correctLabel={t(
                                            "srs.correct",
                                            "Correct:",
                                        )}
                                        emptyLabel={t(
                                            "srs.no_elements",
                                            "No tracked elements yet.",
                                        )}
                                        testId={`lesson-elements-${lesson.filename}`}
                                    />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {/* #1012 — set-wide "Fehler trainieren": the gated adaptive
                    entry (every lesson's failed cards). Hidden when the set
                    has no active errors (the adaptive lesson would dead-end on
                    "empty" otherwise) — the Dashboard FocusAreasCard + lesson
                    summary still surface the adaptive lesson when relevant. */}
                <TrainErrorsButton
                    setId={set.setId}
                    errorCount={set.errorCount}
                />
                {/* #3171 — "Alles wiederholen": reset the set's results and
                    rebuild the average from lesson 1. Only offered once the
                    set has results to reset. */}
                {hasResults(set) && (
                    <button
                        type="button"
                        onClick={() => void requestReset()}
                        className={`${actionClass} border border-border text-foreground hover:bg-muted`}
                        data-testid={`set-reset-results-${set.setId}`}
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("learning_path.reset_all.button", "Repeat everything")}
                    </button>
                )}
                {/* #1014 — set-level Zufallsmodus: interleave every lesson's
                    exercises. Needs >= 2 lessons to interleave; the page itself
                    re-checks "with exercises" and shows an empty state if the
                    bundle can't be shuffled. */}
                {set.totalCount >= 2 && (
                    <Link
                        to={`/shuffle-lesson/${encodeURIComponent(set.setId)}`}
                        data-slot="button"
                        className={`${actionClass} border border-border text-foreground hover:bg-muted`}
                        data-testid={`set-shuffle-${set.setId}`}
                    >
                        <Shuffle size={16} aria-hidden="true" />
                        {t("learning_path.shuffle", "Shuffle")}
                    </Link>
                )}
                {set.errorCount > 0 && (
                    <Link
                        to={`/review/${encodeURIComponent(set.setId)}`}
                        data-slot="button"
                        className={`${actionClass} border border-border text-foreground hover:bg-muted`}
                        data-testid={`set-error-replay-${set.setId}`}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {t("learning_path.error_replay", "Retry errors")} (
                        {set.errorCount})
                    </Link>
                )}
                {/* #1015 — Endlos-Modus: a continuous SRS practice stream over
                    the set (due -> new -> random repetition, never finishes).
                    Needs >= 1 lesson with exercises; the page re-checks and
                    shows an empty state otherwise. */}
                {set.totalCount >= 1 && (
                    <Link
                        to={`/endless-lesson/${encodeURIComponent(set.setId)}`}
                        data-slot="button"
                        className={`${actionClass} border border-border text-foreground hover:bg-muted`}
                        data-testid={`set-endless-${set.setId}`}
                    >
                        <InfinityIcon size={16} aria-hidden="true" />
                        {t("learning_path.endless", "Endless")}
                    </Link>
                )}
            </div>

            <ResetSetResultsDialog
                open={resetOpen}
                setTitle={set.title}
                summary={resetSummary}
                busy={resetting}
                onConfirm={() => void confirmReset()}
                onCancel={() => setResetOpen(false)}
            />
        </div>
    );
}
