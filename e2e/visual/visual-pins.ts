/**
 * The values every visual run pins, in one Playwright-free module (#3214).
 *
 * ``helpers.ts`` installs them in the page; this module holds them, and the
 * init-script sources that install them, so the frontend Vitest suite can
 * import the real values and scripts and pin how they behave
 * (``frontend/src/lib/random/visual-pin-binding.test.ts``). No Playwright
 * import, no side effects on import.
 */

import {
    RANDOM_PIN_GLOBAL,
    isRandomPin,
    type RandomPin,
} from "../../frontend/src/lib/random/pinned-random";
import {mulberry32} from "../../frontend/src/lib/random/prng";

/** Frozen wall-clock for every visual run (follows #244). Relative times
 *  ("vor 3 Minuten", streak dates, "Morgen neue Missionen") would otherwise
 *  drift day-to-day and make the screenshots flaky. */
export const FIXED_NOW_ISO = "2026-06-10T14:00:00Z";

/**
 * The mount-seed salt of the visual runs: the low 16 bits of the frozen
 * clock, 13056 for ``FIXED_NOW_ISO``.
 *
 * Before #3214 the matching and word-tiles mount seeds read
 * ``Date.now() & 0xffff`` in the page, which the frozen clock turned into
 * exactly this value; every matching and tile baseline was captured with it.
 * Deriving the salt from ``FIXED_NOW_ISO`` instead of writing it next to it
 * keeps the two bound: the page no longer reads the clock for the seed, but
 * the salt still names the instant the baselines were taken at. Moving
 * ``FIXED_NOW_ISO`` (#3215) therefore moves every matching and tile baseline,
 * and ``visual-pin-binding.test.ts`` fails first so that move is a decision,
 * not a surprise.
 *
 * @example
 * VISUAL_MOUNT_SALT === (Date.parse("2026-06-10T14:00:00Z") & 0xffff); // true
 */
export const VISUAL_MOUNT_SALT = new Date(FIXED_NOW_ISO).getTime() & 0xffff;

/**
 * The pin ``pinRandomStreams`` installs.
 *
 * ``streamSeed`` 0x1567 continues the ``pinRandomness`` seed and has no other
 * meaning; ``mountSalt`` is {@link VISUAL_MOUNT_SALT}.
 *
 * @example
 * await page.addInitScript(install, {name: RANDOM_PIN_GLOBAL, pin: VISUAL_RANDOM_PIN});
 */
export const VISUAL_RANDOM_PIN: RandomPin = {
    streamSeed: 0x1567,
    mountSalt: VISUAL_MOUNT_SALT,
};

/**
 * Runs IN THE PAGE, serialised by {@link randomPinInitScript}: defines the
 * pin as a frozen, own, non-writable, non-configurable, non-enumerable
 * property, so no page script can replace, delete or edit it mid-capture.
 * A second run in the same document keeps the first pin instead of throwing
 * on the non-configurable property.
 */
function defineRandomPin(target: object, name: string, pin: RandomPin): void {
    if (Object.hasOwn(target, name)) return;
    Object.defineProperty(target, name, {
        value: Object.freeze({streamSeed: pin.streamSeed, mountSalt: pin.mountSalt}),
        writable: false,
        configurable: false,
        enumerable: false,
    });
}

/**
 * The init-script source ``pinRandomStreams`` hands to
 * ``page.addInitScript``: {@link defineRandomPin} applied to ``globalThis``
 * with ``RANDOM_PIN_GLOBAL`` and {@link VISUAL_RANDOM_PIN}.
 *
 * @returns JavaScript source that installs the visual pin when evaluated.
 *
 * @example
 * await page.addInitScript({content: randomPinInitScript()});
 */
export function randomPinInitScript(): string {
    const name = JSON.stringify(RANDOM_PIN_GLOBAL);
    const pin = JSON.stringify(VISUAL_RANDOM_PIN);
    return `(${defineRandomPin.toString()})(globalThis, ${name}, ${pin});`;
}

/**
 * Why a value read from a page is not the installed visual pin, or ``null``
 * when it is. The harness asserts this after every visual navigation so a
 * spec that forgot ``pinRandomStreams`` fails instead of capturing
 * browser-random orders (#3214).
 *
 * @param installed - The page's own ``RANDOM_PIN_GLOBAL`` property value.
 * @returns A reason to put in the error, or ``null`` for the visual pin.
 *
 * @example
 * randomPinProblem(undefined); // "no pin is installed"
 * randomPinProblem({...VISUAL_RANDOM_PIN}); // null
 */
export function randomPinProblem(installed: unknown): string | null {
    if (installed === undefined) return "no pin is installed";
    if (!isRandomPin(installed)) {
        return `the installed pin ${JSON.stringify(installed)} is malformed`;
    }
    if (
        installed.streamSeed !== VISUAL_RANDOM_PIN.streamSeed ||
        installed.mountSalt !== VISUAL_RANDOM_PIN.mountSalt
    ) {
        return `the installed pin ${JSON.stringify(installed)} is not VISUAL_RANDOM_PIN`;
    }
    return null;
}

/** Seed of the one shared ``Math.random`` stream ``pinRandomness`` installs. */
export const LEGACY_RANDOM_SEED = 0x1567;

/**
 * Runs IN THE PAGE, serialised by {@link legacyRandomInitScript}: a counter
 * ``crypto.randomUUID`` and one shared ``Math.random`` stream. It may use
 * nothing but its parameters and page globals, because only its source text
 * reaches the page.
 */
function installLegacyRandomness(
    createGenerator: (seed: number) => () => number,
    seed: number,
): void {
    let uuidCounter = 0;
    crypto.randomUUID = () => {
        uuidCounter += 1;
        const tail = String(uuidCounter).padStart(12, "0");
        return `00000000-0000-4000-8000-${tail}`;
    };
    Math.random = createGenerator(seed);
}

/**
 * The init-script source ``pinRandomness`` hands to ``page.addInitScript``:
 * {@link installLegacyRandomness} called with the app's own ``mulberry32``
 * (``frontend/src/lib/random/prng.ts``) as source text and
 * {@link LEGACY_RANDOM_SEED}. One implementation, no serialised copy: the
 * app sets no CSP, and an init script is plain page script anyway.
 *
 * The stream is bit-identical to the copy the harness carried before
 * (``visual-pin-binding.test.ts`` compares the first 1000 draws), so the
 * three motifs that still use it keep their baselines.
 *
 * @returns JavaScript source that installs the legacy pins when evaluated.
 *
 * @example
 * await page.addInitScript({content: legacyRandomInitScript()});
 */
export function legacyRandomInitScript(): string {
    return `(${installLegacyRandomness.toString()})(${mulberry32.toString()}, ${LEGACY_RANDOM_SEED});`;
}
