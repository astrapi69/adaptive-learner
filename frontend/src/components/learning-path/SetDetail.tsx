/**
 * SetDetail — the inline Level-2 panel revealed when a SetRow is
 * expanded (feature/learning-path-redesign; SRS surface added in #588).
 *
 * Lists every lesson of the set (LessonRow) with a "Show only due"
 * filter and a per-lesson element-detail expansion (the SRS element
 * breakdown), plus a context-aware action bar: "Start adaptive lesson"
 * and, when the set has active errors, "Retry errors" (the set-wide SRS
 * review queue). Tailwind, 44px targets.
 */

import {ChevronDown, ListChecks, RefreshCw, Shuffle} from "lucide-react";
import {useState} from "react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import {useFavorites} from "../../hooks/learning/useFavorites";
import {readLearnerState} from "../../lib/learning/learnerState";
import ElementDetailList, {
    type ElementDetailItem,
} from "../../shared/gamification/ElementDetailList";
import FavoriteToggle from "../../shared/media/FavoriteToggle";
import type {SrsBadgeTone} from "../../shared/gamification/SrsStatusBadge";
import LessonRow from "./LessonRow";
import TrainErrorsButton from "../lesson/TrainErrorsButton";
import type {
    PersonalPathLesson,
    PersonalPathSet,
} from "../../lib/learning-path/personal-path";
import type {SrsElementDetail} from "../../lib/srs/status";

export interface SetDetailProps {
    set: PersonalPathSet;
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

export default function SetDetail({set}: SetDetailProps) {
    const {t} = useI18n();
    const userId = readLearnerState().userId;
    const {isFavorite, toggle} = useFavorites(userId);
    const [showOnlyDue, setShowOnlyDue] = useState(false);
    const [openLesson, setOpenLesson] = useState<string | null>(null);

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
            </div>
        </div>
    );
}
