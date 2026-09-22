/**
 * "Alles wiederholen" (#3171): reset a set's results so the learner can
 * rebuild the average from a clean slate.
 *
 * Composes two primitives that already exist in BOTH storage modes, so
 * nothing here is mode-specific and one implementation serves ApiStorage
 * and DexieStorage alike (#2053):
 *
 *   - ``learningData.deleteLearningData`` drops the set's ``LessonProgress``
 *     rows (score, stars, study time) -> the set restarts at lesson 1.
 *   - ``elementErrors.startRun`` opens a new Durchgang (EXP-051 / #2188):
 *     the previous run's element-error rows stay frozen under their
 *     ``run_id`` for the Fehlerhistorie, the new run starts without errors.
 *
 * XP, badges and streaks are deliberately not touched (earned stays
 * earned). Takes the storage facade as a parameter (seam-driven) so it can
 * be proven against both implementations without patching ``getStorage``.
 *
 * @example
 * const summary = await summarizeSetResults(getStorage(), userId, {source, setId});
 * await resetSetResults(getStorage(), userId, {source, setId});
 */

import type {IStorageService, LessonProgress} from "../../storage/types";

/** Which set to summarise / reset. */
export interface SetResultsScope {
    source: string;
    setId: string;
}

/** What the confirmation names before anything is deleted. */
export interface SetResultsSummary {
    /** Ids of the set's progress rows; exactly what the reset deletes. */
    progressIds: string[];
    /** Lessons of the set with any recorded progress. */
    lessonCount: number;
    /** Percent correct over every scored lesson (rounded), or null when
     *  no lesson of the set has been scored yet. */
    averagePercent: number | null;
}

/** What the reset did. */
export interface SetResultsResetOutcome {
    lessonsDeleted: number;
    /** The newly opened run (``run_id``). */
    runId: number;
}

function rowsOfSet(rows: readonly LessonProgress[], scope: SetResultsScope): LessonProgress[] {
    return rows.filter((row) => row.source === scope.source && row.set_id === scope.setId);
}

/** Percent correct across the scored rows, rounded; null without a score. */
export function averagePercentOf(rows: readonly LessonProgress[]): number | null {
    let correct = 0;
    let total = 0;
    for (const row of rows) {
        if (row.score_total > 0) {
            correct += row.score_correct;
            total += row.score_total;
        }
    }
    if (total === 0) return null;
    return Math.round((correct / total) * 100);
}

/**
 * Read the set's current results (lesson count, average, row ids) so the
 * confirmation can name what is about to be reset.
 */
export async function summarizeSetResults(
    storage: IStorageService,
    userId: string,
    scope: SetResultsScope,
): Promise<SetResultsSummary> {
    const rows = rowsOfSet(await storage.lessonProgress.list(userId), scope);
    return {
        progressIds: rows.map((row) => row.id),
        lessonCount: rows.length,
        averagePercent: averagePercentOf(rows),
    };
}

/**
 * Reset the set: delete its progress rows (only when there are any) and
 * open a new run. Element-error rows are kept as the previous run's
 * history; XP and badges are untouched.
 */
export async function resetSetResults(
    storage: IStorageService,
    userId: string,
    scope: SetResultsScope,
): Promise<SetResultsResetOutcome> {
    const summary = await summarizeSetResults(storage, userId, scope);
    let lessonsDeleted = 0;
    if (summary.progressIds.length > 0) {
        const deleted = await storage.learningData.deleteLearningData(userId, {
            lessonProgressIds: summary.progressIds,
            setIds: [],
        });
        lessonsDeleted = deleted.lessonsDeleted;
    }
    const run = await storage.elementErrors.startRun(userId, scope.setId);
    return {lessonsDeleted, runId: run.run_id};
}
