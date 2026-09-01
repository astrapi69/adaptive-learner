/**
 * AvatarFrameControl (#2850) - the Stufe-C progression reward: a row
 * of decorative avatar frames in Settings > General > Profile. Three
 * unlock by level, one by the streak badge, two are purchasable with
 * XP through ``gamification.spendXp`` (both storage modes).
 *
 * Affordability is checked HERE before spending - the backend/Dexie
 * spend clamps at 0 and never rejects, so an unguarded call would
 * hand a broke user the frame for free. Purchases are a two-step
 * confirm (the MissionSettingsControl reset pattern). Selection and
 * purchases persist in the mode-agnostic ``avatar-frame-store`` and
 * announce themselves via ``notifyProfileUpdated`` so the header
 * avatar re-renders live; a purchase additionally emits the
 * xp-spent event so the header XP badge refreshes.
 */

import {useEffect, useState} from "react";
import {Lock} from "lucide-react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {
    AVATAR_FRAMES,
    isFrameUnlocked,
    type AvatarFrame,
} from "../../../../lib/avatar/avatar-frames";
import {
    addPurchasedAvatarFrame,
    readAvatarFrameState,
    setSelectedAvatarFrame,
} from "../../../../lib/avatar/avatar-frame-store";
import {emitXpSpent} from "../../../../lib/gamification/xp-spent-event";
import {notifyProfileUpdated} from "../../../../lib/learning/profileSignal";
import {getStorage} from "../../../../storage";
import {notify} from "../../../../utils/notify";

export interface AvatarFrameControlProps {
    userId: string;
}

interface UnlockData {
    level: number;
    totalXp: number;
    earnedBadgeKeys: Set<string>;
}

export default function AvatarFrameControl({userId}: AvatarFrameControlProps) {
    const {t} = useI18n();
    const [data, setData] = useState<UnlockData | null>(null);
    const [frameState, setFrameState] = useState(() =>
        readAvatarFrameState(userId),
    );
    const [confirmBuy, setConfirmBuy] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setFrameState(readAvatarFrameState(userId));
        async function load() {
            try {
                const [xp, badges] = await Promise.all([
                    getStorage().gamification.getState(userId),
                    getStorage().gamification.listBadges(userId),
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

    if (!data) return null;

    const purchased = new Set(frameState.purchased);
    const ctx = {
        level: data.level,
        earnedBadgeKeys: data.earnedBadgeKeys,
        purchased,
    };

    const handleSelect = (frame: AvatarFrame) => {
        setSelectedAvatarFrame(userId, frame.id);
        setFrameState(readAvatarFrameState(userId));
        notifyProfileUpdated();
    };

    const handleBuy = async (frame: AvatarFrame) => {
        if (frame.unlock.kind !== "xp" || busy) return;
        const cost = frame.unlock.cost;
        if (data.totalXp < cost) return;
        if (confirmBuy !== frame.id) {
            setConfirmBuy(frame.id);
            return;
        }
        setConfirmBuy(null);
        setBusy(true);
        try {
            const next = await getStorage().gamification.spendXp(
                userId,
                cost,
                "avatar_frame",
            );
            addPurchasedAvatarFrame(userId, frame.id);
            setSelectedAvatarFrame(userId, frame.id);
            setFrameState(readAvatarFrameState(userId));
            setData({...data, totalXp: next.total_xp, level: next.level});
            emitXpSpent(cost, "avatar_frame");
            notifyProfileUpdated();
            notify.success(t("settings.saved", "Saved."));
        } catch {
            notify.error(
                t("settings.avatar_frame_buy_failed", "Purchase failed."),
            );
        } finally {
            setBusy(false);
        }
    };

    const conditionLabel = (frame: AvatarFrame): string | null => {
        switch (frame.unlock.kind) {
            case "level":
                return t(
                    "settings.avatar_frame_locked_level",
                    "From level {level}",
                ).replace("{level}", String(frame.unlock.level));
            case "badge":
                return t(
                    "settings.avatar_frame_locked_badge",
                    "Needs the 3-day streak badge",
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col gap-2" data-testid="settings-avatar-frames">
            <span className="text-[0.95rem] font-medium">
                {t("settings.avatar_frames_title", "Avatar frame")}
            </span>
            <FormHint as="span">
                {t(
                    "settings.avatar_frames_hint",
                    "Decorate your avatar. Frames unlock with levels and badges, or in exchange for XP.",
                )}
            </FormHint>
            <div className="flex flex-wrap items-start gap-4">
                {AVATAR_FRAMES.map((frame) => {
                    const unlocked = isFrameUnlocked(frame, ctx);
                    const active = frameState.selected === frame.id;
                    const name = t(
                        `settings.avatar_frame_${frame.id}`,
                        frame.id,
                    );
                    const xpCost =
                        frame.unlock.kind === "xp" ? frame.unlock.cost : null;
                    const buyable = xpCost !== null && !unlocked;
                    const affordable =
                        xpCost !== null && data.totalXp >= xpCost;
                    return (
                        <div
                            key={frame.id}
                            className="flex w-20 flex-col items-center gap-1 text-center"
                        >
                            <button
                                type="button"
                                aria-pressed={active}
                                aria-label={name}
                                title={name}
                                disabled={!unlocked || busy}
                                onClick={() => handleSelect(frame)}
                                data-testid={`settings-avatar-frame-${frame.id}`}
                                className={`relative m-1 inline-flex size-12 items-center justify-center rounded-full border-2 bg-[var(--bg-elevated)] ${
                                    active
                                        ? "border-[var(--accent)]"
                                        : "border-transparent"
                                } ${unlocked ? "cursor-pointer" : "opacity-60"}`}
                                style={
                                    frame.ring
                                        ? {boxShadow: frame.ring}
                                        : undefined
                                }
                            >
                                {!unlocked && (
                                    <Lock
                                        size={14}
                                        aria-hidden="true"
                                        className="text-[var(--fg-muted)]"
                                    />
                                )}
                            </button>
                            <span className="text-xs">{name}</span>
                            {!unlocked && conditionLabel(frame) && (
                                <FormHint as="span">
                                    {conditionLabel(frame)}
                                </FormHint>
                            )}
                            {buyable && (
                                <button
                                    type="button"
                                    disabled={!affordable || busy}
                                    onClick={() => void handleBuy(frame)}
                                    data-testid={`settings-avatar-frame-buy-${frame.id}`}
                                    className="cursor-pointer rounded-sm border border-[var(--border-strong)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {confirmBuy === frame.id
                                        ? t(
                                              "settings.avatar_frame_buy_confirm",
                                              "Confirm",
                                          )
                                        : t(
                                              "settings.avatar_frame_buy",
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
