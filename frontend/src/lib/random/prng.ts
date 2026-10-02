/**
 * The app's one seeded PRNG: an FNV-1a string hash for seeding and a
 * mulberry32 generator (#3214).
 *
 * Both used to exist twice (``missions/generator.ts`` and the option shuffle
 * in ``exercises/grading/seeded-shuffle.ts``). mulberry32 is now implemented
 * only here in ``frontend/src``. FNV-1a has one more, deliberately different
 * variant: ``anki/apkg-builder.ts`` ``fieldChecksum`` multiplies in floating
 * point, so its values differ, and it stays that way so exported Anki
 * checksums do not change. The avatar palette index in
 * ``content/media/placeholder-svg.ts`` builds on ``fnv1a32``. The other
 * string hashes in the app (``exercises/direction.ts``,
 * ``storage/ai/model-discovery.ts``) are different algorithms, not copies.
 *
 * The visual harness ships ``mulberry32`` into the page as source text
 * (``legacyRandomInitScript`` in ``src/test-utils/visual-pins.ts`` calls its
 * ``toString()``), so it has to stay self-contained: nothing outside its
 * own body except ``Math``.
 *
 * Pure: no imports, no state outside the returned closure, no side effects on
 * import.
 */

/**
 * FNV-1a 32-bit string hash. Avalanches, so two inputs differing only in a
 * suffix diverge across ALL bits, including the low bits a modulo reads
 * (#2317).
 *
 * @param input - Any string (an exercise id, ``userId:date:mix``, a stream name).
 * @returns An unsigned 32-bit integer.
 *
 * @example
 * const seed = fnv1a32("ex-pick-morning");
 */
export function fnv1a32(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * mulberry32 PRNG: deterministic, well distributed, tiny. Every call returns
 * a fresh, independent generator; only that closure advances its state.
 *
 * The float is the unsigned 32-bit step divided by 2^32. That division is
 * exact in binary64, so ``Math.floor(next() * 0x100000000)`` recovers the raw
 * 32-bit step bit for bit (``seededShuffle`` relies on this).
 *
 * @param seed - Any integer; only its low 32 bits are used.
 * @returns A generator of floats in ``[0, 1)``.
 *
 * @example
 * const next = mulberry32(fnv1a32("user-1:2026-06-10:balanced"));
 * const pick = Math.floor(next() * items.length);
 */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}
