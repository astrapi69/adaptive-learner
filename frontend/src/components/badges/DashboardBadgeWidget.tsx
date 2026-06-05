/**
 * Dashboard badge widget (Phase 57 / v1.40.0 / 57F).
 *
 * Compact badge summary for the Dashboard, replacing the plain
 * BadgeShowcase grid: the earned count, the 3 most-recently-earned
 * badges with their tier-coloured mini icons, and a "next badge"
 * pointer (the first locked badge). Every element opens the full
 * BadgeGallery drawer — the count + recent icons open it unfiltered;
 * the next-badge pointer opens it filtered to that badge's category.
 */

import {useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/useI18n";
import {generateBadgeSvg, type BadgeTier} from "../../lib/badges/badge-svg";
import type {BadgeWithProgress} from "../../storage/types";
import BadgeGallery from "./BadgeGallery";

export interface DashboardBadgeWidgetProps {
    badges: BadgeWithProgress[] | null;
}

export default function DashboardBadgeWidget({
    badges,
}: DashboardBadgeWidgetProps) {
    const {t} = useI18n();
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<string | undefined>(undefined);

    if (badges === null) {
        return (
            <div data-testid="dashboard-badge-loading" className="badge-widget">
                {t("ui.common.loading", "Loading…")}
            </div>
        );
    }

    const earned = badges.filter((b) => b.earned);
    const recent = [...earned]
        .sort((a, b) => (b.earned_at ?? "").localeCompare(a.earned_at ?? ""))
        .slice(0, 3);
    const nextBadge = badges.find((b) => !b.earned) ?? null;

    const openGallery = (cat?: string) => {
        setCategory(cat);
        setOpen(true);
    };

    return (
        <div className="badge-widget" data-testid="dashboard-badge-widget">
            <button
                type="button"
                className="badge-widget-count"
                data-testid="badge-widget-count"
                onClick={() => openGallery()}
            >
                {t("gamification.gallery.count", "{earned} / {total} earned")
                    .replace("{earned}", String(earned.length))
                    .replace("{total}", String(badges.length))}
            </button>

            {recent.length > 0 ? (
                <div className="badge-widget-recent">
                    {recent.map((b) => (
                        <button
                            key={b.key}
                            type="button"
                            className="badge-widget-icon-btn"
                            data-testid={`badge-widget-recent-${b.key}`}
                            title={t(b.name_key, b.key)}
                            onClick={() => openGallery()}
                        >
                            <img
                                src={generateBadgeSvg(
                                    b.key,
                                    (b.tier as BadgeTier) ?? "bronze",
                                )}
                                alt={t(b.name_key, b.key)}
                                width={32}
                                height={32}
                            />
                        </button>
                    ))}
                </div>
            ) : (
                <p className="badge-widget-empty">
                    {t("gamification.badges_empty", "No badges available yet.")}
                </p>
            )}

            {nextBadge && (
                <button
                    type="button"
                    className="badge-widget-next"
                    data-testid="badge-widget-next"
                    onClick={() => openGallery(nextBadge.category)}
                >
                    <img
                        src={generateBadgeSvg(nextBadge.key, "locked")}
                        alt=""
                        width={32}
                        height={32}
                    />
                    <span className="badge-widget-next-text">
                        <span className="badge-widget-next-label">
                            {t("gamification.gallery.next_badge", "Next badge")}
                        </span>
                        <span className="badge-widget-next-name">
                            {t(nextBadge.name_key, nextBadge.key)}
                        </span>
                    </span>
                </button>
            )}

            <Button
                type="button"
                variant="secondary"
                className="badge-widget-view-all"
                data-testid="badge-widget-view-all"
                onClick={() => openGallery()}
            >
                {t("gamification.gallery.view_all", "View all badges")}
            </Button>

            <BadgeGallery
                key={category ?? "all"}
                open={open}
                onClose={() => setOpen(false)}
                badges={badges}
                initialCategory={category}
            />
        </div>
    );
}
