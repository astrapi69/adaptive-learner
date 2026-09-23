/**
 * The values every visual run pins, in one Playwright-free module (#3214).
 *
 * ``helpers.ts`` installs them in the page; this module holds them so the
 * frontend Vitest suite can import the real values and pin how they relate
 * (``frontend/src/lib/random/visual-pin-binding.test.ts``). No Playwright
 * import, no side effects on import.
 */

import type {RandomPin} from "../../frontend/src/lib/random/pinned-random";

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
