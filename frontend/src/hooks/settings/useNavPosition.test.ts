/** Tests for the mobile nav-position preference hook (#2786). */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {setNavPosition, useNavPosition} from "./useNavPosition";

const STORAGE_KEY = "adaptive-learner.nav_position";

describe("useNavPosition", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to top (the #1512 decision stays the default)", () => {
    const {result} = renderHook(() => useNavPosition());
    expect(result.current).toBe("top");
  });

  it("an unknown stored value falls back to top", () => {
    localStorage.setItem(STORAGE_KEY, "sideways");
    const {result} = renderHook(() => useNavPosition());
    expect(result.current).toBe("top");
  });

  it("setter flips subscribed consumers immediately (no reload)", () => {
    const {result} = renderHook(() => useNavPosition());
    act(() => setNavPosition("bottom"));
    expect(result.current).toBe("bottom");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("bottom");
    act(() => setNavPosition("top"));
    expect(result.current).toBe("top");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
