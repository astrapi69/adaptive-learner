/**
 * The visual random pin for Vitest (#3214): installs the REAL harness pin
 * (``e2e/visual/visual-pins.ts``) on ``globalThis`` the way ``pinRandomStreams``
 * does in the page, and names the instants the clock tests run at.
 *
 * @example
 * installVisualRandomPin();
 * // ...render under the visual seed...
 * clearRandomPin(); // in afterEach
 */

import {
    FIXED_NOW_ISO,
    VISUAL_RANDOM_PIN,
} from "../../../e2e/visual/visual-pins";
import {RANDOM_PIN_GLOBAL} from "../lib/random";

export {VISUAL_RANDOM_PIN};

/** ``Date.now()`` under the frozen visual clock. */
export const FROZEN_VISUAL_NOW = Date.parse(FIXED_NOW_ISO);

/**
 * Two instants other than the frozen visual clock, for independence part 2.
 * Their low 16 bits differ from the visual mount salt AND from each other, so
 * a test at either instant can only pass if the order ignores the clock.
 */
export const OTHER_INSTANTS = [
    {name: "4 s after the frozen clock", now: FROZEN_VISUAL_NOW + 4099},
    {name: "one day after the frozen clock", now: FROZEN_VISUAL_NOW + 86_400_000},
] as const;

/** Install the visual pin, as the harness init script does. */
export function installVisualRandomPin(): void {
    (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL] = VISUAL_RANDOM_PIN;
}

/** Remove any pin, restoring production behaviour. */
export function clearRandomPin(): void {
    delete (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL];
}
