/**
 * Central feature registry + gating strategy (replaces ad-hoc per-button
 * API-key checks and Dexie-mode section hiding).
 *
 * Design (per the library's descriptor + abstention model):
 *   - Every feature is a descriptor with ``defaultState: "active"``.
 *   - The strategy carries ONLY deviation rules — AI features that need a key
 *     and desktop-only features disabled in Dexie mode. It abstains (returns
 *     ``undefined``) for everything else, so the descriptor default governs.
 *   - There is no always-active set and no active fallback in the strategy:
 *     a feature's gating class is defined in exactly one place (its presence
 *     in {@link NEEDS_AI_KEY} / {@link DESKTOP_ONLY}, or absence from both).
 *
 * State policy (#335): product features are never ``hidden`` — everything
 * the user owns is visible, either active or disabled with a reason the UI
 * localizes. ``hidden`` is reserved for the registry's fail-closed handling
 * of unknown ids (and future dev-only flags), not for deployment gating.
 *
 * The registry is a module constant (stateless config). Only the
 * {@link FeatureContext} changes at runtime, supplied — memoised — by the
 * root ``FeatureProvider``. Conditions are pure, synchronous lookups on that
 * context (no async/DOM/storage), because ``useFeature`` evaluates them lazily
 * per consumer on every render.
 */

import {
  ConditionalFeatureStrategy,
  type FeatureCondition,
  type FeatureDescriptor,
  type FeatureState,
  FeatureRegistry,
} from "@astrapi69/feature-strategy";

import type { StorageMode } from "../storage/types";

/**
 * Evaluation context passed to the strategy through the ``FeatureProvider``.
 */
export interface FeatureContext {
  /** The active storage backing — fixed for the session. */
  mode: StorageMode;
  /** True when the active AI provider has a usable key configured. */
  hasAiKey: boolean;
}

/**
 * Stable identifiers for every gateable feature. All call sites reference
 * this constant; feature ids are never spelled as string literals.
 */
export const FEATURES = {
  LESSON_PLAY: "lesson-play",
  LESSON_EXPORT_MD: "lesson-export-md",
  LESSON_EXPORT_JSON: "lesson-export-json",
  CONTENT_BROWSER: "content-browser",
  CONTENT_REPO_ADD: "content-repo-add",
  CONTENT_REPO_SHARE: "content-repo-share",
  BACKUP_EXPORT: "backup-export",
  BACKUP_IMPORT: "backup-import",
  SELECTIVE_EXPORT: "selective-export",
  FIRST_RUN_RESTORE: "first-run-restore",
  REVIEW_SESSION: "review-session",
  ASSESSMENT: "assessment",
  DASHBOARD: "dashboard",
  LEARNING_PATH: "learning-path",
  PROGRESS: "progress",
  ONBOARDING: "onboarding",
  THEMES: "themes",
  BOOK_RECOMMENDATIONS: "book-recommendations",
  LESSON_CREATE_MANUAL: "lesson-create-manual",
  NOTEBOOKLM_DOWNLOAD: "notebooklm-download",

  CONVERSATION_ANALYZE: "conversation-analyze",
  ANKI_EXTRACT: "anki-extract",
  SESSION_START: "session-start",
  SESSION_RESUME: "session-resume",
  LEARNING_QUESTIONS: "learning-questions",
  LEARNING_GUIDE: "learning-guide",
  AI_LESSON_GENERATE: "ai-lesson-generate",
  PRONUNCIATION_GENERATE: "pronunciation-generate",

  SYNC: "sync",
  GIT_PERSIST: "git-persist",
  LEARNING_REPO_GIT: "learning-repo-git",
} as const;

/** Union of all registered feature ids. */
export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Reason code reported for an AI feature that is disabled for lack of a key.
 * Components localize it via ``feature.${reason}`` (``feature.api_key_required``).
 */
export const REASON_API_KEY_REQUIRED = "api_key_required";

/**
 * Reason code reported for a desktop-only feature that is disabled in Dexie
 * mode. Components localize it via ``feature.${reason}`` (``feature.desktop_only``).
 */
export const REASON_DESKTOP_ONLY = "desktop_only";

/** AI-backed features: disabled in Dexie mode without a configured key. */
const NEEDS_AI_KEY: readonly FeatureId[] = [
  FEATURES.CONVERSATION_ANALYZE,
  FEATURES.ANKI_EXTRACT,
  FEATURES.SESSION_START,
  FEATURES.SESSION_RESUME,
  FEATURES.LEARNING_QUESTIONS,
  FEATURES.LEARNING_GUIDE,
  FEATURES.AI_LESSON_GENERATE,
  FEATURES.PRONUNCIATION_GENERATE,
];

/**
 * Desktop-only features: disabled in Dexie mode (no backend / git binary).
 * Disabled, not hidden, so the UI can tell the user the desktop app exists.
 */
const DESKTOP_ONLY: readonly FeatureId[] = [
  FEATURES.SYNC,
  FEATURES.GIT_PERSIST,
  FEATURES.LEARNING_REPO_GIT,
];

function needsAiKeyRule(): FeatureCondition<FeatureContext> {
  return {
    evaluate: (context): FeatureState | undefined => {
      if (context === undefined) return undefined;
      return context.mode === "api" || context.hasAiKey ? "active" : "disabled";
    },
    reason: REASON_API_KEY_REQUIRED,
  };
}

function desktopOnlyRule(): FeatureCondition<FeatureContext> {
  return {
    evaluate: (context): FeatureState | undefined => {
      if (context === undefined) return undefined;
      return context.mode === "dexie" ? "disabled" : "active";
    },
    reason: REASON_DESKTOP_ONLY,
  };
}

function buildRegistry(): FeatureRegistry<FeatureContext> {
  const descriptors: FeatureDescriptor[] = Object.values(FEATURES).map((id) => ({
    id,
    defaultState: "active",
  }));

  const rules: Record<string, FeatureCondition<FeatureContext>> = Object.fromEntries([
    ...NEEDS_AI_KEY.map((id) => [id, needsAiKeyRule()] as const),
    ...DESKTOP_ONLY.map((id) => [id, desktopOnlyRule()] as const),
  ]);

  return new FeatureRegistry<FeatureContext>()
    .registerAll(descriptors)
    .setStrategy(new ConditionalFeatureStrategy<FeatureContext>(rules));
}

/**
 * The application-wide feature registry, wired into the React tree by the
 * root ``FeatureProvider``.
 */
export const featureRegistry = buildRegistry();
