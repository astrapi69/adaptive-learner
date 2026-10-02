import {fnv1a32, mulberry32} from "../../random";

/**
 * Deterministic, seed-stable Fisher-Yates shuffle for exercise option
 * lists. The same ``seed`` always yields the same order, so rendered
 * option positions stay stable across re-renders (no jitter) while
 * differing between exercises. Shared by every option-shuffling renderer
 * (multiple choice, cloze select/multiselect, categorization, picture
 * choice).
 *
 * The seed is folded through an FNV-1a hash and each Fisher-Yates step
 * draws from a mulberry32 PRNG. Both avalanche well, so seeds that share a
 * long common prefix - the norm for authored content ids (``ex-pick-morning``
 * / ``ex-pick-evening``, ``01-...`` / ``02-...``) - produce well-distributed
 * permutations. The earlier ``acc = acc * 31 + ch`` + LCG funnelled such
 * near-identical seeds onto the same low bits, so ``rnd % n`` was near-constant
 * and a first-authored correct answer landed at a FIXED display position across
 * the whole corpus (#2317). A modulo only ever reads low bits, so the fix has
 * to reach them.
 *
 * The hash and the PRNG are the app's one implementation in ``lib/random``
 * (#3214). The raw 32-bit step is recovered as
 * ``Math.floor(next() * 0x100000000)``: mulberry32 returns ``uint32 / 2^32``,
 * which binary64 represents exactly, so multiplying back is lossless and the
 * permutation for every seed is unchanged from the earlier inline step.
 *
 * @param items - the values to shuffle (not mutated).
 * @param seed - any string; typically ``exercise.id`` or ``${exercise.id}#${index}``.
 * @returns a new shuffled array.
 *
 * @example
 * seededShuffle(["a", "b", "c"], "ex-1"); // stable order for that seed
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    const next = mulberry32(fnv1a32(seed));
    for (let i = out.length - 1; i > 0; i--) {
        const rnd = Math.floor(next() * 0x100000000);
        const j = rnd % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
