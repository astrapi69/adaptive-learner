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
 *
 * The same holds for the legacy shared ``Math.random`` stream: the init
 * script ``pinRandomness`` installs is evaluated here and must reproduce the
 * stream the three legacy motifs were captured with.
 */

import {describe, expect, it} from "vitest";

import {
    FIXED_NOW_ISO,
    LEGACY_RANDOM_SEED,
    VISUAL_MOUNT_SALT,
    VISUAL_RANDOM_PIN,
    legacyRandomInitScript,
} from "../../../../e2e/visual/visual-pins";
import {isRandomPin} from "./pinned-random";
import {mulberry32} from "./prng";

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

/**
 * The legacy ``Math.random`` stream before #3214, copied verbatim from the
 * serialised generator ``pinRandomness`` carried in ``e2e/visual/helpers.ts``.
 * Three motifs still draw from it (lesson-reading-comprehension-checked,
 * lesson-graded-quiz-checked, content-my-lessons), so the shared-source
 * init script must reproduce it bit for bit.
 */
function legacyHarnessRandom(): () => number {
    let mulberryState = 0x1567 >>> 0;
    return () => {
        mulberryState = (mulberryState + 0x6d2b79f5) >>> 0;
        let mixed = mulberryState;
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}

interface PageGlobals {
    math: Math;
    crypto: {randomUUID?: () => string};
}

/**
 * Run the init script source exactly as the page receives it, with ``Math``
 * and ``crypto`` shadowed by stand-ins so the test process keeps its own.
 * ``new Function`` is the point here: the harness ships a string, and only
 * evaluating that string proves what the page will run.
 */
function runInitScript(): PageGlobals {
    const math = Object.create(Math) as Math;
    const crypto: PageGlobals["crypto"] = {};
    new Function("Math", "crypto", legacyRandomInitScript())(math, crypto);
    return {math, crypto};
}

describe("legacy Math.random pin from the shared mulberry32 (#3214)", () => {
    const DRAWS = 1000;

    it("the seed is the one the three legacy motifs were captured with", () => {
        expect(LEGACY_RANDOM_SEED).toBe(0x1567);
    });

    it(`reproduces the pre-#3214 harness stream for the first ${DRAWS} draws`, () => {
        const {math} = runInitScript();
        const legacy = legacyHarnessRandom();
        const shared = mulberry32(LEGACY_RANDOM_SEED);
        let equal = 0;
        for (let i = 0; i < DRAWS; i++) {
            const drawn = math.random();
            if (drawn === legacy() && drawn === shared()) equal += 1;
        }
        expect(equal).toBe(DRAWS);
    });

    it("keeps the counter randomUUID sequence", () => {
        const {crypto} = runInitScript();
        expect([crypto.randomUUID!(), crypto.randomUUID!(), crypto.randomUUID!()]).toEqual([
            "00000000-0000-4000-8000-000000000001",
            "00000000-0000-4000-8000-000000000002",
            "00000000-0000-4000-8000-000000000003",
        ]);
    });

    it("carries the generator as the shared prng.ts source, not a copy", () => {
        expect(legacyRandomInitScript()).toContain(mulberry32.toString());
    });
});
