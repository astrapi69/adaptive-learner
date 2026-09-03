/**
 * Mode-agnostic arcade unlock persistence (#2887) - the XP-purchased
 * arcade games per user, one ``selection-store`` instance per the
 * shared cosmetics pattern (#2850/#2861). Only the ``purchased`` list
 * is meaningful here (there is no "selected game"); the key is
 * registered in ``MANAGED_USER_DATA_KEYS`` and rides the ``.alb``
 * backup's localStorage snapshot.
 */

import {createSelectionStore} from "../gamification/selection-store";

const store = createSelectionStore("adaptive-learner.arcade.unlocks", "memory");

/** ``window`` event fired after every write - the live-update hook. */
export const ARCADE_UNLOCK_CHANGE_EVENT = store.changeEvent;

/** The stored unlock state for ``userId`` (default: nothing bought). */
export const readArcadeUnlockState = store.read;

/** Record an XP purchase for ``userId`` (idempotent). */
export const addPurchasedArcadeGame = store.addPurchased;
