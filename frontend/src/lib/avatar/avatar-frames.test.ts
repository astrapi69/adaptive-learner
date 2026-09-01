/**
 * Tests for the avatar-frame catalog (#2850): registry shape, the
 * token-only ring values, id fallback, and the unlock evaluation
 * across all four condition kinds.
 */

import {describe, expect, it} from "vitest";

import {
    AVATAR_FRAMES,
    avatarFrameById,
    isFrameUnlocked,
    type FrameUnlockContext,
} from "./avatar-frames";

const ctx = (over: Partial<FrameUnlockContext> = {}): FrameUnlockContext => ({
    level: 1,
    earnedBadgeKeys: new Set<string>(),
    purchased: new Set<string>(),
    ...over,
});

describe("AVATAR_FRAMES registry", () => {
    it("offers 7 frames with unique ids, none first", () => {
        expect(AVATAR_FRAMES.length).toBe(7);
        expect(AVATAR_FRAMES[0].id).toBe("none");
        const ids = AVATAR_FRAMES.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("every ring value is token-only (no raw hex/rgb literals)", () => {
        for (const f of AVATAR_FRAMES) {
            if (f.ring === null) continue;
            expect(f.ring).toContain("var(--");
            expect(f.ring).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
        }
    });

    it("covers all four unlock kinds", () => {
        const kinds = new Set(AVATAR_FRAMES.map((f) => f.unlock.kind));
        expect(kinds).toEqual(new Set(["default", "level", "badge", "xp"]));
    });

    it("avatarFrameById falls back to the none frame", () => {
        expect(avatarFrameById("gold").id).toBe("gold");
        expect(avatarFrameById("bogus").id).toBe("none");
        expect(avatarFrameById(null).id).toBe("none");
        expect(avatarFrameById(undefined).id).toBe("none");
    });
});

describe("isFrameUnlocked", () => {
    it("the default frame is always unlocked", () => {
        expect(isFrameUnlocked(avatarFrameById("none"), ctx())).toBe(true);
    });

    it.each([
        ["below the required level", 1, false],
        ["at the required level", 2, true],
        ["above the required level", 7, true],
    ])("level frame %s", (_name, level, expected) => {
        expect(
            isFrameUnlocked(avatarFrameById("bronze"), ctx({level})),
        ).toBe(expected);
    });

    it("badge frame unlocks only with the earned badge key", () => {
        const flame = avatarFrameById("flame");
        expect(isFrameUnlocked(flame, ctx())).toBe(false);
        expect(
            isFrameUnlocked(
                flame,
                ctx({earnedBadgeKeys: new Set(["streak_3_days"])}),
            ),
        ).toBe(true);
    });

    it("xp frame unlocks only when purchased (level/badges irrelevant)", () => {
        const star = avatarFrameById("star");
        expect(
            isFrameUnlocked(
                star,
                ctx({level: 99, earnedBadgeKeys: new Set(["streak_3_days"])}),
            ),
        ).toBe(false);
        expect(
            isFrameUnlocked(star, ctx({purchased: new Set(["star"])})),
        ).toBe(true);
    });
});
