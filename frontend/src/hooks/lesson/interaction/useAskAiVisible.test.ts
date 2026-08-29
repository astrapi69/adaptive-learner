/**
 * Tests for useAskAiVisible (#2693).
 *
 * Pins:
 *  - Default ON when no preference stored.
 *  - Reads a stored OFF preference.
 *  - Re-renders when ``setAskAiVisible`` changes the preference within
 *    the same tab.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { setAskAiVisible } from "../../../lib/lesson/prefs/askAiVisibilityPref";
import { useAskAiVisible } from "./useAskAiVisible";

beforeEach(() => {
  localStorage.clear();
});

describe("useAskAiVisible", () => {
  it("defaults to ON when localStorage is empty", () => {
    const { result } = renderHook(() => useAskAiVisible());
    expect(result.current).toBe(true);
  });

  it("returns false when the user opted out", () => {
    localStorage.setItem("adaptive-learner.lesson.ask_ai_visible", "false");
    const { result } = renderHook(() => useAskAiVisible());
    expect(result.current).toBe(false);
  });

  it("re-renders subscribers when setAskAiVisible is called", () => {
    const { result } = renderHook(() => useAskAiVisible());
    expect(result.current).toBe(true);
    act(() => {
      setAskAiVisible(false);
    });
    expect(result.current).toBe(false);
    act(() => {
      setAskAiVisible(true);
    });
    expect(result.current).toBe(true);
  });
});
