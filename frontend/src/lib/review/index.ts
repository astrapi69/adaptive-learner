export { explainError, explainErrors } from "./explain-error";
export type { ErrorExplanation } from "./explain-error";
export { questionForError } from "./error-question";
export { DEFAULT_REVIEW_LIMIT, _buildReviewStep, countCoveredElements, coveredElementKeys, dedupeReviewQueueByElement, dedupeReviewSteps, synthesizeReviewLesson } from "./review-lesson";
export type { SynthesizeOpts } from "./review-lesson";
export { loadReviewQueue } from "./review-queue";
export type { LoadReviewQueueOpts } from "./review-queue";
export { DEFAULT_EXPLANATIONS_ENABLED, REVIEW_PREF_CHANGE_EVENT, readExplanationsEnabled, setExplanationsEnabled } from "./reviewPref";
export { REVIEWS_CHANGED_EVENT, notifyReviewsChanged } from "./reviewsChanged";
