/**
 * remap-plan — derive a PROPOSED old-to-new element_key mapping from the two
 * lesson versions the update guard already holds (#2308, Weg C of #2301).
 *
 * The guard runs BEFORE an update is applied, so both versions are on hand at
 * the same moment: the cached lesson (what the learner's rows were recorded
 * against) and the peeked incoming lesson. The element_key is the answer text,
 * so a corrected answer moves the key and orphans the row. Comparing the two
 * ORDERED key lists tells a correction apart from a reorder without guessing:
 *
 *   index i of the learner's key in the OLD list -> candidate is new[i]
 *   - certain   both lists have the same length AND new[i] appears nowhere in
 *               the old list. Then new[i] is a rewritten form of the same
 *               element, not a different element that moved.
 *   - uncertain anything else. Reported with the candidate it WOULD have
 *               picked, so the learner can see what was declined.
 *
 * The measurement behind this (#2301, 9 content repos, 312 commits) found 186
 * of 190 moved slots in the certain class and 4 in the uncertain one. Those 4
 * are the reason this module never applies anything by itself.
 *
 * Pure and side-effect free: the caller supplies both versions and the rows.
 *
 * @example
 * ```ts
 * const plan = planElementKeyRemaps(lostIdentities, cached, incoming, setId);
 * // plan.certain   -> offer to the learner, apply only on confirmation
 * // plan.uncertain -> show as "cannot be assigned", never apply
 * ```
 */

import {elementIdentityKeysOf} from "../../srs/element-identity";
import {matchesExerciseIdentity} from "../../srs/exercise-identity";
import type {ElementKeyRemap} from "../../../storage/types";
import type {PeekExercise, PeekLesson, SrsIdentity} from "./update-impact";

/** Why a learner's row could not be mapped. Each value is a REASON TO REFUSE,
 *  never a fallback that still writes something. */
export type UncertainReason =
    /** The candidate at the same position exists elsewhere in the old
     *  version: the list was reordered, so position proves nothing. */
    | "reordered"
    /** The two lists differ in length: every position after the change is
     *  shifted by an unknown amount. */
    | "shifted"
    /** The exercise type has no key rule (an undeclared extension), so no
     *  ordered list can be built. Inherited from #2303's fail-closed rule. */
    | "unknown_type"
    /** The exercise is not in the incoming version at all. That is the
     *  exercise level, which ``stable_id`` addresses (#2130), not this. */
    | "exercise_gone"
    /** The whole lesson file is not in the incoming version. */
    | "lesson_gone"
    /** The row's key is not in the CACHED version either, so there is no
     *  position to read. Typically a row that an earlier update already
     *  orphaned. */
    | "not_in_cached"
    /** Two rows would map onto the same new key. Applying both would collapse
     *  two histories into one, so neither is offered. */
    | "ambiguous_target";

export interface UncertainRemap {
    identity: SrsIdentity;
    reason: UncertainReason;
    /** What a position-only key would have picked. Shown so the decision is
     *  informed; never written. */
    candidate?: string;
}

export interface RemapPlan {
    /** Safe to offer. Still requires the learner's confirmation - the mapping
     *  is an inference, not a fact. */
    certain: ElementKeyRemap[];
    /** Reported, never applied. */
    uncertain: UncertainRemap[];
}

function findExercise(
    lessons: readonly PeekLesson[],
    lessonId: string,
    exerciseId: string,
): {lessonFound: boolean; exercise: PeekExercise | undefined} {
    const lesson = lessons.find((entry) => entry.filename === lessonId);
    if (!lesson) return {lessonFound: false, exercise: undefined};
    return {
        lessonFound: true,
        // #2130: a row may be keyed by the authored slug (pre-switch) or the
        // stable_id (post-switch); the exercise answers to either.
        exercise: lesson.exercises.find((ex) =>
            matchesExerciseIdentity(ex, exerciseId),
        ),
    };
}

/** Classify ONE row against the two versions. Returns either a remap or the
 *  reason it is being refused. */
