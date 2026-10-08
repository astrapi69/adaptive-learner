/**
 * Two-step XP purchase flow for unlockable cosmetics (#2861) -
 * extracted from AvatarFrameControl (#2850) when the mascot
 * variants became its second consumer.
 *
 * Encapsulates the guarded purchase: the first ``buy`` arms the
 * confirm step (the MissionSettingsControl reset pattern), the second
 * records it through ``gamification.purchaseItem`` - the deduction and
 * the ledger row in one transaction (#3445) - then the caller mirrors
 * ownership into its local store in ``onPurchased`` and the hook emits
 * the xp-spent event so the header XP badge refreshes. Affordability is
 * checked here first so an unaffordable click never reaches storage;
 * ``purchaseItem`` rejects a short balance on its own as well.
 *
 * @example
 * const purchase = useXpPurchase({
 *     userId, totalXp, kind: "avatar_frame",
 *     failedText: t("settings.unlock_buy_failed", "Purchase failed."),
 *     onPurchased: (id, next) => { ... persist + refresh ... },
 * });
 * <button onClick={() => void purchase.buy(frame.id, cost)} />
 */

import {useState} from "react";

import {useI18n} from "../ui/useI18n";
import {emitXpSpent} from "../../lib/gamification/xp-spent-event";
import {getStorage} from "../../storage";
import type {
    XPState,
    XpPurchaseKind,
} from "../../storage/types/learning/gamification";
import {notify} from "../../utils/notify";

export interface XpPurchaseArgs {
    userId: string;
    /** The user's current XP balance - the affordability oracle. */
    totalXp: number;
    /** Ledger kind of the items this surface sells. */
    kind: XpPurchaseKind;
    /** Localized error toast for a failed spend. */
    failedText: string;
    /** Persist ownership + refresh caller state after a spend. */
    onPurchased: (id: string, next: XPState) => void;
}

export interface XpPurchase {
    /** Item id currently armed for the confirm step, or ``null``. */
    confirmId: string | null;
    /** Whether a spend is in flight (disable the gallery). */
    busy: boolean;
    /** Arm the confirm step, then execute the purchase of ``id``. */
    buy: (id: string, cost: number) => Promise<void>;
}

export function useXpPurchase({
    userId,
    totalXp,
    kind,
    failedText,
    onPurchased,
}: XpPurchaseArgs): XpPurchase {
    const {t} = useI18n();
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const buy = async (id: string, cost: number): Promise<void> => {
        if (busy) return;
        if (totalXp < cost) return;
        if (confirmId !== id) {
            setConfirmId(id);
            return;
        }
        setConfirmId(null);
        setBusy(true);
        try {
            const result = await getStorage().gamification.purchaseItem(
                userId,
                {item_kind: kind, item_id: id, cost},
            );
            onPurchased(id, result.xp);
            emitXpSpent(cost, kind);
            notify.success(t("settings.saved", "Saved."));
        } catch {
            notify.error(failedText);
        } finally {
            setBusy(false);
        }
    };

    return {confirmId, busy, buy};
}
