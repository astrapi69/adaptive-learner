/**
 * jkz-recovery — pure detection + plan for the one-off ja/ko/zh element_key
 * incident (#2161 / #2128 forensic). The 2026-07 transliteration rewrite of
 * ja-a1 / ko-a1 / zh-a1 changed 172 answer strings, silently orphaning any
 * SRS row keyed on the old string. We do NOT auto-remap (a wrong remap hangs
 * invisibly on the wrong card). Instead we detect the recoverable rows exactly
 * (by the full tuple + the originally-published element_key) so the app can
 * explain and let the learner choose to restore or restart.
 */

/** One incident mapping row (from the versioned data file): the originally
 *  published element_key -> the current content's element_key. */
export interface IncidentMapping {
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    old: string;
    new: string;
}

/** The identity fields of a learner's ElementError row the plan reads. */
export interface SrsKeyRow {
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    element_key: string;
}

/** A concrete re-key the recovery will apply (old element_key -> new). */
export interface Remap {
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    oldKey: string;
    newKey: string;
}

export interface RecoveryPlan {
    /** Number of SRS rows that are orphaned by this incident and recoverable. */
    count: number;
    /** The affected set ids the learner actually has progress in, sorted. */
    affectedSets: string[];
    /** The concrete re-keys to apply. */
    remaps: Remap[];
}

/** Look up the element_keys an exercise currently has in the CACHED content
 *  (returns undefined when the lesson/exercise is no longer present). */
export type CurrentKeyLookup = (
    set_id: string,
    lesson_id: string,
    exercise_id: string,
) => ReadonlySet<string> | undefined;

/** Map an AUTHORED exercise id (as frozen in the incident table) to the
 *  exercise's current ``stable_id`` in the cached content, when it has one
 *  (#2467). The #2130 migration re-keys learner rows to ``stable_id``, so a
 *  row and the table may name the same exercise under two ids; both ids sit
 *  in the same cached lesson file, which is where this alias comes from. */
export type AuthoredIdAlias = (
    set_id: string,
    lesson_id: string,
    exercise_id: string,
) => string | undefined;

/**
 * Split remaps by whether the ``newKey`` still exists in the learner's CURRENT
 * cached content (condition 3: verify targets, don't assume). If a set was
 * updated AGAIN since the incident snapshot, an entry may point at a key that
 * no longer exists — those are ``unmappable`` and must be reported, never
 * written. Only ``applicable`` remaps are safe to apply.
 */
export function partitionByCurrentContent(
    remaps: readonly Remap[],
    lookup: CurrentKeyLookup,
): {applicable: Remap[]; unmappable: Remap[]} {
    const applicable: Remap[] = [];
    const unmappable: Remap[] = [];
    for (const remap of remaps) {
        const keys = lookup(remap.set_id, remap.lesson_id, remap.exercise_id);
        (keys?.has(remap.newKey) ? applicable : unmappable).push(remap);
    }
    return {applicable, unmappable};
}

function tuple(set_id: string, lesson_id: string, exercise_id: string, key: string): string {
    // NUL-joined so the parts can never collide.
    return `${set_id}\u0000${lesson_id}\u0000${exercise_id}\u0000${key}`;
}

/**
 * Given the learner's SRS identity rows and the incident mapping, return the
 * rows that were orphaned by the rewrite and can be re-keyed. A row matches
 * ONLY on the exact (set_id, lesson_id, exercise_id, element_key == mapping
 * `old`) tuple — a row already on the new key, or in another lesson, does not
 * match. No guessing, no fuzzy fallback.
 */
export function detectRecoverable(
    rows: readonly SrsKeyRow[],
    mappings: readonly IncidentMapping[],
    aliasOf?: AuthoredIdAlias,
): RecoveryPlan {
    const byOld = new Map<string, IncidentMapping>();
    for (const m of mappings) {
        byOld.set(tuple(m.set_id, m.lesson_id, m.exercise_id, m.old), m);
        // #2467: a row the #2130 migration re-keyed to stable_id names the
        // same exercise under its stable id; the table stays authored.
        const alias = aliasOf?.(m.set_id, m.lesson_id, m.exercise_id);
        if (alias && alias !== m.exercise_id) {
            byOld.set(tuple(m.set_id, m.lesson_id, alias, m.old), m);
        }
    }
    const remaps: Remap[] = [];
    const sets = new Set<string>();
    for (const row of rows) {
        const m = byOld.get(
            tuple(row.set_id, row.lesson_id, row.exercise_id, row.element_key),
        );
        if (!m) continue;
        remaps.push({
            set_id: row.set_id,
            lesson_id: row.lesson_id,
            exercise_id: row.exercise_id,
            oldKey: m.old,
            newKey: m.new,
        });
        sets.add(row.set_id);
    }
    return {count: remaps.length, affectedSets: [...sets].sort(), remaps};
}
