/**
 * update-impact — the heart of the set-update identity guard (#2128).
 *
 * A content update replaces content only and never touches LessonProgress /
 * ElementError (proven both-mode in #2128 / #2129). Progress therefore
 * survives an update only while the identity strings it pins to stay stable:
 * the lesson FILENAME (LessonProgress) and the (lesson_id, exercise_id,
 * element_key) tuple (ElementError / SRS). This module compares the
 * identities a learner already holds against the identities an INCOMING set
 * version actually contains, so the caller can decide BEFORE applying whether
 * the update would silently orphan progress.
 *
 * Pure + side-effect-free: the caller supplies the learner's rows (read via
 * getStorage, mode-agnostic) and the incoming identities (peeked over HTTP,
 * storage-mode-independent).
 */

import {elementIdentityKeysOf} from "../../srs/element-identity";
import type {KeyBearingExercise} from "../../srs/element-keys";

/**
 * A lesson exercise as the peek sees it: raw parsed JSON, not a constructed
 * ``ContentLessonExercise``. Only the id fields are read here; every
 * answer-bearing field is read by the shared key rule (see
 * {@link elementKeysOf}).
 */
export type PeekExercise = KeyBearingExercise & {
    id?: string;
    /** ``null`` admitted because the engine's generated type allows it. */
    stable_id?: string | null;
};

/** A lesson as the peek sees it: its filename + its exercises. */
export interface PeekLesson {
    filename: string;
    exercises: PeekExercise[];
}

/**
 * The element_keys an exercise contributes to the SRS.
 *
 * Delegates to {@link elementIdentityKeysOf} - the SAME rule the runtime
 * derivers in ``lib/srs/element-attempt.ts`` apply when recording an
 * attempt (identity-preferring: a pair/blank/option's own stable_id when
 * minted, engine#91, else the canonical content-derived text). Before #2303
 * this module carried its own copy covering five of thirteen types, so a
 * learner with rows on any other type saw EVERY update reported as breaking,
 * harmless ones included. A guard that always warns stops being read.
 *
 * ``null`` is preserved from the rule and means "type not known here" — an
 * undeclared ``ext:`` extension or a future core type. The caller treats that
 * as at-risk, so the guard still never under-warns. It is NOT the same as an
 * empty set, which means the type is known and contributes no keys.
 */
export function exerciseElementKeys(ex: PeekExercise): Set<string> | null {
    const keys = elementIdentityKeysOf(ex);
    return keys === null ? null : new Set(keys);
}

/** Fold peeked lessons into the {@link IncomingSetIdentities} the impact
 *  check consumes. */
export function buildIncomingIdentities(
    lessons: readonly PeekLesson[],
): IncomingSetIdentities {
    const byLesson = new Map<string, Map<string, Set<string> | null>>();
    const lessonSet = new Set<string>();
    for (const lesson of lessons) {
        lessonSet.add(lesson.filename);
        const byEx = new Map<string, Set<string> | null>();
        for (const ex of lesson.exercises) {
            // #2130: an exercise is reachable under BOTH of its ids — the
            // authored slug (pre-switch rows) and the stable_id (post-switch
            // rows). Both entries share one key set.
            const keys = ex.id || ex.stable_id ? exerciseElementKeys(ex) : null;
            if (ex.id) byEx.set(ex.id, keys);
            if (ex.stable_id) byEx.set(ex.stable_id, keys);
        }
        byLesson.set(lesson.filename, byEx);
    }
    return {lessons: lessonSet, byLesson};
}

/** The SRS identity a learner's ElementError row pins to. */
export interface SrsIdentity {
    /** Lesson filename (ElementError.lesson_id). */
    lesson_id: string;
    exercise_id: string;
    element_key: string;
}

/**
 * The identities an incoming (not-yet-applied) set version contains:
 * the lesson filenames, and per lesson a map of exercise_id -> the set of
 * element_keys that exercise contributes to the SRS (mirrors
 * ``lib/srs/element-attempt.ts``).
 */
export interface IncomingSetIdentities {
    lessons: ReadonlySet<string>;
    byLesson: ReadonlyMap<
        string,
        ReadonlyMap<string, ReadonlySet<string> | null>
    >;
}

export interface UpdateImpact {
    /** Distinct progress lesson filenames the incoming version no longer has. */
    lostLessons: string[];
    /** SRS identities the incoming version no longer resolves. */
    lostCards: SrsIdentity[];
    /** #2188 — identities the author DECLARED retired (manifest
     *  ``retired_ids``). A declared retirement is not an accident: these
     *  rows are archived on apply (history kept, out of scheduling), so
     *  they never make the update breaking. */
    retiredCards: SrsIdentity[];
    /** True when applying the update would orphan any progress-bearing identity. */
    breaking: boolean;
}

/**
 * Decide the impact of applying ``incoming`` on a learner who holds the given
 * progress + SRS identities. ``breaking`` is true iff at least one identity
 * the learner has would no longer resolve — that is exactly when the update
 * must be held for a decision instead of auto-applied. A superset update
 * (added lessons / exercises / accept-variants) is never breaking, and
 * neither is an author-declared retirement (``retiredIds``, #2188) — those
 * rows are archived on apply instead of orphaned.
 */
export function computeUpdateImpact(
    progressLessonFilenames: readonly string[],
    srsIdentities: readonly SrsIdentity[],
    incoming: IncomingSetIdentities,
    retiredIds: readonly string[] = [],
): UpdateImpact {
    const retired = new Set(retiredIds);
    const lostLessons = [...new Set(progressLessonFilenames)].filter(
        (filename) => !incoming.lessons.has(filename),
    );
    const unresolved = srsIdentities.filter((identity) => {
        const keys = incoming.byLesson.get(identity.lesson_id)?.get(
            identity.exercise_id,
        );
        return !keys || !keys.has(identity.element_key);
    });
    const retiredCards = unresolved.filter((identity) =>
        retired.has(identity.exercise_id),
    );
    const lostCards = unresolved.filter(
        (identity) => !retired.has(identity.exercise_id),
    );
    return {
        lostLessons,
        lostCards,
        retiredCards,
        breaking: lostLessons.length > 0 || lostCards.length > 0,
    };
}
