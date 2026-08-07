/**
 * jkz-recovery-service — orchestrates the one-off ja/ko/zh recovery (#2161).
 *
 * Ties the pure detection/plan (jkz-recovery) to the learner's real data via
 * the mode-agnostic getStorage facade: it reads the SRS rows, verifies each
 * mapping's target against the CURRENT cached content (condition 3 — never
 * assume the table still fits), and applies the remap through the both-mode,
 * idempotent, atomic ``elementErrors.remapKeys`` primitive. The two learner
 * choices (restore / restart) both live here and are only ever called from a
 * user action, never automatically.
 */

import incidentData from "../../../data/recovery/jkz-2026-07-transliteration.json";
import {getStorage} from "../../../storage";
import {OFFICIAL_SOURCE} from "../../../storage/content/content-loader-sources";
import {readLearnerState} from "../../learning/learnerState";
import {exerciseElementKeys} from "../update/update-impact";
import {
    detectRecoverable,
    partitionByCurrentContent,
    type AuthoredIdAlias,
    type CurrentKeyLookup,
    type IncidentMapping,
    type Remap,
} from "./jkz-recovery";

const MAPPINGS = incidentData.mappings as IncidentMapping[];
/** The set ids this incident touched (ja/ko/zh A1). */
export const RECOVERY_SET_IDS = incidentData.set_ids as string[];
/** How many table entries exist in total (Endbericht: the incident size). */
export const INCIDENT_MAPPING_COUNT = MAPPINGS.length;

export interface RecoveryAssessment {
    /** Sets with at least one applicable (content-verified) remap, sorted. */
    affectedSets: string[];
    /** Total applicable re-keys across all affected sets. */
    applicableCount: number;
    /** Re-keys whose target no longer exists in the cached content (a set
     *  updated again since the snapshot) — reported, never written. */
    unmappableCount: number;
    /** Applicable remaps grouped by set id. */
    remapsBySet: Record<string, Remap[]>;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch {
        return null;
    }
}

/** The cached-content view the recovery needs: element_keys per exercise
 *  (reachable under BOTH of its ids, #2467) plus the authored-id -> stable_id
 *  alias the #2130 migration introduced. */
interface ContentIndex {
    lookup: CurrentKeyLookup;
    aliasOf: AuthoredIdAlias;
}

/** Read the current cached content for every (set, lesson) the incident
 *  table references. Official-source sets only (ja/ko/zh are official). */
async function buildContentIndex(
    mappings: readonly (IncidentMapping | Remap)[],
): Promise<ContentIndex> {
    const storage = getStorage();
    const cache = new Map<string, ReadonlySet<string>>();
    const aliases = new Map<string, string>();
    const lessons = new Set(mappings.map((r) => `${r.set_id}\u0000${r.lesson_id}`));
    for (const composite of lessons) {
        const [setId, lessonId] = composite.split("\u0000");
        const lesson = await safe(() =>
            storage.contentLoader.getLesson(OFFICIAL_SOURCE, setId, lessonId),
        );
        if (!lesson) continue;
        for (const step of lesson.steps ?? []) {
            const ex = step.exercise;
            if (!ex?.id) continue;
            // #2303: null means the key rule does not know this exercise
            // type, so the target CANNOT be verified. Leave it out of the
            // cache - the lookup then reports "not found" and the mapping is
            // counted unmappable (reported, never written) instead of guessed.
            const keys = exerciseElementKeys(ex);
            if (keys) {
                // #2467: reachable under both ids - a row may be keyed by the
                // authored slug (pre-#2130) or the stable_id (post-migration).
                cache.set(`${setId}\u0000${lessonId}\u0000${ex.id}`, keys);
                if (ex.stable_id) {
                    cache.set(`${setId}\u0000${lessonId}\u0000${ex.stable_id}`, keys);
                }
            }
            if (ex.stable_id && ex.stable_id !== ex.id) {
                aliases.set(`${setId}\u0000${lessonId}\u0000${ex.id}`, ex.stable_id);
            }
        }
    }
    return {
        lookup: (setId, lessonId, exerciseId) =>
            cache.get(`${setId}\u0000${lessonId}\u0000${exerciseId}`),
        aliasOf: (setId, lessonId, exerciseId) =>
            aliases.get(`${setId}\u0000${lessonId}\u0000${exerciseId}`),
    };
}

