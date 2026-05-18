/**
 * Typed wrapper around localStorage for the active-learner state.
 *
 * The v0.1.0 product is a single-user desktop install with no
 * login flow: the user_id + project_id resolved after onboarding
 * are the "current learner". We park them in localStorage so the
 * Dashboard / Session / Settings pages can read them without
 * threading them through every navigation hop.
 *
 * Keys are namespaced (``adaptive-learner.*``) so a future
 * multi-user expansion can clear them all in one sweep.
 */

const KEY_USER_ID = "adaptive-learner.user_id";
const KEY_PROJECT_ID = "adaptive-learner.project_id";
const KEY_LANGUAGE = "adaptive-learner.language";

interface LearnerState {
    userId: string | null;
    projectId: string | null;
    language: string | null;
}

export function readLearnerState(): LearnerState {
    return {
        userId: localStorage.getItem(KEY_USER_ID),
        projectId: localStorage.getItem(KEY_PROJECT_ID),
        language: localStorage.getItem(KEY_LANGUAGE),
    };
}

export function setUserId(userId: string): void {
    localStorage.setItem(KEY_USER_ID, userId);
}

export function setProjectId(projectId: string): void {
    localStorage.setItem(KEY_PROJECT_ID, projectId);
}

export function setLanguage(lang: string): void {
    localStorage.setItem(KEY_LANGUAGE, lang);
}

export function clearLearnerState(): void {
    localStorage.removeItem(KEY_USER_ID);
    localStorage.removeItem(KEY_PROJECT_ID);
    localStorage.removeItem(KEY_LANGUAGE);
}
