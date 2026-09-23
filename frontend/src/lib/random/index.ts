/**
 * Seeded randomness for the app (#3214): the one PRNG implementation and the
 * per-consumer seam that pins it in visual runs.
 *
 * @example
 * import {fnv1a32, mulberry32} from "../random";
 */

export {fnv1a32, mulberry32} from "./prng";
export {
    RANDOM_PIN_GLOBAL,
    isRandomPin,
    mountShuffleSeed,
    pinnedRandom,
    type RandomPin,
    type RandomStreamName,
} from "./pinned-random";
