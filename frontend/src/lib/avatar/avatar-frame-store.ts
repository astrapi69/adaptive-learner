/**
 * Mode-agnostic avatar-frame persistence (#2850) - the selected
 * frame and the set of XP-purchased frames, one ``selection-store``
 * instance since the machinery was extracted for the mascot
 * variants (#2861). Storage key and on-disk format are unchanged
 * from the original implementation, so existing user state keeps
 * resolving. The key is registered in ``MANAGED_USER_DATA_KEYS``
 * and rides the ``.alb`` backup's localStorage snapshot.
 */

import {xpCostOf} from "../gamification/purchase-ledger";
import type {PurchaseSurface} from "../gamification/purchase-ledger";
import {createSelectionStore} from "../gamification/selection-store";
import type {SelectionState} from "../gamification/selection-store";
import {AVATAR_FRAMES} from "./avatar-frames";

const store = createSelectionStore("adaptive-learner.avatar.frames", "none");

export type AvatarFrameState = SelectionState;

/** ``window`` event fired after every write - the live-update hook. */
export const AVATAR_FRAME_CHANGE_EVENT = store.changeEvent;

/** The stored frame state for ``userId`` (default: none, nothing bought). */
export const readAvatarFrameState = store.read;

/** Persist the selected frame for ``userId``. */
export const setSelectedAvatarFrame = store.setSelected;

/** Record an XP purchase for ``userId`` (idempotent). */
export const addPurchasedAvatarFrame = store.addPurchased;

/** The frame purchases in the XP ledger (#3445), for ``reconcilePurchases``. */
export const AVATAR_FRAME_PURCHASES: PurchaseSurface = {
    kind: "avatar_frame",
    store,
    costOf: xpCostOf(AVATAR_FRAMES),
};
