/**
 * LearningProject filter + predicate helpers (Phase 46F.3 / v1.31.0).
 *
 * The ``"content"`` pseudo-project that the backend auto-
 * creates for the LessonProgress<->LearningSession
 * unification (see ``backend/app/services/lesson_session_unification.py``)
 * is filtered out of every UI project picker via these
 * helpers. Centralised here so every consumer applies the
 * same rule — Dashboard project filter, Onboarding picker,
 * LearningRepoSettings picker, and any future picker added
 * after v1.31.0.
 *
 * Backend behaviour stays unchanged: the project list
 * endpoint exposes the pseudo-project (so a future "show all
 * activity" admin view can opt in to display it). The
 * filtering is a UI-policy decision, not a data-hiding one.
 */

import type { LearningProject } from "../types/domain";

/**
 * True iff this project is the wizard-created kind a user
 * should be able to select / edit / archive. Defensive on
 * ``undefined`` kind so a pre-v1.31.0 cached response (where
 * ``kind`` didn't exist on the wire) is treated as standard.
 */
export function isStandardProject(project: LearningProject): boolean {
    const kind = project.kind ?? "standard";
    return kind === "standard";
}

/**
 * Filter a project list to UI-visible (standard-kind) only.
 * Use at every project-picker callsite.
 */
export function filterStandardProjects(
    projects: LearningProject[],
): LearningProject[] {
    return projects.filter(isStandardProject);
}
