/**
 * LessonNodeView — the presentational core of a learning-path lesson
 * node (Phase 66B / EXP-022). Pure + React-Flow-free so it renders
 * and tests without the React Flow store; ``LessonNode`` wraps it
 * with the graph Handles.
 *
 * Visualises a lesson's state: stars (0-3), per-direction mastery
 * (EXP-018), XP earned, exercise count, and a status colour
 * (not-started / in-progress / paused / completed / mastered).
 * Recommended = the adaptive generator's next pick (pulsing accent);
 * locked = a prerequisite isn't met (lock overlay, not clickable).
 */

import {memo} from "react";
import {Lock, Star} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";

export type LessonNodeStatus =
    | "not_started"
    | "in_progress"
    | "paused"
    | "completed"
    | "mastered";

export interface LessonNodeData {
    lessonNumber: number;
    title: string;
    stars: number;
    status: LessonNodeStatus;
    receptiveMastered: boolean;
    productiveMastered: boolean;
    xp: number;
    exerciseCount: number;
    recommended: boolean;
    locked: boolean;
    lockReason?: string;
    /** Navigation target (set when not locked). */
    setSlug: string;
    setId: string;
    lessonFilename: string;
    [key: string]: unknown;
}

const TITLE_MAX = 20;

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

export interface LessonNodeViewProps {
    data: LessonNodeData;
    onActivate?: () => void;
}

export const LessonNodeView = memo(function LessonNodeView({data, onActivate}: LessonNodeViewProps) {
    const {t} = useI18n();
    const statusClass = `lesson-node--${data.status.replace(/_/g, "-")}`;
    const statusLabel = t(
        `learning_path.status.${data.status.replace(/_/g, "_")}`,
        data.status.replace(/_/g, " "),
    );
    const ariaLabel =
        `${t("learning_path.node.lesson", "Lesson")} ${data.lessonNumber}: ` +
        `${data.title}, ${data.stars}/3 ${t("learning_path.node.stars", "stars")}, ${statusLabel}` +
        (data.recommended
            ? `, ${t("learning_path.node.recommended", "Recommended")}`
            : "") +
        (data.locked
            ? `, ${t("learning_path.node.locked", "Locked")}` +
              (data.lockReason ? `: ${data.lockReason}` : "")
            : "") +
        (data.xp > 0
            ? `, ${data.xp} ${t("learning_path.node.xp", "XP")}`
            : "");

    return (
        <button
            type="button"
            className={
                `lesson-node ${statusClass}` +
                (data.recommended ? " is-recommended" : "") +
                (data.locked ? " is-locked" : "")
            }
            data-testid={`lesson-node-${data.setId}-${data.lessonFilename}`}
            data-status={data.status}
            data-recommended={data.recommended ? "true" : "false"}
            data-locked={data.locked ? "true" : "false"}
            aria-label={ariaLabel}
            title={data.locked ? data.lockReason : data.title}
            disabled={data.locked}
            onClick={() => {
                if (!data.locked) onActivate?.();
            }}
        >
            {data.recommended && (
                <span
                    className="lesson-node-badge-recommended"
                    data-testid="lesson-node-recommended"
                >
                    {t("learning_path.node.recommended", "Recommended")}
                </span>
            )}
            {data.xp > 0 && (
                <span className="lesson-node-badge-xp" aria-hidden="true">
                    {data.xp} XP
                </span>
            )}

            <span className="lesson-node-title">
                <strong>{data.lessonNumber}.</strong>{" "}
                {truncate(data.title, TITLE_MAX)}
            </span>

            <span
                className="lesson-node-stars"
                data-testid="lesson-node-stars"
                aria-hidden="true"
            >
                {[1, 2, 3].map((n) => (
                    <Star
                        key={n}
                        size={12}
                        fill={n <= data.stars ? "currentColor" : "none"}
                        className={
                            n <= data.stars
                                ? "lesson-node-star is-earned"
                                : "lesson-node-star"
                        }
                    />
                ))}
            </span>

            <span className="lesson-node-footer">
                <span className="lesson-node-mastery" aria-hidden="true">
                    {data.receptiveMastered && (
                        <span
                            className="lesson-node-mastery-pill is-receptive"
                            data-testid="lesson-node-receptive"
                        >
                            {t("learning_path.node.receptive_short", "R")} ✓
                        </span>
                    )}
                    {data.productiveMastered && (
                        <span
                            className="lesson-node-mastery-pill is-productive"
                            data-testid="lesson-node-productive"
                        >
                            {t("learning_path.node.productive_short", "P")} ✓
                        </span>
                    )}
                </span>
                <span className="lesson-node-exercises muted">
                    {t("learning_path.node.exercises", "{n} exercises").replace(
                        "{n}",
                        String(data.exerciseCount),
                    )}
                </span>
            </span>

            {data.locked && (
                <span
                    className="lesson-node-lock"
                    data-testid="lesson-node-lock"
                    aria-hidden="true"
                >
                    <Lock size={14} />
                </span>
            )}
        </button>
    );
});