/**
 * Assess the learner's data for the incident. Returns ``null`` when there is
 * nothing to offer (no user, or no recoverable rows) — the notice must show
 * ONLY when the state is actually detected. Re-reads live data every call, so
 * it reflects the current state after a restore/restart (state-driven notice).
 */
export async function assessJkzRecovery(): Promise<RecoveryAssessment | null> {
    const userId = readLearnerState().userId;
    if (!userId) return null;
    const rows = await safe(() =>
        getStorage().elementErrors.list(userId, {includeMastered: true}),
    );
    if (!rows) return null;
    // Cheap guard before any content read: only learners with rows in the
    // incident sets can be affected at all.
    if (!rows.some((row) => RECOVERY_SET_IDS.includes(row.set_id))) return null;
    // #2467: the index must exist BEFORE detection - a row the #2130
    // migration re-keyed to stable_id only matches the (authored-id) incident
    // table through the alias derived from the cached lessons.
    const index = await buildContentIndex(MAPPINGS);
    const detected = detectRecoverable(rows, MAPPINGS, index.aliasOf);
    if (detected.count === 0) return null;
    const {applicable, unmappable} = partitionByCurrentContent(
        detected.remaps,
        index.lookup,
    );
    if (applicable.length === 0 && unmappable.length === 0) return null;
    const remapsBySet: Record<string, Remap[]> = {};
    for (const remap of applicable) {
        (remapsBySet[remap.set_id] ??= []).push(remap);
    }
    return {
        affectedSets: Object.keys(remapsBySet).sort(),
        applicableCount: applicable.length,
        unmappableCount: unmappable.length,
        remapsBySet,
    };
}

export interface RecoveryOutcome {
    applied: number;
    skipped: number;
    /** Entries that could not be mapped (target absent in current content). */
    unmapped: number;
}

/**
 * Restore the affected review cards of ONE set (user-triggered). Re-assesses
 * live so it always applies content-verified remaps and is idempotent (a
 * second call finds nothing left to do). Returns the counts to show the
 * learner (a partial result is valid and must be visible).
 */
export async function restoreRecoverySet(setId: string): Promise<RecoveryOutcome> {
    const userId = readLearnerState().userId;
    if (!userId) return {applied: 0, skipped: 0, unmapped: 0};
    const assessment = await assessJkzRecovery();
    const remaps = assessment?.remapsBySet[setId] ?? [];
    const unmapped = assessment?.unmappableCount ?? 0;
    if (remaps.length === 0) return {applied: 0, skipped: 0, unmapped};
    const {applied, skipped} = await getStorage().elementErrors.remapKeys(
        userId,
        remaps.map((r) => ({
            set_id: r.set_id,
            lesson_id: r.lesson_id,
            exercise_id: r.exercise_id,
            old: r.oldKey,
            new: r.newKey,
        })),
    );
    return {applied, skipped, unmapped};
}

/**
 * Restart ONE set (user-triggered): drop its progress + review cards so the
 * learner begins fresh. Uses the existing both-mode learner-data delete.
 */
export async function restartRecoverySet(setId: string): Promise<void> {
    const userId = readLearnerState().userId;
    if (!userId) return;
    const storage = getStorage();
    const progress = await safe(() => storage.lessonProgress.list(userId));
    const lessonProgressIds = (progress ?? [])
        .filter((row) => row.source === OFFICIAL_SOURCE && row.set_id === setId)
        .map((row) => row.id);
    await storage.learningData.deleteLearningData(userId, {
        lessonProgressIds,
        setIds: [setId],
    });
}