function classify(
    identity: SrsIdentity,
    cached: readonly PeekLesson[],
    incoming: readonly PeekLesson[],
    setId: string,
): {remap: ElementKeyRemap} | UncertainRemap {
    const refuse = (reason: UncertainReason, candidate?: string): UncertainRemap =>
        candidate === undefined
            ? {identity, reason}
            : {identity, reason, candidate};

    const incomingHit = findExercise(incoming, identity.lesson_id, identity.exercise_id);
    if (!incomingHit.lessonFound) return refuse("lesson_gone");
    if (!incomingHit.exercise) return refuse("exercise_gone");

    const cachedHit = findExercise(cached, identity.lesson_id, identity.exercise_id);
    if (!cachedHit.exercise) return refuse("not_in_cached");

    // engine#91: identity keys, not canonical display text - a text
    // correction under an already-minted stable_id must look unchanged here.
    const oldKeys = elementIdentityKeysOf(cachedHit.exercise);
    const newKeys = elementIdentityKeysOf(incomingHit.exercise);
    if (oldKeys === null || newKeys === null) return refuse("unknown_type");

    const index = oldKeys.indexOf(identity.element_key);
    if (index < 0) return refuse("not_in_cached");

    const candidate = newKeys[index];
    // Reorder is checked BEFORE length, and deliberately so: when a list both
    // shrinks and reorders (the real 135c4442 event - a wrongly-marked second
    // correct image taken back), the reportable hazard is that position i now
    // points at a DIFFERENT element that already existed. Reporting that as a
    // mere length change would hide the one failure mode a position key gets
    // wrong silently.
    if (candidate !== undefined && oldKeys.includes(candidate)) {
        return refuse("reordered", candidate);
    }
    if (newKeys.length !== oldKeys.length) return refuse("shifted", candidate);
    if (candidate === undefined) return refuse("shifted");

    return {
        remap: {
            set_id: setId,
            lesson_id: identity.lesson_id,
            exercise_id: identity.exercise_id,
            old: identity.element_key,
            new: candidate,
        },
    };
}

/** Key identifying one target row, so two proposals onto the same row are
 *  detectable before anything is written. */
function targetKey(remap: ElementKeyRemap): string {
    return [remap.lesson_id, remap.exercise_id, remap.new].join("\u0000");
}

/**
 * Build the proposed mapping for the learner's rows in one set.
 *
 * ``identities`` are the rows whose key would no longer resolve (the guard's
 * ``lostCards``); a row whose key still resolves needs nothing and is skipped
 * silently.
 */
export function planElementKeyRemaps(
    identities: readonly SrsIdentity[],
    cached: readonly PeekLesson[],
    incoming: readonly PeekLesson[],
    setId: string,
): RemapPlan {
    const certain: ElementKeyRemap[] = [];
    const uncertain: UncertainRemap[] = [];

    for (const identity of identities) {
        const incomingHit = findExercise(
            incoming,
            identity.lesson_id,
            identity.exercise_id,
        );
        // Still resolves in the incoming version -> nothing was orphaned.
        // engine#91: identity keys here too, or a row already keyed by a
        // minted stable_id would never short-circuit on a harmless text
        // correction and would fall through to classify() needlessly.
        const stillThere = incomingHit.exercise
            ? elementIdentityKeysOf(incomingHit.exercise)?.includes(identity.element_key)
            : false;
        if (stillThere) continue;

        const verdict = classify(identity, cached, incoming, setId);
        if ("remap" in verdict) certain.push(verdict.remap);
        else uncertain.push(verdict);
    }

    // Two rows proposing the same target would collapse two histories into
    // one. The remap primitive refuses the second write, but a plan that
    // OFFERS the collision has already misled the learner about what will
    // happen, so neither is offered.
    const perTarget = new Map<string, number>();
    for (const remap of certain) {
        perTarget.set(targetKey(remap), (perTarget.get(targetKey(remap)) ?? 0) + 1);
    }
    const unique = certain.filter((remap) => perTarget.get(targetKey(remap)) === 1);
    for (const remap of certain) {
        if (perTarget.get(targetKey(remap)) === 1) continue;
        uncertain.push({
            identity: {
                lesson_id: remap.lesson_id,
                exercise_id: remap.exercise_id,
                element_key: remap.old,
            },
            reason: "ambiguous_target",
            candidate: remap.new,
        });
    }

    return {certain: unique, uncertain};
}
