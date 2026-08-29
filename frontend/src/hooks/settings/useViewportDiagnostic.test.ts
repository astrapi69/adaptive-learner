/** Tests for the viewport-diagnostics preference hook (#2782). */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  isViewportDiagnosticEnabled,
  setViewportDiagnosticEnabled,
  setVvPanelVisible,
  useViewportDiagnostic,
  useVvPanelVisible,
} from "./useViewportDiagnostic";

const STORAGE_KEY = "adaptive-learner.vv_diag";

describe("useViewportDiagnostic", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("is off by default", () => {
    expect(isViewportDiagnosticEnabled()).toBe(false);
    const {result} = renderHook(() => useViewportDiagnostic());
    expect(result.current).toBe(false);
  });

  it("reads the same flag the ?vvdiag=1 URL path persists", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    expect(isViewportDiagnosticEnabled()).toBe(true);
    const {result} = renderHook(() => useViewportDiagnostic());
    expect(result.current).toBe(true);
  });

  it("panel visibility defaults to ON and flips live via its setter (#2785)", () => {
    const {result} = renderHook(() => useVvPanelVisible());
    expect(result.current).toBe(true);
    act(() => setVvPanelVisible(false));
    expect(result.current).toBe(false);
    expect(localStorage.getItem("adaptive-learner.vv_diag_panel")).toBe("0");
    act(() => setVvPanelVisible(true));
    expect(result.current).toBe(true);
    expect(localStorage.getItem("adaptive-learner.vv_diag_panel")).toBeNull();
  });

  it("setter flips subscribed consumers immediately (no reload)", () => {
    const {result} = renderHook(() => useViewportDiagnostic());
    expect(result.current).toBe(false);
    act(() => setViewportDiagnosticEnabled(true));
    expect(result.current).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    act(() => setViewportDiagnosticEnabled(false));
    expect(result.current).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
