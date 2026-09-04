/**
 * Mode-agnostic mascot-variant persistence (#2861) - the selected
 * Lernfunke color scheme and the XP-purchased variants, one
 * ``selection-store`` instance per the shared cosmetics pattern
 * (#2850). The key is registered in ``MANAGED_USER_DATA_KEYS`` and
 * rides the ``.alb`` backup's localStorage snapshot.
 */

import {createSelectionStore} from "../gamification/selection-store";

const store = createSelectionStore("adaptive-learner.mascot.variants", "funke");

/** ``window`` event fired after every write - the live-update hook. */
export const MASCOT_VARIANT_CHANGE_EVENT = store.changeEvent;

/** The stored variant state for ``userId`` (default: funke, nothing bought). */
export const readMascotVariantState = store.read;

/** Persist the selected variant for ``userId``. */
export const setSelectedMascotVariant = store.setSelected;

/** Record an XP purchase for ``userId`` (idempotent). */
export const addPurchasedMascotVariant = store.addPurchased;
