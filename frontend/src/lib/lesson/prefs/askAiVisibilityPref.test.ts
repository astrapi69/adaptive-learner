/**
 * Tests for the Ask-AI visibility preference (#2693).
 *
 * Pins:
 *  - Default ON when no preference stored.
 *  - Reads a stored "false" / "true" correctly.
 *  - An invalid/corrupted stored value falls back to the default.
 *  - ``setAskAiVisible`` persists + dispatches the change event.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASK_AI_VISIBILITY_CHANGE_EVENT,
  DEFAULT_ASK_AI_VISIBLE,
  readAskAiVisible,
  setAskAiVisible,
} from "./askAiVisibilityPref";

const KEY = "adaptive-learner.lesson.ask_ai_visible";

beforeEach(() => {
  localStorage.clear();
});

describe("readAskAiVisible", () => {
  it("defaults to ON when unset", () => {
    expect(readAskAiVisible()).toBe(true);
    expect(DEFAULT_ASK_AI_VISIBLE).toBe(true);
  });

  it("reads a stored false", () => {
    localStorage.setItem(KEY, "false");
    expect(readAskAiVisible()).toBe(false);
  });

  it("reads a stored true", () => {
    localStorage.setItem(KEY, "true");
    expect(readAskAiVisible()).toBe(true);
  });

  it("falls back to the default on an invalid stored value", () => {
    localStorage.setItem(KEY, "maybe");
    expect(readAskAiVisible()).toBe(DEFAULT_ASK_AI_VISIBLE);
  });
});

describe("setAskAiVisible", () => {
  it("persists the preference to localStorage", () => {
    setAskAiVisible(false);
    expect(localStorage.getItem(KEY)).toBe("false");
    setAskAiVisible(true);
    expect(localStorage.getItem(KEY)).toBe("true");
  });

  it("dispatches the change event so subscribers can re-read live", () => {
    const handler = vi.fn();
    window.addEventListener(ASK_AI_VISIBILITY_CHANGE_EVENT, handler);
    setAskAiVisible(false);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(ASK_AI_VISIBILITY_CHANGE_EVENT, handler);
  });
});
