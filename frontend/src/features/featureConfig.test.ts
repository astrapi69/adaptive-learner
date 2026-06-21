/**
 * Pins the maintainer-confirmed feature table: every feature resolves to the
 * expected state across the three runtime contexts (API mode, Dexie without a
 * key, Dexie with a key).
 */

import { describe, expect, it } from "vitest";

import {
  FEATURES,
  REASON_API_KEY_REQUIRED,
  REASON_DESKTOP_ONLY,
  type FeatureContext,
  featureRegistry,
} from "./featureConfig";

const API: FeatureContext = { mode: "api", hasAiKey: false };
const DEXIE_NO_KEY: FeatureContext = { mode: "dexie", hasAiKey: false };
const DEXIE_KEY: FeatureContext = { mode: "dexie", hasAiKey: true };

const ALWAYS_ACTIVE = [
  FEATURES.LESSON_PLAY,
  FEATURES.CONTENT_BROWSER,
  FEATURES.BACKUP_EXPORT,
  FEATURES.SELECTIVE_EXPORT,
  FEATURES.REVIEW_SESSION,
  FEATURES.THEMES,
  FEATURES.NOTEBOOKLM_DOWNLOAD,
];

const NEEDS_KEY = [
  FEATURES.CONVERSATION_ANALYZE,
  FEATURES.ANKI_EXTRACT,
  FEATURES.SESSION_START,
  FEATURES.SESSION_RESUME,
  FEATURES.LEARNING_QUESTIONS,
  FEATURES.LEARNING_GUIDE,
  FEATURES.AI_LESSON_GENERATE,
  FEATURES.PRONUNCIATION_GENERATE,
];

const DESKTOP_ONLY = [FEATURES.SYNC, FEATURES.GIT_PERSIST, FEATURES.LEARNING_REPO_GIT];

describe("featureRegistry", () => {
  it("keeps always-active features active in every context", () => {
    for (const id of ALWAYS_ACTIVE) {
      expect(featureRegistry.getState(id, API)).toBe("active");
      expect(featureRegistry.getState(id, DEXIE_NO_KEY)).toBe("active");
      expect(featureRegistry.getState(id, DEXIE_KEY)).toBe("active");
    }
  });

  it("disables AI features in Dexie mode only when no key is present", () => {
    for (const id of NEEDS_KEY) {
      expect(featureRegistry.getState(id, API)).toBe("active");
      expect(featureRegistry.getState(id, DEXIE_KEY)).toBe("active");
      expect(featureRegistry.getState(id, DEXIE_NO_KEY)).toBe("disabled");
      expect(featureRegistry.getReason(id, DEXIE_NO_KEY)).toBe(REASON_API_KEY_REQUIRED);
    }
  });

  it("disables desktop-only features in Dexie mode (never hidden), active in API mode", () => {
    for (const id of DESKTOP_ONLY) {
      expect(featureRegistry.getState(id, API)).toBe("active");
      expect(featureRegistry.getState(id, DEXIE_NO_KEY)).toBe("disabled");
      expect(featureRegistry.getState(id, DEXIE_KEY)).toBe("disabled");
      expect(featureRegistry.getReason(id, DEXIE_NO_KEY)).toBe(REASON_DESKTOP_ONLY);
      expect(featureRegistry.getReason(id, DEXIE_KEY)).toBe(REASON_DESKTOP_ONLY);
    }
  });

  it("keeps default-disabled features disabled in every context (#900, #931)", () => {
    const defaultDisabled = [
      FEATURES.LEARNING_PATH_GRAPH,
      FEATURES.ADVANCED_DASHBOARD,
    ];
    for (const id of defaultDisabled) {
      for (const ctx of [API, DEXIE_NO_KEY, DEXIE_KEY]) {
        expect(featureRegistry.getState(id, ctx)).toBe("disabled");
      }
    }
  });

  it("registers every catalog id", () => {
    for (const id of Object.values(FEATURES)) {
      expect(featureRegistry.has(id)).toBe(true);
    }
  });

  it("fails closed: an unknown feature id resolves to hidden", () => {
    expect(featureRegistry.has("does-not-exist")).toBe(false);
    expect(featureRegistry.getState("does-not-exist", DEXIE_NO_KEY)).toBe("hidden");
    expect(featureRegistry.getState("does-not-exist", API)).toBe("hidden");
  });
});
