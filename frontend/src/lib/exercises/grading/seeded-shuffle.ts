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
 * @param items - the values to shuffle (not mutated).
 * @param seed - any string; typically ``exercise.id`` or ``${exercise.id}#${index}``.
 * @returns a new shuffled array.
 *
 * @example
 * seededShuffle(["a", "b", "c"], "ex-1"); // stable order for that seed
 */

/** FNV-1a 32-bit string hash. Avalanches so two seeds differing only in a
 *  suffix diverge across ALL bits, including the low bits a modulo reads. */
function _hash32(seed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    let state = _hash32(seed);
    for (let i = out.length - 1; i > 0; i--) {
        // mulberry32 step: a small PRNG whose output avalanches in every bit,
        // so ``rnd % (i + 1)`` is well-distributed even for near-identical seeds.
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        const rnd = (t ^ (t >>> 14)) >>> 0;
        const j = rnd % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
