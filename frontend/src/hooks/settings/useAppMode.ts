/**
 * App-mode detection (Phase 43 / EXP-005 / P-113).
 *
 * "Mode" is a derived property of the runtime, not a stored
 * preference: it depends on whether an AI provider key is
 * configured. With a key → AI-augmented (existing AI features +
 * AI distractors); without → content-only (pre-built lessons
 * only, no AI calls).
 *
 * The hook is a thin interpretation layer over the existing
 * ``useApiKeyStatus`` hook (Issue 4 / v1.23.1). No new storage,
 * no new fetch — just a friendlier name for "what can this
 * user do right now?".
 *
 * Nav badge (F-104) consumes ``mode`` to render
 * "AI+Content" / "Content".
 */

import {useApiKeyStatus} from "./useApiKeyStatus";

export type AppMode = "content-only" | "ai-augmented";

export interface AppModeState {
    /** Resolved once the underlying API-key status has loaded. */
    ready: boolean;
    /** The active mode at this moment. */
    mode: AppMode;
}

export function useAppMode(): AppModeState {
    const {ready, hasKey} = useApiKeyStatus();
    return {
        ready,
        mode: hasKey ? "ai-augmented" : "content-only",
    };
}
