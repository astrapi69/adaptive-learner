/**
 * Seeded randomness for the app (#3214): the one PRNG implementation and the
 * per-consumer seam that pins it in visual runs. The pin's shape
 * (``RandomPin``, ``isRandomPin``, ``RandomStreamName``) is imported from
 * ``./pinned-random`` directly by the harness and the tests that need it.
 *
 * @example
 * import {fnv1a32, mulberry32} from "../random";
 */

export {fnv1a32, mulberry32} from "./prng";
export {RANDOM_PIN_GLOBAL, mountShuffleSeed, pinnedRandom} from "./pinned-random";
