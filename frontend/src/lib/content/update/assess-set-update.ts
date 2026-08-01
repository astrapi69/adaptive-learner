/**
 * assess-set-update — orchestrates the #2128 update guard for one set.
 *
 * Reads the learner's own progress + SRS rows (via the mode-agnostic
 * getStorage facade, so it works identically in API and Dexie mode), peeks
 * the incoming set version over HTTP, and returns the {@link UpdateImpact}. A
 * caller uses ``breaking`` to decide whether to apply the update silently
 * (auto-sync) or hold it for a quantified confirmation (manual).
 *
 * Returns ``null`` when there is nothing to protect (no active user, or the
 * learner has no progress/SRS in this set) — the update is then safe to apply
 * without a peek. Throws only when the peek itself fails (network/parse); the
 * caller decides whether a peek failure means "skip and retry" (auto-sync) or
 * "proceed" (manual, user-initiated).
 */

import { getStorage } from "../../../storage";
import { peekSetLessons } from "../../../storage/content/peek-set";
import { readLearnerState } from "../../learning/learnerState";
import {
    buildIncomingIdentities,
    computeUpdateImpact,
    type PeekLesson,
    type UpdateImpact,
} from "./update-impact";

/**
 * The impact plus the peeked lessons it was computed from (#2308).
 *
 * The lessons ride along because deriving a re-keying needs the authored
 * ORDER, which the folded identities drop, and re-peeking for the dialog would
 * fetch the same set twice. The nightly sync ignores this field; it decides on
 * ``impact.breaking`` alone and never plans.
 */
export interface SetUpdateAssessment {
    impact: UpdateImpact;
    incomingLessons: PeekLesson[];
}

export async function assessSetUpdate(
    source: string,
    setId: string,
): Promise<SetUpdateAssessment | null> {
    const userId = readLearnerState().userId;
    if (!userId) return null;

    const storage = getStorage();
    const [progress, srs] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
    ]);
    const setProgress = progress.filter(
        (row) => row.source === source && row.set_id === setId,
    );
    const setSrs = srs.filter((row) => row.set_id === setId);
    // No learner data in this set → nothing to orphan → safe to apply.
    if (setProgress.length === 0 && setSrs.length === 0) return null;

    const incomingLessons = await peekSetLessons(source, setId);
    const impact = computeUpdateImpact(
        setProgress.map((row) => row.lesson_filename),
        setSrs.map((row) => ({
            lesson_id: row.lesson_id,
            exercise_id: row.exercise_id,
            element_key: row.element_key,
        })),
        buildIncomingIdentities(incomingLessons),
    );
    return {impact, incomingLessons};
}
