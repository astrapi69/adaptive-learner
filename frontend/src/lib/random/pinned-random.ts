/**
 * Per-consumer random seam for deterministic visual runs (#3214).
 *
 * The visual harness installs a {@link RandomPin} on ``globalThis`` under
 * {@link RANDOM_PIN_GLOBAL} before any page script runs. With a pin, every
 * consumer that asks for randomness here gets its OWN seeded generator, so a
 * draw anywhere else on the page (confetti, sound, another consumer) cannot
 * shift its sequence, and the per-mount exercise seed stops reading the clock.
 *
 * Nothing in the app writes the pin. Without it the seam is inert: no
 * storage, no URL parameter, no UI, and exactly the production randomness
 * the callers had before. The pin is read at call time, never at import, and
 * only an own, readable, well-formed property counts: an inherited or
 * throwing one reads as no pin (fail open).
 */

import {fnv1a32, mulberry32} from "./prng";

/** Name of the ``globalThis`` property the visual harness installs. */
export const RANDOM_PIN_GLOBAL = "__adaptiveLearnerRandomPin";

/**
 * The values a visual run pins.
 *
 * @example
 * const pin: RandomPin = {streamSeed: 0x1567, mountSalt: 13056};
 */
export interface RandomPin {
    /** Base seed every named stream is derived from (unsigned 32-bit). */
    readonly streamSeed: number;
    /** Replaces the clock suffix of per-mount exercise seeds (16-bit). */
    readonly mountSalt: number;
}

/** The named streams; a literal union so a typo cannot merge two streams. */
export type RandomStreamName = "shuffle-order" | "endless-repeat";

function isIntegerInRange(value: unknown, max: number): boolean {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= max
    );
}

/**
 * ``target[key]`` when ``key`` is an OWN property whose read succeeds, else
 * ``undefined``. Inherited values (a polluted ``Object.prototype``, the named
 * properties a ``<iframe name>`` puts on the window's prototype chain) never
 * count, and a read that throws (a cross-origin ``WindowProxy``, a hostile
 * getter) reads as absent instead of escaping into a render.
 */
function readOwn(target: object, key: string): unknown {
    try {
        return Object.hasOwn(target, key)
            ? (target as Record<string, unknown>)[key]
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Whether ``value`` is a well-formed {@link RandomPin}. The app treats a
 * malformed value as absent (fail open to production behaviour); the visual
 * harness uses the same check to refuse installing a pin the app would ignore.
 * Only OWN fields count, and a field whose read throws makes the value
 * malformed rather than throwing.
 *
 * @param value - Anything, typically ``globalThis[RANDOM_PIN_GLOBAL]``.
 * @returns ``true`` for a non-null object with an own integer ``streamSeed``
 *     in ``0..0xffffffff`` and an own integer ``mountSalt`` in ``0..0xffff``.
 *
 * @example
 * isRandomPin({streamSeed: 0x1567, mountSalt: 13056}); // true
 * isRandomPin({streamSeed: 1.5, mountSalt: 0}); // false
 * isRandomPin(Object.create({streamSeed: 1, mountSalt: 1})); // false
 */
export function isRandomPin(value: unknown): value is RandomPin {
    if (typeof value !== "object" || value === null) return false;
    return (
        isIntegerInRange(readOwn(value, "streamSeed"), 0xffffffff) &&
        isIntegerInRange(readOwn(value, "mountSalt"), 0xffff)
    );
}

/**
 * A plain snapshot of the installed pin, or ``null``. Fails open: an
 * inherited, unreadable or malformed global is no pin, so production
 * randomness applies. Each field is read exactly once, so a getter cannot
 * validate one value and hand the caller another.
 */
function readRandomPin(): RandomPin | null {
    const value = readOwn(globalThis, RANDOM_PIN_GLOBAL);
    if (typeof value !== "object" || value === null) return null;
    const snapshot = {
        streamSeed: readOwn(value, "streamSeed"),
        mountSalt: readOwn(value, "mountSalt"),
    };
    return isRandomPin(snapshot) ? snapshot : null;
}

/**
 * A generator for one named consumer stream, or ``undefined`` without a pin.
 *
 * ``undefined`` is deliberate: callers pass it straight into their existing
 * ``rng`` seams (``buildShuffleLesson(..., {rng})``, ``endlessStepAt(...,
 * rng)``), so those seams' own ``Math.random`` default stays the single
 * definition of production randomness. Under a pin every call returns a FRESH
 * mulberry32 closure seeded from ``fnv1a32(`${streamSeed}:${stream}`)``; only
 * the caller that holds it can advance it.
 *
 * @param stream - Which consumer is drawing.
 * @returns A ``[0, 1)`` generator under a pin, else ``undefined``.
 *
 * @example
 * const lesson = buildShuffleLesson(sources, {
 *     title,
 *     rng: pinnedRandom("shuffle-order"),
 * });
 */
export function pinnedRandom(
    stream: RandomStreamName,
): (() => number) | undefined {
    const pin = readRandomPin();
    if (pin === null) return undefined;
    return mulberry32(fnv1a32(`${pin.streamSeed}:${stream}`));
}

/**
 * The per-mount seed for an exercise's display shuffle: ``${key}#${salt}``.
 *
 * In production the salt is the low 16 bits of ``Date.now()``, unchanged
 * from before #3214; they repeat about every 65.5 s. The salt only
 * decorrelates one mount of an exercise from the next. It is not an identity
 * and not an entropy source; build nothing on it. Under a pin the salt is the
 * pinned ``mountSalt`` and the clock is never read.
 *
 * @param key - The exercise id.
 * @returns The seed string to hand to ``seededShuffle``.
 *
 * @example
 * const [shuffleSeed] = useState(() => mountShuffleSeed(exercise.id));
 */
export function mountShuffleSeed(key: string): string {
    const pin = readRandomPin();
    const salt = pin === null ? Date.now() & 0xffff : pin.mountSalt;
    return `${key}#${salt}`;
}
