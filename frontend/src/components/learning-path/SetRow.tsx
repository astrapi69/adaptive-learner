/**
 * SetRow — one set's Level-1 summary row in the redesigned Learning
 * Path (feature/learning-path-redesign).
 *
 * Answers "wo bin ich?" at a glance for a single course: domain icon
 * + title, a compact mini progress track (● done / ◐ in-progress /
 * ○ not-started), the percentage, the last-activity hint, the
 * current/next lesson title, and ONE action (resume / start /
 * next-level / completed). Clicking the row body toggles the inline
 * Level-2 detail (rendered by the parent and passed as ``children``).
 *
 * Pure presentation: all data comes from a ``PersonalPathSet``
 * (see lib/learning-path/personal-path.ts). Tailwind only; 44px
 * touch targets; works across all 6 themes via the CSS-variable
 * tokens.
 */

import {
    ArrowRight,
    Brain,
    CheckCircle2,
    ChevronDown,
    Code,
    Calculator,
    Flag,
    GraduationCap,
    Play,
} from "lucide-react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/useI18n";
import {cn} from "../../lib/utils";
import {lessonRoute} from "../../lib/content/continue-learning";
import {relativeTime} from "../../lib/utils/relative-time";
import type {PersonalPathSet} from "../../lib/learning-path/personal-path";

function DomainIcon({domain}: {domain: string}) {
    const props = {size: 18, "aria-hidden": true as const};
    if (domain === "programming") return <Code {...props} />;
    if (domain === "psychology") return <Brain {...props} />;
    if (domain === "math") return <Calculator {...props} />;
    if (domain === "language") return <Flag {...props} />;
    return <GraduationCap {...props} />;
}

/** Mini progress track — one dot per lesson, themed by state. */
function ProgressTrack({set}: {set: PersonalPathSet}) {
    const {t} = useI18n();
    return (
        <div
            className="flex flex-wrap gap-0.5 md:gap-1"
            data-testid={`set-track-${set.setId}`}
            role="img"
            aria-label={t(
                "learning_path.personal.track_aria",
                "{done} of {total} lessons done",
            )
                .replace("{done}", String(set.completedCount))
                .replace("{total}", String(set.totalCount))}
        >
            {set.lessons.map((lesson) => (
                <span
                    key={lesson.filename}
                    data-dot={lesson.dot}
                    className={cn(
                        "h-2 w-2 rounded-full md:h-3 md:w-3",
                        lesson.dot === "done" && "bg-success",
                        lesson.dot === "in_progress" && "bg-warning",
                        lesson.dot === "not_started" && "bg-fg-muted/30",
                    )}
                />
            ))}
        </div>
    );
}

/** The single context-aware action for the set (resume/start/etc.).
 *  Responsive: icon-only on mobile (label hidden, kept as the
 *  accessible name), icon + text from sm up. */
function SetAction({set}: {set: PersonalPathSet}) {
    const {t} = useI18n();
    const base =
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-app px-3 py-2 text-sm font-medium";

    if (set.mode === "set_complete") {
        // Completed — offer the next CEFR level when one exists.
        if (set.nextLevel) {
            const label = t(
                "learning_path.next_level",
                "Next level available",
            );
            const to = set.nextLevel.downloaded
                ? "/learning-path"
                : "/content";
            return (
                <Link
                    to={to}
                    // #779 — mark button-styled anchors so the global
                    // ``a:not([data-slot="button"]){color:var(--accent)}``
                    // rule skips them; otherwise it overrides
                    // ``text-accent-fg`` and the label goes accent-on-accent
                    // (invisible) in every theme.
                    data-slot="button"
                    className={cn(base, "bg-accent text-accent-fg")}
                    data-testid={`set-action-${set.setId}`}
                    data-mode="next_level"
                    aria-label={label}
                    title={label}
                >
                    <ArrowRight size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">{label}</span>
                </Link>
            );
        }
        const label = t("learning_path.completed", "Completed");
        return (
            <span
                className={cn(base, "text-success")}
                data-testid={`set-action-${set.setId}`}
                data-mode="completed"
                aria-label={label}
                title={label}
            >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
            </span>
        );
    }

    const label =
        set.mode === "start"
            ? t("learning_path.start", "Start")
            : t("learning_path.continue", "Resume");
    const target = set.currentLesson;
    const to = target
        ? lessonRoute(set.source, set.setId, target.filename)
        : "/content";
    return (
        <Link
            to={to}
            data-slot="button"
            className={cn(base, "bg-accent text-accent-fg")}
            data-testid={`set-action-${set.setId}`}
            data-mode={set.mode}
            aria-label={label}
            title={label}
        >
            <Play size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
        </Link>
    );
}

export interface SetRowProps {
    set: PersonalPathSet;
    isExpanded: boolean;
    onToggle: () => void;
    /** Level-2 detail, rendered inline when expanded. */
    children?: React.ReactNode;
}

export default function SetRow({
    set,
    isExpanded,
    onToggle,
    children,
}: SetRowProps) {
    const {t, lang} = useI18n();

    const currentLine =
        set.mode === "set_complete"
            ? t(
                  "learning_path.personal.all_done",
                  "All {n} lessons completed!",
              ).replace("{n}", String(set.totalCount))
            : set.mode === "start"
              ? t("learning_path.not_started", "Not started yet")
              : `${t("learning_path.node.lesson", "Lesson")} ${
                    set.currentLesson?.number ?? ""
                }: ${set.currentLesson?.title ?? ""}`;

    const activity = set.lastActivity
        ? relativeTime(new Date(set.lastActivity), lang)
        : set.completedCount === 0
          ? t("learning_path.personal.downloaded", "Downloaded")
          : "";

    return (
        <div
            className="rounded-app border border-border bg-card"
            data-testid={`set-row-${set.setId}`}
            data-expanded={isExpanded ? "true" : "false"}
        >
            <div className="flex items-stretch gap-2 p-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-app text-left"
                    data-testid={`set-toggle-${set.setId}`}
                >
                    <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className={cn(
                            "shrink-0 text-fg-muted transition-transform motion-reduce:transition-none",
                            isExpanded && "rotate-180",
                        )}
                    />
                    <span className="shrink-0 text-accent">
                        <DomainIcon domain={set.domain} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-foreground">
                                {set.title}
                            </span>
                            <span
                                className="shrink-0 text-sm font-medium text-fg-secondary"
                                data-testid={`set-percent-${set.setId}`}
                            >
                                {set.percentComplete}%
                                {set.mode === "set_complete" && " ✓"}
                            </span>
                        </span>
                        <ProgressTrack set={set} />
                        <span className="flex items-center justify-between gap-2 text-sm text-fg-muted">
                            <span className="truncate">{currentLine}</span>
                            {activity && (
                                <span
                                    className="shrink-0"
                                    data-testid={`set-activity-${set.setId}`}
                                >
                                    {activity}
                                </span>
                            )}
                        </span>
                    </span>
                </button>
                <div className="flex shrink-0 items-center">
                    <SetAction set={set} />
                </div>
            </div>
            {isExpanded && children}
        </div>
    );
}
