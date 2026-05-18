/**
 * Type barrel. Domain interfaces re-export from ``./domain``;
 * enum literals come from ``../lib/constants``.
 */

export type {
    AssessmentAnswer,
    AssessmentEvaluatePayload,
    AssessmentQuestion,
    LearningProfile,
    LearningProject,
    LearningSession,
    MethodSwitch,
    ProgressCommit,
    ProgressSummary,
    SessionEndResult,
    SessionMessage,
    SessionRating,
    SessionStartResult,
    ToolRecommendation,
    TrackingSummary,
    User,
    UserSettings,
} from "./domain";

export {
    AI_PROVIDERS,
    CYCLE_STEPS,
    LEARNING_METHODS,
    MESSAGE_ROLES,
    METHOD_COLORS,
    SESSION_STATUSES,
    SUPPORTED_LANGUAGES,
    cycleStepForIndex,
    isLearningMethod,
    type AIProvider,
    type CycleStep,
    type LearningMethod,
    type MessageRole,
    type SessionStatus,
    type SupportedLanguage,
} from "../lib/constants";
