/**
 * Whether a stored run may continue in the mode a lesson is opened in
 * (#3742).
 *
 * Every progress write stamps the CURRENT mode on the row, and the resume
 * path never compared it, so a run answered in practice (hints, theory
 * recap, immediate feedback) continued as an exam: the exam verdict, the
 * author's pass mark and the exam XP then judged practice answers. An exam
 * judges only answers given under exam conditions, so a run whose stored
 * mode differs from the current one, with ``exam`` on either side, does
 * not continue: it starts over. Same mode, or two non-exam modes, resume
 * as before.
 */

import type {LessonMode} from "../../learning/lessonModePref";

/** The progress fields the decision depends on. */
export interface ResumeModeRow {
    status: string;
    step_results?: Record<string, unknown> | null;
    /** The mode of the run's last write; absent on rows from before it
     *  was stored, which were practice runs. */
    lesson_mode?: string | null;
}

/** Lifecycle states a run can be continued from. */
const CONTINUABLE = new Set(["in_progress", "paused"]);

/**
 * Whether the stored run must start over instead of continuing in
 * ``mode``: it is under way (in progress or paused, at least one answer)
 * and its mode differs from ``mode`` with ``exam`` on either side.
 *
 * @example
 * resumeModeConflict(
 *     {status: "paused", step_results: {a: {}}, lesson_mode: "practice"},
 *     "exam",
 * ); // true
 */
export function resumeModeConflict(
    progress: ResumeModeRow | null,
    mode: LessonMode,
): boolean {
    if (!progress || !CONTINUABLE.has(progress.status)) return false;
    if (Object.keys(progress.step_results ?? {}).length === 0) return false;
    const stored = progress.lesson_mode ?? "practice";
    return stored !== mode && (stored === "exam" || mode === "exam");
}
