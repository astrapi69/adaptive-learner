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

/** Why a stored run must start over instead of continuing (#3744, #3750). */
export type ResumeBlock = "mode_conflict" | "exam_single_sitting";

/**
 * Whether, and why, the stored run must start over when the lesson opens
 * in ``mode``.
 *
 * - ``mode_conflict`` (#3744): the run was started in another mode with
 *   ``exam`` on either side.
 * - ``exam_single_sitting`` (#3750): a started exam reopened as an exam.
 *   An exam counts only when taken in one sitting; continuing it carried
 *   answers from an earlier session into the result, which the forward-only
 *   exam never shows again.
 *
 * An exam whose run already stands on its summary (``atSummary``, all
 * steps done) is not blocked: reopening it shows its result.
 *
 * @example
 * resumeBlock({status: "paused", step_results: {a: {}}, lesson_mode: "exam"}, "exam", false);
 * // "exam_single_sitting"
 */
export function resumeBlock(
    progress: ResumeModeRow | null,
    mode: LessonMode,
    atSummary: boolean,
): ResumeBlock | null {
    if (resumeModeConflict(progress, mode)) return "mode_conflict";
    if (!progress || !CONTINUABLE.has(progress.status) || atSummary) return null;
    if (Object.keys(progress.step_results ?? {}).length === 0) return null;
    return mode === "exam" ? "exam_single_sitting" : null;
}

/**
 * Whether the stored run is under way: it has at least one answer and is
 * not a finished run (#3746). A restarted run, or a row created only by
 * position writes while the theory is read, is ``in_progress`` without an
 * answer and is not under way yet: its mode may still change. Shared by
 * the mode lock, the exam notice and {@link resumeModeConflict}.
 *
 * @example
 * runHasAnswer({status: "in_progress", step_results: {}}); // false
 */
export function runHasAnswer(progress: ResumeModeRow | null): boolean {
    if (!progress || progress.status === "completed") return false;
    return Object.keys(progress.step_results ?? {}).length > 0;
}
