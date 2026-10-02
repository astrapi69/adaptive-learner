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
    randomPinInitScript,
    randomPinProblem,
} from "../../test-utils/visual-pins";
import {RANDOM_PIN_GLOBAL, isRandomPin} from "./pinned-random";
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

/**
 * Evaluate the pin init script exactly as the page receives it, against a
 * stand-in for ``globalThis``: the property is non-configurable, so
 * installing it on the test process's real global could never be undone.
 */
function installPinOn(target: object): void {
    new Function("globalThis", randomPinInitScript())(target);
}

describe("the pin init script installs a pin page code cannot change (#3214)", () => {
    it("defines the visual pin as a frozen, own, read-only, hidden property", () => {
        const target = {};
        installPinOn(target);
        const descriptor = Object.getOwnPropertyDescriptor(target, RANDOM_PIN_GLOBAL);
        expect(descriptor).toMatchObject({
            writable: false,
            configurable: false,
            enumerable: false,
        });
        expect(descriptor!.value).toEqual(VISUAL_RANDOM_PIN);
        expect(Object.isFrozen(descriptor!.value)).toBe(true);
        expect(randomPinProblem(descriptor!.value)).toBeNull();
    });

    it("refuses reassignment, deletion and mutation from page code", () => {
        const target: Record<string, unknown> = {};
        installPinOn(target);
        const installed = target[RANDOM_PIN_GLOBAL] as Record<string, unknown>;
        expect(Reflect.set(target, RANDOM_PIN_GLOBAL, {streamSeed: 1, mountSalt: 1})).toBe(false);
        expect(Reflect.deleteProperty(target, RANDOM_PIN_GLOBAL)).toBe(false);
        expect(Reflect.set(installed, "mountSalt", 1)).toBe(false);
        expect(target[RANDOM_PIN_GLOBAL]).toEqual(VISUAL_RANDOM_PIN);
    });

    it("running twice in one document keeps the first pin and does not throw", () => {
        const target = {};
        installPinOn(target);
        expect(() => installPinOn(target)).not.toThrow();
        expect(Object.getOwnPropertyDescriptor(target, RANDOM_PIN_GLOBAL)!.value).toEqual(
            VISUAL_RANDOM_PIN,
        );
    });
});

describe("randomPinProblem names what a visual page is missing (#3214)", () => {
    it.each([
        {name: "no pin at all", value: undefined, reason: /no pin/},
        {name: "a malformed pin", value: {streamSeed: 1.5, mountSalt: 1}, reason: /malformed/},
        {
            name: "a valid pin that is not the visual one",
            value: {streamSeed: 1, mountSalt: VISUAL_MOUNT_SALT},
            reason: /not VISUAL_RANDOM_PIN/,
        },
    ])("reports $name", ({value, reason}) => {
        expect(randomPinProblem(value)).toMatch(reason);
    });

    it("accepts the visual pin", () => {
        expect(randomPinProblem({...VISUAL_RANDOM_PIN})).toBeNull();
    });
});
