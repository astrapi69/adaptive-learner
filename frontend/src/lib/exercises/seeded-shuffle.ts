/**
 * Deterministic, seed-stable Fisher-Yates shuffle for exercise option
 * lists. The same ``seed`` always yields the same order, so rendered
 * option positions stay stable across re-renders (no jitter) while
 * differing between exercises. Shared by the cloze select-mode dropdown
 * and the #1195 multiselect checkbox group.
 *
 * @param items - the values to shuffle (not mutated).
 * @param seed - any string; typically ``${exercise.id}#${index}``.
 * @returns a new shuffled array.
 *
 * @example
 * seededShuffle(["a", "b", "c"], "ex-1#0"); // stable order for that seed
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    let acc = 0;
    for (const ch of seed) acc = (acc * 31 + ch.charCodeAt(0)) | 0;
    for (let i = out.length - 1; i > 0; i--) {
        acc = (acc * 1103515245 + 12345) & 0x7fffffff;
        const j = acc % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
