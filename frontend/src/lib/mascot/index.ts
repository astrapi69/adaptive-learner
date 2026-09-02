/**
 * Barrel for the mascot progression modules (#2861): the variant
 * catalog and its mode-agnostic selection store.
 */

export {
    MASCOT_VARIANTS,
    isVariantUnlocked,
    mascotVariantById,
} from "./mascot-variants";
export type {MascotVariant} from "./mascot-variants";
export {
    MASCOT_VARIANT_CHANGE_EVENT,
    addPurchasedMascotVariant,
    readMascotVariantState,
    setSelectedMascotVariant,
} from "./mascot-variant-store";
