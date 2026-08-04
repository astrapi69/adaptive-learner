/** Tests for the opt-in tap-offset fix-experiment hook (#1569). */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useViewportFixExperiment } from "./useViewportFixExperiment";

describe("useViewportFixExperiment", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    document.documentElement.removeAttribute("data-vvfix");
    document.querySelectorAll("style[data-vvfix]").forEach((s) => s.remove());
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-vvfix");
    document.querySelectorAll("style[data-vvfix]").forEach((s) => s.remove());
  });

  it("does nothing without the flag", () => {
    renderHook(() => useViewportFixExperiment());
    expect(document.documentElement.dataset.vvfix).toBeUndefined();
    expect(document.querySelector("style[data-vvfix]")).toBeNull();
  });

  it("applies a candidate from ?vvfix and injects its CSS", () => {
    window.history.replaceState({}, "", "/?vvfix=novhd");
    renderHook(() => useViewportFixExperiment());
    expect(document.documentElement.dataset.vvfix).toBe("novhd");
    const style = document.querySelector('style[data-vvfix="novhd"]');
    expect(style?.textContent).toContain("height: 100vh");
    expect(localStorage.getItem("adaptive-learner.vv_fix")).toBe("novhd");
  });

  it("ignores an unknown candidate", () => {
    window.history.replaceState({}, "", "/?vvfix=bogus");
    renderHook(() => useViewportFixExperiment());
    expect(document.documentElement.dataset.vvfix).toBeUndefined();
  });

  it("?vvfix=off clears a persisted candidate", () => {
    localStorage.setItem("adaptive-learner.vv_fix", "nolock");
    window.history.replaceState({}, "", "/?vvfix=off");
    renderHook(() => useViewportFixExperiment());
    expect(document.documentElement.dataset.vvfix).toBeUndefined();
    expect(localStorage.getItem("adaptive-learner.vv_fix")).toBeNull();
  });

  it("cleans up the injected style + attribute on unmount", () => {
    localStorage.setItem("adaptive-learner.vv_fix", "nolock");
    const { unmount } = renderHook(() => useViewportFixExperiment());
    expect(document.querySelector('style[data-vvfix="nolock"]')).not.toBeNull();
    unmount();
    expect(document.querySelector('style[data-vvfix="nolock"]')).toBeNull();
    expect(document.documentElement.dataset.vvfix).toBeUndefined();
  });

  // Pin each candidate's exact effect, so whichever one wins on-device is
  // regression-covered before it becomes the permanent default.
  it("novhd swaps the shell height to 100vh", () => {
    window.history.replaceState({}, "", "/?vvfix=novhd");
    renderHook(() => useViewportFixExperiment());
    const css = document.querySelector('style[data-vvfix="novhd"]')?.textContent ?? "";
    expect(css).toContain("height: 100vh");
    expect(css).not.toContain("100dvh");
  });

  it("nolock drops the overflow lock and lets the document scroll", () => {
    window.history.replaceState({}, "", "/?vvfix=nolock");
    renderHook(() => useViewportFixExperiment());
    const css = document.querySelector('style[data-vvfix="nolock"]')?.textContent ?? "";
    expect(css).toContain("overflow: auto");
    expect(css).toContain("height: auto");
  });

  it("vpheight scopes its height override to the keyboard-open state", () => {
    window.history.replaceState({}, "", "/?vvfix=vpheight");
    renderHook(() => useViewportFixExperiment());
    const css = document.querySelector('style[data-vvfix="vpheight"]')?.textContent ?? "";
    // The override applies only under [data-vvkbd="open"] and uses the vv-height var.
    expect(css).toContain('data-vvkbd="open"');
    expect(css).toContain("var(--vv-height)");
  });

  it("hardreset injects no CSS (it is a pure scroll-reset candidate)", () => {
    window.history.replaceState({}, "", "/?vvfix=hardreset");
    renderHook(() => useViewportFixExperiment());
    const style = document.querySelector('style[data-vvfix="hardreset"]');
    expect(style).not.toBeNull();
    expect(style?.textContent).toBe("");
  });
});
