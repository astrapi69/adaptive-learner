/**
 * MilestoneOverlay (EXP-008 / Phase 55D).
 *
 * A single toast-style overlay anchored to the top of the
 * viewport announcing one milestone (streak / level-up / mastery
 * count / badge). Non-blocking, auto-dismissed by the host. The
 * fly-in animation is CSS-only and suppressed under
 * prefers-reduced-motion.
 */

import {Award, Flame, Sparkles, Trophy} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";
import type {Milestone} from "../../lib/feedback/milestones";

export interface MilestoneOverlayProps {
    milestone: Milestone;
    /** Invoked when the user taps the "view all badges" link on a
     *  badge milestone. */
    onViewBadges?: () => void;
    /** Manual dismiss (click the overlay). */
    onDismiss?: () => void;
}

function iconFor(type: Milestone["type"]) {
    switch (type) {
        case "streak":
            return <Flame size={24} aria-hidden="true" />;
        case "level_up":
            return <Sparkles size={24} aria-hidden="true" />;
        case "mastery":
            return <Trophy size={24} aria-hidden="true" />;
        case "badge":
            return <Award size={24} aria-hidden="true" />;
    }
}

export default function MilestoneOverlay({
    milestone,
    onViewBadges,
    onDismiss,
}: MilestoneOverlayProps) {
    const {t} = useI18n();

    let title = "";
    let subtitle: string | null = null;
    switch (milestone.type) {
        case "streak":
            title = t("milestone.streak", "{n}-Day Streak!").replace(
                "{n}",
                String(milestone.value),
            );
            break;
        case "level_up":
            title = t("milestone.level_up", "Level {n} reached!").replace(
                "{n}",
                String(milestone.value),
            );
            break;
        case "mastery":
            title = t(
                "milestone.mastery",
                "{n} Elements Mastered!",
            ).replace("{n}", String(milestone.value));
            break;
        case "badge":
            title = milestone.badgeName ?? t("milestone.badge", "Badge earned!");
            subtitle = milestone.badgeDescription ?? null;
            break;
    }

    return (
        <div
            className="milestone-overlay"
            data-testid="milestone-overlay"
            data-milestone-type={milestone.type}
            role="status"
            aria-live="polite"
            onClick={onDismiss}
        >
            <span className="milestone-overlay-icon">
                {iconFor(milestone.type)}
            </span>
            <span className="milestone-overlay-text">
                <strong
                    className="milestone-overlay-title"
                    data-testid="milestone-overlay-title"
                >
                    {title}
                </strong>
                {subtitle && (
                    <span className="milestone-overlay-subtitle">
                        {subtitle}
                    </span>
                )}
                {milestone.type === "badge" && onViewBadges && (
                    <button
                        type="button"
                        className="milestone-overlay-link"
                        data-testid="milestone-view-badges"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewBadges();
                        }}
                    >
                        {t(
                            "milestone.view_all_badges",
                            "Tap to view all badges",
                        )}
                    </button>
                )}
            </span>
        </div>
    );
}
