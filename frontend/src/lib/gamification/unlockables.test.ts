/**
 * Tests for the shared unlockable-condition evaluation (#2861) -
 * extracted from the avatar-frame logic (#2850) when the mascot
 * variants became its second consumer.
 */

import {describe, expect, it} from "vitest";

import {isUnlocked, type UnlockCondition} from "./unlockables";

const CTX = {
    level: 5,
    earnedBadgeKeys: new Set(["streak_3_days"]),
    purchased: new Set(["star"]),
};

describe("isUnlocked", () => {
    it.each<[string, UnlockCondition, string, boolean]>([
        ["default is always unlocked", {kind: "default"}, "none", true],
        ["level met", {kind: "level", level: 5}, "silver", true],
        ["level not met", {kind: "level", level: 6}, "gold", false],
        [
            "earned badge",
            {kind: "badge", badgeKey: "streak_3_days"},
            "flame",
            true,
        ],
        [
            "missing badge",
            {kind: "badge", badgeKey: "first_import"},
            "flame",
            false,
        ],
        ["purchased xp item", {kind: "xp", cost: 150}, "star", true],
        ["unpurchased xp item", {kind: "xp", cost: 300}, "accent", false],
    ])("%s", (_name, unlock, id, expected) => {
        expect(isUnlocked(id, unlock, CTX)).toBe(expected);
    });
});
