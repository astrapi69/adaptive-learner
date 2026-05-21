/**
 * Re-export barrel for the E2E helper module.
 *
 * Specs import from ``../helpers`` rather than reaching into
 * individual files; that lets us split / merge helpers
 * later without churning every spec's import block.
 */

export {
    completeAssessment,
    completeOnboarding,
    createTestUser,
} from "./onboarding";

export {
    endSessionWithDefaultRating,
    sendChatMessage,
    startSession,
    startSessionWithMethod,
} from "./session";

export {
    mockAvailableModels,
    mockConversationAnalysis,
    mockSessionMessage,
    mockSessionMessageStream,
} from "./mock-ai";

export type {LearningMethod} from "./types";
export type {OnboardingArgs} from "./onboarding";
export type {
    MockAvailableModelsOptions,
    MockConversationAnalysisOptions,
    MockMessageOptions,
    MockStreamOptions,
} from "./mock-ai";
