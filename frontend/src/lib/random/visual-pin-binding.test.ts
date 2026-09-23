/**
 * The visual random pin stays bound to the frozen visual clock (#3214).
 *
 * The matching and word-tiles baselines were captured with the mount-seed
 * suffix ``Date.now() & 0xffff`` evaluated under ``FIXED_NOW_ISO``, which is
 * 13056. Since #3214 the page no longer reads the clock for that seed: the
 * harness hands in ``VISUAL_RANDOM_PIN.mountSalt`` instead. These tests import
 * the REAL harness values, so a moved ``FIXED_NOW_ISO`` or a salt that stops
 * deriving from it fails here instead of silently moving every matching and
 * tile baseline.
 */

import {describe, expect, it} from "vitest";

import {
    FIXED_NOW_ISO,
    VISUAL_MOUNT_SALT,
    VISUAL_RANDOM_PIN,
} from "../../../../e2e/visual/visual-pins";
import {isRandomPin} from "./pinned-random";

/** The suffix every existing matching and tile baseline was captured with. */
const BASELINE_MOUNT_SUFFIX = 13056;

describe("visual random pin binding (#3214)", () => {
    it("FIXED_NOW_ISO still yields the mount suffix the baselines were captured with", () => {
        expect(
            new Date(FIXED_NOW_ISO).getTime() & 0xffff,
            "FIXED_NOW_ISO moved: its low 16 bits are no longer 13056, the mount " +
                "suffix every matching and word-tiles baseline was captured with. " +
                "The salt derives from FIXED_NOW_ISO, so those baselines move with " +
                "it; re-capture them deliberately (#3215) and update this pin.",
        ).toBe(BASELINE_MOUNT_SUFFIX);
    });

    it("the pinned mount salt derives from FIXED_NOW_ISO", () => {
        expect(
            VISUAL_RANDOM_PIN.mountSalt,
            "mountSalt must be new Date(FIXED_NOW_ISO).getTime() & 0xffff; a salt " +
                "that stands next to the clock instead of deriving from it lets the " +
                "two drift apart without any test noticing.",
        ).toBe(new Date(FIXED_NOW_ISO).getTime() & 0xffff);
        expect(VISUAL_RANDOM_PIN.mountSalt).toBe(VISUAL_MOUNT_SALT);
    });

    it("the visual pin is well formed, so the app does not ignore it", () => {
        expect(isRandomPin(VISUAL_RANDOM_PIN)).toBe(true);
    });
});
