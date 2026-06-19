/**
 * Dashboard badge showcase (Phase 29B / v1.16.0).
 *
 * Renders every catalog badge grouped by category. Earned ones
 * show in color with an earn date; locked ones show greyed out
 * with their description as the hint for what to do next.
 *
 * Icons are referenced by lookup string (matches the YAML
 * ``icon`` field). The component maps the lookup to a Unicode
 * glyph so the bundle stays tiny — no SVG sprite, no Lucide
 * import — and accessibility lives in the ``title`` + the
 * underlying name_key text.
 */

import {useI18n} from "../hooks/ui/useI18n";
import type {BadgeWithProgress} from "../storage/types";

const ICON_GLYPH: Record<string, string> = {
    rocket: "🚀",
    target: "🎯",
    inbox: "📥",
    flame: "🔥",
    compass: "🧭",
    brain: "🧠",
    layers: "🗂️",
    book: "📚",
    star: "⭐",
    globe: "🌐",
    sparkles: "✨",
};

interface BadgeShowcaseProps {
    badges: BadgeWithProgress[] | null;
}

export default function BadgeShowcase({badges}: BadgeShowcaseProps) {
    const {t} = useI18n();
    if (!badges) {
        return (
            <div className="badge-showcase" data-testid="badge-showcase-loading">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </div>
        );
    }
    if (badges.length === 0) {
        return (
            <div className="badge-showcase" data-testid="badge-showcase-empty">
                <p className="muted">
                    {t(
                        "gamification.badges_empty",
                        "No badges available yet.",
                    )}
                </p>
            </div>
        );
    }
    const earnedCount = badges.filter((b) => b.earned).length;
    const grouped = groupByCategory(badges);
    return (
        <div className="badge-showcase" data-testid="badge-showcase">
            <div className="badge-showcase__summary">
                <span data-testid="badge-showcase-count">
                    {earnedCount} / {badges.length}{" "}
                    {t("gamification.badges_earned", "earned")}
                </span>
            </div>
            {Object.entries(grouped).map(([category, items]) => (
                <section
                    key={category}
                    className="badge-showcase__category"
                    data-testid={`badge-category-${category}`}
                >
                    <h3 className="badge-showcase__category-title">
                        {t(
                            `gamification.badge_category.${category}`,
                            category,
                        )}
                    </h3>
                    <ul className="badge-showcase__grid">
                        {items.map((badge) => (
                            <li
                                key={badge.key}
                                className={
                                    "badge-tile " +
                                    (badge.earned
                                        ? "badge-tile--earned"
                                        : "badge-tile--locked")
                                }
                                data-testid={`badge-${badge.key}`}
                                data-earned={badge.earned ? "true" : "false"}
                            >
                                <span
                                    className="badge-tile__icon"
                                    aria-hidden="true"
                                >
                                    {ICON_GLYPH[badge.icon] ?? "🏅"}
                                </span>
                                <span className="badge-tile__name">
                                    {t(badge.name_key, badge.key)}
                                </span>
                                <span className="badge-tile__description">
                                    {t(
                                        badge.description_key,
                                        badge.description_key,
                                    )}
                                </span>
                                {badge.earned && badge.earned_at && (
                                    <span
                                        className="badge-tile__earned-at"
                                        data-testid={`badge-${badge.key}-earned-at`}
                                    >
                                        {new Date(
                                            badge.earned_at,
                                        ).toLocaleDateString()}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}

function groupByCategory(
    badges: BadgeWithProgress[],
): Record<string, BadgeWithProgress[]> {
    const out: Record<string, BadgeWithProgress[]> = {};
    for (const b of badges) {
        if (!out[b.category]) out[b.category] = [];
        out[b.category].push(b);
    }
    return out;
}
