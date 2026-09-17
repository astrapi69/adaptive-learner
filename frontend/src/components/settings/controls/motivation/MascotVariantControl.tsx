/**
 * MascotVariantControl (#2861) - the Lernfunke color-scheme picker
 * inside the game-mode settings section: two variants unlock by
 * level, one by the first-session badge, one is purchasable with XP
 * through the shared ``useXpPurchase`` flow (#2850 pattern).
 *
 * Selection and purchases persist in the mode-agnostic
 * ``mascot-variant-store``; every write dispatches the store's
 * change event, so an open lesson's mascot recolors live. Reads its
 * user from ``readLearnerState`` and renders nothing before
 * onboarding or while the unlock data cannot load (decoration
 * only - the locks stay closed).
 *
 * ``disabled`` (#2959) locks every variant + buy button on top of the
 * unlock state - the host passes it while the master game mode switch
 * is off, because the variant only shows in game mode anyway.
 */

import {useEffect, useState} from "react";
import {Lock} from "lucide-react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useXpPurchase} from "../../../../hooks/gamification/useXpPurchase";
import FormHint from "../../../../shared/forms/FormHint";
import LernfunkeFigure from "../../../lesson/mascot/LernfunkeFigure";
import {readLearnerState} from "../../../../lib/learning/learnerState";
import {
    MASCOT_VARIANTS,
    isVariantUnlocked,
    type MascotVariant,
} from "../../../../lib/mascot/mascot-variants";
import {
    addPurchasedMascotVariant,
    readMascotVariantState,
    setSelectedMascotVariant,
} from "../../../../lib/mascot/mascot-variant-store";
import {getStorage} from "../../../../storage";

interface UnlockData {
    level: number;
    totalXp: number;
    earnedBadgeKeys: Set<string>;
}

export interface MascotVariantControlProps {
    /** Lock every variant + buy button (the master game mode switch is off). */
    disabled?: boolean;
}

export default function MascotVariantControl({
    disabled = false,
}: MascotVariantControlProps = {}) {
    const {t} = useI18n();
    const [userId] = useState(() => readLearnerState().userId);
    const [data, setData] = useState<UnlockData | null>(null);
    const [frameState, setFrameState] = useState(() =>
        readMascotVariantState(userId ?? ""),
    );

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        setFrameState(readMascotVariantState(userId));
        async function load() {
            try {
                const [xp, badges] = await Promise.all([
                    getStorage().gamification.getState(userId!),
                    getStorage().gamification.listBadges(userId!),
                ]);
                if (cancelled) return;
                setData({
                    level: xp.level,
                    totalXp: xp.total_xp,
                    earnedBadgeKeys: new Set(
                        badges.filter((b) => b.earned).map((b) => b.key),
                    ),
                });
            } catch {
                // Decoration only - a failed read leaves the locks closed.
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const purchase = useXpPurchase({
        userId: userId ?? "",
        totalXp: data?.totalXp ?? 0,
        reason: "mascot_variant",
        failedText: t("settings.unlock_buy_failed", "Purchase failed."),
        onPurchased: (id, next) => {
            addPurchasedMascotVariant(userId!, id);
            setSelectedMascotVariant(userId!, id);
            setFrameState(readMascotVariantState(userId!));
            setData((prev) =>
                prev
                    ? {...prev, totalXp: next.total_xp, level: next.level}
                    : prev,
            );
        },
    });

    if (!userId || !data) return null;

    const ctx = {
        level: data.level,
        earnedBadgeKeys: data.earnedBadgeKeys,
        purchased: new Set(frameState.purchased),
    };

    const handleSelect = (variant: MascotVariant) => {
        setSelectedMascotVariant(userId, variant.id);
        setFrameState(readMascotVariantState(userId));
    };

    const conditionLabel = (variant: MascotVariant): string | null => {
        switch (variant.unlock.kind) {
            case "level":
                return t(
                    "settings.unlock_level",
                    "From level {level}",
                ).replace("{level}", String(variant.unlock.level));
            case "badge":
                return t(
                    "settings.unlock_badge",
                    "Needs the badge: {badge}",
                ).replace(
                    "{badge}",
                    t(
                        `gamification.badges.${variant.unlock.badgeKey}.name`,
                        variant.unlock.badgeKey,
                    ),
                );
            default:
                return null;
        }
    };

    return (
        <div
            className="flex flex-col gap-2"
            data-testid="settings-mascot-variants"
        >
            <span className="text-[0.95rem] font-medium">
                {t("settings.mascot_variants_title", "Mascot variant")}
            </span>
            <FormHint as="span">
                {t(
                    "settings.mascot_variants_hint",
                    "Choose your learning companion's colors in game mode. Variants unlock with levels and badges, or in exchange for XP.",
                )}
            </FormHint>
            <div className="flex flex-wrap items-start gap-4">
                {MASCOT_VARIANTS.map((variant) => {
                    const unlocked = isVariantUnlocked(variant, ctx);
                    const active = frameState.selected === variant.id;
                    const name = t(
                        `settings.mascot_variant_${variant.id}`,
                        variant.id,
                    );
                    const xpCost =
                        variant.unlock.kind === "xp"
                            ? variant.unlock.cost
                            : null;
                    const affordable =
                        xpCost !== null && data.totalXp >= xpCost;
                    return (
                        <div
                            key={variant.id}
                            className="flex w-20 flex-col items-center gap-1 text-center"
                        >
                            <button
                                type="button"
                                aria-pressed={active}
                                aria-label={name}
                                title={name}
                                disabled={disabled || !unlocked || purchase.busy}
                                onClick={() => handleSelect(variant)}
                                data-testid={`settings-mascot-variant-${variant.id}`}
                                className={`relative m-1 inline-flex size-14 items-center justify-center rounded-full border-2 bg-[var(--bg-elevated)] ${
                                    active
                                        ? "border-[var(--accent)]"
                                        : "border-transparent"
                                } ${unlocked ? "cursor-pointer" : "opacity-60"}`}
                            >
                                <LernfunkeFigure
                                    pose="idle"
                                    size={36}
                                    colors={{
                                        body: variant.body,
                                        spark: variant.spark,
                                    }}
                                />
                                {!unlocked && (
                                    <Lock
                                        size={14}
                                        aria-hidden="true"
                                        className="absolute bottom-0 right-0 text-[var(--fg-muted)]"
                                    />
                                )}
                            </button>
                            <span className="text-xs">{name}</span>
                            {!unlocked && conditionLabel(variant) && (
                                <FormHint as="span">
                                    {conditionLabel(variant)}
                                </FormHint>
                            )}
                            {xpCost !== null && !unlocked && (
                                <button
                                    type="button"
                                    disabled={disabled || !affordable || purchase.busy}
                                    onClick={() =>
                                        void purchase.buy(variant.id, xpCost)
                                    }
                                    data-testid={`settings-mascot-variant-buy-${variant.id}`}
                                    className="cursor-pointer rounded-sm border border-[var(--border-strong)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {purchase.confirmId === variant.id
                                        ? t(
                                              "settings.unlock_buy_confirm",
                                              "Confirm",
                                          )
                                        : t(
                                              "settings.unlock_buy",
                                              "{xp} XP",
                                          ).replace("{xp}", String(xpCost))}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
