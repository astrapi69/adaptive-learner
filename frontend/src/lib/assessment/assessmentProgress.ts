/**
 * Resumable-assessment progress (#106).
 *
 * Persists the in-flight assessment (which question, the answers so
 * far, when it started) so a learner who abandons partway can pick up
 * where they left off. Stored in localStorage, keyed by the project
 * the profile belongs to, so it works identically in both storage
 * modes (API + Dexie) without a backend round-trip — the progress is
 * transient working state that is deleted the moment the profile is
 * computed, not part of the synced domain model.
 *
 * (Cross-device mid-assessment resume would need the progress on the
 * synced surface; that is out of scope here — onboarding is per-device
 * and the profile itself is what syncs on completion.)
 */

const PREFIX = "adaptive-learner.assessment.progress.";

/** Window event so the Dashboard / Settings re-read live when the
 *  assessment saves or clears progress within the same tab. */
export const ASSESSMENT_PROGRESS_CHANGE_EVENT =
    "adaptive-learner:assessment-progress";

export interface AssessmentProgress {
    /** 0-based index of the question to resume on. */
    currentQuestion: number;
    /** Answers chosen so far, keyed by question id. */
    answers: Record<string, string[]>;
    /** ISO timestamp of when the assessment was first started. */
    startedAt: string;
}

function keyFor(projectId: string): string {
    return `${PREFIX}${projectId}`;
}

function notifyChange(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(ASSESSMENT_PROGRESS_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Read the saved progress for a project, or null if none / invalid. */
export function readAssessmentProgress(
    projectId: string | null,
): AssessmentProgress | null {
    if (!projectId) return null;
    try {
        const raw = localStorage.getItem(keyFor(projectId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!isAssessmentProgress(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Persist the in-flight assessment progress for a project, then fire
 *  the change event so the same tab re-reads live. No-op when
 *  ``projectId`` is null or localStorage is unavailable. */
export function writeAssessmentProgress(
    projectId: string | null,
    progress: AssessmentProgress,
): void {
    if (!projectId) return;
    try {
        localStorage.setItem(keyFor(projectId), JSON.stringify(progress));
    } catch {
        /* no-op */
    }
    notifyChange();
}

/** Delete the saved assessment progress for a project (e.g. once the
 *  profile is computed), then fire the change event. No-op when
 *  ``projectId`` is null or localStorage is unavailable. */
export function clearAssessmentProgress(projectId: string | null): void {
    if (!projectId) return;
    try {
        localStorage.removeItem(keyFor(projectId));
    } catch {
        /* no-op */
    }
    notifyChange();
}

/**
 * True when a non-empty, incomplete assessment is saved for the
 * project (at least one answer recorded). A saved progress with no
 * answers is treated as "not started" so the resume invitation only
 * appears once the learner has actually begun.
 */
export function hasIncompleteAssessment(projectId: string | null): boolean {
    const progress = readAssessmentProgress(projectId);
    return progress != null && Object.keys(progress.answers).length > 0;
}

function isAssessmentProgress(value: unknown): value is AssessmentProgress {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.currentQuestion === "number" &&
        typeof candidate.startedAt === "string" &&
        typeof candidate.answers === "object" &&
        candidate.answers !== null
    );
}
