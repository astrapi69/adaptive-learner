/**
 * LessonRow — one lesson's Level-2 detail row in the redesigned
 * Learning Path (feature/learning-path-redesign).
 *
 * Shown inside an expanded SetRow: lesson number + title, stars
 * (0-3, or — if never attempted), per-direction mastery dots
 * (rezeptiv / produktiv from EXP-018), the last-attempt hint, and a
 * ▶ marker on the set's current lesson. The whole row is a link to
 * the lesson viewer (start / resume). Pure presentation; data comes
 * from a ``PersonalPathLesson``. Tailwind only, 44px touch target.
 */

import {Play, Star} from "lucide-react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import {cn} from "../../lib/utils";
import {lessonRoute} from "../../lib/content/browse/continue-learning";
import {relativeTime} from "../../lib/utils/relative-time";
import ElementProgressBar from "../../shared/gamification/ElementProgressBar";
import SrsStatusBadge, {type SrsBadgeTone} from "../../shared/gamification/SrsStatusBadge";
import type {SrsLessonStatus} from "../../lib/srs/status";
import type {
    MasteryState,
    PersonalPathLesson,
} from "../../lib/learning-path/personal-path";

const SRS_TONE: Record<SrsLessonStatus, SrsBadgeTone> = {
    new: "neutral",
    learning: "info",
    due: "warning",
    mastered: "success",
};

const SRS_LABEL: Record<SrsLessonStatus, [string, string]> = {
    new: ["srs.status_new", "New"],
    learning: ["srs.status_learning", "Learning"],
    due: ["srs.status_due", "Due"],
    mastered: ["srs.status_mastered", "Mastered"],
};

/** Compact 0-3 star row. */
function Stars({stars}: {stars: number}) {
    return (
        <span
            className="inline-flex shrink-0"
            aria-label={`${stars}/3`}
            data-testid="lesson-row-stars"
        >
            {[1, 2, 3].map((n) => (
                <Star
                    key={n}
                    size={13}
                    className={
                        n <= stars
                            ? "fill-[var(--star,currentColor)] text-accent"
                            : "text-fg-muted/40"
                    }
                    aria-hidden="true"
                />
            ))}
        </span>
    );
}

/** A single direction mastery indicator (dot + short label). */
function MasteryDot({
    state,
    label,
}: {
    state: MasteryState;
    label: string;
}) {
    return (
        <span
            className="inline-flex items-center gap-1 text-xs text-fg-muted"
            data-mastery={state}
        >
            <span
                className={cn(
                    "h-2 w-2 rounded-full",
                    state === "mastered" && "bg-success",
                    state === "in_progress" && "bg-warning",
                    (state === "na" || state === "not_started") &&
                        "border border-fg-muted/40",
                )}
                aria-hidden="true"
            />
            {label}
        </span>
    );
}

export interface LessonRowProps {
    lesson: PersonalPathLesson;
}

export default function LessonRow({lesson}: LessonRowProps) {
    const {t, lang} = useI18n();
    const attempted = lesson.status !== "not_started";
    const number = String(lesson.number).padStart(2, "0");

    return (
        <Link
            to={lessonRoute(lesson.source, lesson.setId, lesson.filename)}
            data-testid={`lesson-row-${lesson.setId}-${lesson.filename}`}
            data-current={lesson.isCurrent ? "true" : "false"}
            className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-app px-2 py-1.5 hover:bg-muted md:gap-3",
                lesson.isCurrent &&
                    "border-l-2 border-accent bg-accent/5 pl-[6px]",
            )}
        >
            <span className="flex w-5 shrink-0 justify-center text-accent">
                {lesson.isCurrent && <Play size={14} aria-hidden="true" />}
            </span>
            <span className="w-6 shrink-0 text-sm tabular-nums text-fg-muted">
                {number}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {lesson.title}
            </span>
            {lesson.srs && lesson.srs.total > 0 && (
                <SrsStatusBadge
                    label={t(...SRS_LABEL[lesson.srs.status])}
                    tone={SRS_TONE[lesson.srs.status]}
                    testId={`lesson-row-srs-${lesson.filename}`}
                />
            )}
            {lesson.srs && lesson.srs.total > 0 && (
                <span className="hidden shrink-0 md:inline">
                    <ElementProgressBar
                        mastered={lesson.srs.mastered}
                        total={lesson.srs.total}
                        ariaLabel={t(
                            "srs.elements_mastered_aria",
                            "{mastered} of {total} elements mastered",
                        )
                            .replace("{mastered}", String(lesson.srs.mastered))
                            .replace("{total}", String(lesson.srs.total))}
                    />
                </span>
            )}
            {attempted ? (
                <Stars stars={lesson.stars} />
            ) : (
                <span
                    className="shrink-0 text-sm text-fg-muted/60"
                    data-testid="lesson-row-nostars"
                    aria-hidden="true"
                >
-
                </span>
            )}
            {attempted && (
                <span className="hidden shrink-0 items-center gap-2 sm:flex">
                    <MasteryDot
                        state={lesson.receptive}
                        label={t(
                            "learning_path.mastery.receptive",
                            "receptive",
                        )}
                    />
                    <MasteryDot
                        state={lesson.productive}
                        label={t(
                            "learning_path.mastery.productive",
                            "productive",
                        )}
                    />
                </span>
            )}
            <span
                className="hidden w-20 shrink-0 text-right text-xs text-fg-muted md:inline"
                data-testid={`lesson-row-date-${lesson.filename}`}
            >
                {lesson.lastActivity
                    ? relativeTime(new Date(lesson.lastActivity), lang)
                    : "-"}
            </span>
        </Link>
    );
}
