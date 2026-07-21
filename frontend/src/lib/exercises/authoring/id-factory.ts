/**
 * Injectable sequential id factory for authored exercises (#1862).
 *
 * Replaces the module-global ``let _exSeq`` / ``let _extSeq`` counters that
 * backed {@link newExerciseId} / {@link newExtensionExerciseId}. A factory
 * encapsulates its own counter, so a consumer can hold an ISOLATED sequence
 * (e.g. one per wizard instance) instead of sharing a single app-lifetime
 * global — and a test gets a fresh, deterministic sequence without leaking
 * state across cases. The free helpers keep working via a default factory
 * instance, so existing call sites are unchanged.
 *
 * @example
 * ```ts
 * const ids = createIdFactory("ex-manual");
 * ids.next(); // "ex-manual-1"
 * ids.next(); // "ex-manual-2"
 * ```
 */

/** A sequential id source: each {@link IdFactory.next} call yields the next
 *  ``<prefix>-<n>`` id in this factory's own sequence (``n`` starts at 1). */
export interface IdFactory {
    next(): string;
}

/** Build an {@link IdFactory} that stamps ids as ``<prefix>-<n>``, counting
 *  from 1 in its own private, injectable sequence. */
export function createIdFactory(prefix: string): IdFactory {
    let seq = 0;
    return {
        next(): string {
            seq += 1;
            return `${prefix}-${seq}`;
        },
    };
}
