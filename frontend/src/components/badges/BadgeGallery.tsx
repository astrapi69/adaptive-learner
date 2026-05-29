/**
 * Badge Gallery drawer (Phase 57 / v1.40.0 / F-129).
 *
 * Radix Dialog slide-over (mirrors HelpDrawer) that browses every
 * catalog badge with its tier-coloured SVG icon. Controlled: the
 * parent owns ``open`` + the already-fetched ``badges`` list (from
 * ``getStorage().gamification.listBadges``) and an optional
 * ``initialCategory`` filter.
 *
 * Per card: tier-coloured icon (greyed when locked), name, tier label,
 * earned date, and — for DYNAMIC badges — a 3-segment tier-progress
 * indicator + the next-tier target. Locked badges stay visible with a
 * greyed icon + an unlock hint (shape carries meaning). Clicking a card
 * expands its full description + tier-threshold breakdown.
 *
 * No route — a transient overlay, exactly like HelpDrawer.
 */

import * as Dialog from "@radix-ui/react-dialog";
import {X} from "lucide-react";
import {useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {
    generateBadgeSvg,
    TIER_PALETTE,
    type BadgeTier,
} from "../../lib/badges/badge-svg";
import type {BadgeWithProgress} from "../../storage/types";

export interface BadgeGalleryProps {
    open: boolean;
    onClose: () => void;
    badges: BadgeWithProgress[] | null;
    /** Pre-select a category filter (e.g. opened from a category CTA). */
    initialCategory?: string;
}

const CATEGORIES = [
    "getting_started",
    "consistency",
    "method_explorer",
    "depth",
    "polyglot",
] as const;

const TIER_RANK: Record<string, number> = {bronze: 0, silver: 1, gold: 2};

type SortMode = "recent" | "progress" | "category";

function isDynamic(badge: BadgeWithProgress): boolean {
    return badge.tier_thresholds != null;
}

/** Effective tier for the icon: earned tier, else "locked". */
function iconTier(badge: BadgeWithProgress): BadgeTier {
    if (!badge.earned) return "locked";
    return (badge.tier as BadgeTier) ?? "bronze";
}

/** Next tier above the current one for a dynamic badge, or null at gold. */
function nextTier(badge: BadgeWithProgress): "silver" | "gold" | null {
    const cur = badge.earned ? badge.tier : "locked";
    if (!isDynamic(badge)) return null;
    if (cur === "locked" || cur === "bronze") {
        return badge.tier_thresholds?.silver ? "silver" : null;
    }
    if (cur === "silver") return badge.tier_thresholds?.gold ? "gold" : null;
    return null;
}

export default function BadgeGallery({
    open,
    onClose,
    badges,
    initialCategory,
}: BadgeGalleryProps) {
    const {t} = useI18n();
    const [category, setCategory] = useState<string>(initialCategory ?? "all");
    const [sort, setSort] = useState<SortMode>("recent");
    const [expanded, setExpanded] = useState<string | null>(null);

    const all = badges ?? [];
    const earnedCount = all.filter((b) => b.earned).length;

    const visible = useMemo(() => {
        const filtered =
            category === "all"
                ? [...all]
                : all.filter((b) => b.category === category);
        filtered.sort((a, b) => {
            if (sort === "category") {
                const c = a.category.localeCompare(b.category);
                return c !== 0 ? c : a.key.localeCompare(b.key);
            }
            if (sort === "progress") {
                // Earned-with-room-to-grow first, then maxed, then locked.
                const score = (x: BadgeWithProgress) =>
                    !x.earned ? 2 : nextTier(x) ? 0 : 1;
                const s = score(a) - score(b);
                return s !== 0 ? s : a.key.localeCompare(b.key);
            }
            // recent: earned (newest first) before locked.
            if (a.earned !== b.earned) return a.earned ? -1 : 1;
            if (a.earned && b.earned) {
                return (b.earned_at ?? "").localeCompare(a.earned_at ?? "");
            }
            return a.key.localeCompare(b.key);
        });
        return filtered;
    }, [all, category, sort]);

    const tierLabel = (tier: string): string =>
        t(`gamification.tier.${tier}`, tier);

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "var(--bg-overlay)",
                        zIndex: 1200,
                    }}
                />
                <Dialog.Content
                    data-testid="badge-gallery"
                    style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "min(640px, 100vw)",
                        background: "var(--surface)",
                        borderLeft: "1px solid var(--border)",
                        boxShadow: "var(--shadow-elevated)",
                        zIndex: 1201,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <div className="badge-gallery-header">
                        <div>
                            <Dialog.Title className="badge-gallery-title">
                                {t("gamification.gallery.title", "Badges")}
                            </Dialog.Title>
                            <p
                                className="badge-gallery-count"
                                data-testid="badge-gallery-count"
                            >
                                {t(
                                    "gamification.gallery.count",
                                    "{earned} / {total} earned",
                                )
                                    .replace("{earned}", String(earnedCount))
                                    .replace("{total}", String(all.length))}
                            </p>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="badge-gallery-close"
                                aria-label={t("ui.common.close", "Close")}
                                data-testid="badge-gallery-close"
                            >
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="badge-gallery-controls">
                        <div
                            className="badge-gallery-filters"
                            role="tablist"
                            aria-label={t("gamification.gallery.title", "Badges")}
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={category === "all"}
                                className={`badge-gallery-filter${category === "all" ? " is-active" : ""}`}
                                onClick={() => setCategory("all")}
                                data-testid="badge-filter-all"
                            >
                                {t("gamification.gallery.filter_all", "All")}
                            </button>
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    role="tab"
                                    aria-selected={category === cat}
                                    className={`badge-gallery-filter${category === cat ? " is-active" : ""}`}
                                    onClick={() => setCategory(cat)}
                                    data-testid={`badge-filter-${cat}`}
                                >
                                    {t(`gamification.badge_category.${cat}`, cat)}
                                </button>
                            ))}
                        </div>
                        <label className="badge-gallery-sort">
                            <span>
                                {t("gamification.gallery.sort_label", "Sort by")}
                            </span>
                            <select
                                value={sort}
                                onChange={(e) =>
                                    setSort(e.target.value as SortMode)
                                }
                                data-testid="badge-gallery-sort"
                            >
                                <option value="recent">
                                    {t(
                                        "gamification.gallery.sort_recent",
                                        "Recently earned",
                                    )}
                                </option>
                                <option value="progress">
                                    {t(
                                        "gamification.gallery.sort_progress",
                                        "Progress to next tier",
                                    )}
                                </option>
                                <option value="category">
                                    {t(
                                        "gamification.gallery.sort_category",
                                        "Category",
                                    )}
                                </option>
                            </select>
                        </label>
                    </div>

                    <div
                        className="badge-gallery-grid"
                        data-testid="badge-gallery-grid"
                    >
                        {visible.map((badge) => {
                            const tier = iconTier(badge);
                            const dynamic = isDynamic(badge);
                            const next = nextTier(badge);
                            const isOpen = expanded === badge.key;
                            return (
                                <div
                                    key={badge.key}
                                    className={`badge-card${badge.earned ? " is-earned" : " is-locked"}`}
                                    data-testid={`badge-card-${badge.key}`}
                                    data-earned={badge.earned}
                                    data-tier={tier}
                                >
                                    <button
                                        type="button"
                                        className="badge-card-main"
                                        onClick={() =>
                                            setExpanded(isOpen ? null : badge.key)
                                        }
                                        aria-expanded={isOpen}
                                        data-testid={`badge-card-toggle-${badge.key}`}
                                    >
                                        <img
                                            className="badge-card-icon"
                                            src={generateBadgeSvg(badge.key, tier)}
                                            alt=""
                                            width={56}
                                            height={56}
                                        />
                                        <span className="badge-card-name">
                                            {t(badge.name_key, badge.key)}
                                        </span>
                                        <span
                                            className="badge-card-tier"
                                            data-testid={`badge-card-tier-${badge.key}`}
                                        >
                                            {badge.earned
                                                ? tierLabel(badge.tier)
                                                : t(
                                                      "gamification.tier.locked",
                                                      "Locked",
                                                  )}
                                        </span>
                                        {/* Tier-progress pips for dynamic badges. */}
                                        {dynamic && (
                                            <span
                                                className="badge-card-pips"
                                                aria-hidden="true"
                                            >
                                                {(["bronze", "silver", "gold"] as const).map(
                                                    (tr) => (
                                                        <span
                                                            key={tr}
                                                            className={`badge-pip${
                                                                badge.earned &&
                                                                TIER_RANK[badge.tier] >=
                                                                    TIER_RANK[tr]
                                                                    ? " is-filled"
                                                                    : ""
                                                            }`}
                                                            style={{
                                                                background:
                                                                    badge.earned &&
                                                                    TIER_RANK[
                                                                        badge.tier
                                                                    ] >= TIER_RANK[tr]
                                                                        ? TIER_PALETTE[tr]
                                                                              .primary
                                                                        : "var(--border-strong)",
                                                            }}
                                                        />
                                                    ),
                                                )}
                                            </span>
                                        )}
                                    </button>

                                    {badge.earned && badge.earned_at && (
                                        <p className="badge-card-date">
                                            {new Date(
                                                badge.earned_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    )}
                                    {!badge.earned && (
                                        <p
                                            className="badge-card-locked-hint"
                                            data-testid={`badge-card-locked-${badge.key}`}
                                        >
                                            {dynamic && badge.tier_thresholds
                                                ? t(
                                                      "gamification.gallery.next_tier",
                                                      "{current} / {target} to {tier}",
                                                  )
                                                      .replace("{current}", "0")
                                                      .replace(
                                                          "{target}",
                                                          String(
                                                              badge
                                                                  .tier_thresholds
                                                                  .bronze
                                                                  .threshold,
                                                          ),
                                                      )
                                                      .replace(
                                                          "{tier}",
                                                          tierLabel("bronze"),
                                                      )
                                                : t(
                                                      "gamification.gallery.locked_hint",
                                                      "Keep learning to unlock this badge.",
                                                  )}
                                        </p>
                                    )}
                                    {badge.earned && next && badge.tier_thresholds && (
                                        <p className="badge-card-next">
                                            {t(
                                                "gamification.gallery.next_tier",
                                                "{current} / {target} to {tier}",
                                            )
                                                .replace(
                                                    "{current}",
                                                    String(
                                                        badge.tier_thresholds[
                                                            badge.tier
                                                        ]?.threshold ?? 0,
                                                    ),
                                                )
                                                .replace(
                                                    "{target}",
                                                    String(
                                                        badge.tier_thresholds[next]
                                                            .threshold,
                                                    ),
                                                )
                                                .replace(
                                                    "{tier}",
                                                    tierLabel(next),
                                                )}
                                        </p>
                                    )}

                                    {isOpen && (
                                        <div
                                            className="badge-card-detail"
                                            data-testid={`badge-card-detail-${badge.key}`}
                                        >
                                            <p>
                                                {t(
                                                    badge.description_key,
                                                    "",
                                                )}
                                            </p>
                                            {dynamic && badge.tier_thresholds && (
                                                <table className="badge-tier-table">
                                                    <caption>
                                                        {t(
                                                            "gamification.gallery.tiers_heading",
                                                            "Tiers",
                                                        )}
                                                    </caption>
                                                    <tbody>
                                                        {(
                                                            [
                                                                "bronze",
                                                                "silver",
                                                                "gold",
                                                            ] as const
                                                        ).map((tr) => (
                                                            <tr key={tr}>
                                                                <th scope="row">
                                                                    {tierLabel(tr)}
                                                                </th>
                                                                <td>
                                                                    {
                                                                        badge
                                                                            .tier_thresholds![
                                                                            tr
                                                                        ].threshold
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
