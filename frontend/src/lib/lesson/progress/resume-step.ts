/**
 * Where a lesson run resumes (#41, #3076).
 *
 * One rule, shared by the lesson page (which restores the step on load)
 * and the dashboard's "continue learning" row (which names the step the
 * click lands on). Before #3076 the row counted graded exercises instead,
 * so "Step 1/8" sat next to a resume that reopened step 4.
 */

/** The progress fields the resume position depends on. */
export interface ResumeProgressRow {
    status: string;
    step_results: Record<string, unknown>;
    current_step?: number | null;
}

/**
 * 0-based index of the step a run resumes on: the step after the furthest
 * graded exercise, or the persisted navigation position when that is
 * further (theory steps write no result), capped at the summary index
 * (``steps.length``); a completed run resumes on the summary.
 *
 * @example
 * resumeStepIndex(["a", "b", "c", "d"], {status: "paused", step_results: {b: {}}, current_step: 3}) // 3
 */
export function resumeStepIndex(
    stepIds: readonly string[],
    row: ResumeProgressRow | null,
): number {
    const length = stepIds.length;
    if (row === null) return 0;
    if (row.status === "completed") return length;
    const graded = Object.keys(row.step_results ?? {});
    let next = 0;
    for (let i = 0; i < length; i++) {
        if (graded.includes(stepIds[i])) next = i + 1;
    }
    next = Math.max(next, row.current_step ?? 0);
    return Math.min(next, length);
}

/**
 * 1-based step number to show for a run that will resume, clamped to the
 * step count so a run sitting on the summary reads "N/N", never "N+1/N".
 */
export function resumeStepNumber(
    stepIds: readonly string[],
    row: ResumeProgressRow | null,
): number {
    if (stepIds.length === 0) return 0;
    return Math.min(resumeStepIndex(stepIds, row) + 1, stepIds.length);
}
