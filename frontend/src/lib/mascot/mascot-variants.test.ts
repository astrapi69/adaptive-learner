/**
 * Tests for the mascot-variant catalog (#2861): shape invariants,
 * the funke fallback, token-only colors, and unlock evaluation
 * through the shared unlockables logic.
 */

import {describe, expect, it} from "vitest";

import {
    MASCOT_VARIANTS,
    isVariantUnlocked,
    mascotVariantById,
} from "./mascot-variants";

describe("MASCOT_VARIANTS", () => {
    it("has unique ids and the free funke default first", () => {
        const ids = MASCOT_VARIANTS.map((v) => v.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(MASCOT_VARIANTS[0]).toMatchObject({
            id: "funke",
            unlock: {kind: "default"},
        });
    });

    it("uses only design-token colors", () => {
        for (const v of MASCOT_VARIANTS) {
            expect(v.body).toMatch(/^var\(--[a-z0-9-]+\)$/);
            expect(v.spark).toMatch(/^var\(--[a-z0-9-]+\)$/);
        }
    });

    it("offers at least one XP-purchasable variant", () => {
        expect(
            MASCOT_VARIANTS.some((v) => v.unlock.kind === "xp"),
        ).toBe(true);
    });
});

describe("mascotVariantById", () => {
    it("resolves a known id and falls back to funke", () => {
        expect(mascotVariantById("wald").id).toBe("wald");
        expect(mascotVariantById("no-such").id).toBe("funke");
        expect(mascotVariantById(null).id).toBe("funke");
    });
});

describe("isVariantUnlocked", () => {
    const base = {
        level: 1,
        earnedBadgeKeys: new Set<string>(),
        purchased: new Set<string>(),
    };

    it("unlocks by level, badge and purchase", () => {
        const ozean = mascotVariantById("ozean");
        expect(isVariantUnlocked(ozean, base)).toBe(false);
        expect(isVariantUnlocked(ozean, {...base, level: 3})).toBe(true);

        const geist = mascotVariantById("geist");
        expect(isVariantUnlocked(geist, base)).toBe(false);
        expect(
            isVariantUnlocked(geist, {
                ...base,
                earnedBadgeKeys: new Set(["first_session"]),
            }),
        ).toBe(true);

        const gold = mascotVariantById("gold");
        expect(isVariantUnlocked(gold, base)).toBe(false);
        expect(
            isVariantUnlocked(gold, {...base, purchased: new Set(["gold"])}),
        ).toBe(true);
    });
});
