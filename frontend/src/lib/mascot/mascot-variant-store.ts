/**
 * Mode-agnostic mascot-variant persistence (#2861) - the selected
 * Lernfunke color scheme and the XP-purchased variants, one
 * ``selection-store`` instance per the shared cosmetics pattern
 * (#2850). The key is registered in ``MANAGED_USER_DATA_KEYS`` and
 * rides the ``.alb`` backup's localStorage snapshot.
 */

import {xpCostOf} from "../gamification/purchase-ledger";
import type {PurchaseSurface} from "../gamification/purchase-ledger";
import {createSelectionStore} from "../gamification/selection-store";
import {MASCOT_VARIANTS} from "./mascot-variants";

const store = createSelectionStore("adaptive-learner.mascot.variants", "funke");

/** ``window`` event fired after every write - the live-update hook. */
export const MASCOT_VARIANT_CHANGE_EVENT = store.changeEvent;

/** The stored variant state for ``userId`` (default: funke, nothing bought). */
export const readMascotVariantState = store.read;

/** Persist the selected variant for ``userId``. */
export const setSelectedMascotVariant = store.setSelected;

/** Record an XP purchase for ``userId`` (idempotent). */
export const addPurchasedMascotVariant = store.addPurchased;

/** The variant purchases in the XP ledger (#3445), for ``reconcilePurchases``. */
export const MASCOT_VARIANT_PURCHASES: PurchaseSurface = {
    kind: "mascot_variant",
    store,
    costOf: xpCostOf(MASCOT_VARIANTS),
};
