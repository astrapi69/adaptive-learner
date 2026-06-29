/**
 * Content-view-mode preference (grid ⇄ list, #1240).
 *
 * Pins the persistence contract: default is "grid" (existing tree
 * view — no break for current users), writes round-trip through
 * localStorage, and a write dispatches the change event so the
 * Content page re-reads live.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONTENT_VIEW_MODE_CHANGE_EVENT,
  CONTENT_VIEW_MODE_KEY,
  readContentViewMode,
  writeContentViewMode,
} from "./viewModePref";

afterEach(() => {
  localStorage.clear();
});

describe("content view-mode preference", () => {
  it("defaults to grid when nothing is stored", () => {
    expect(readContentViewMode()).toBe("grid");
  });

  it("round-trips a written value through localStorage", () => {
    writeContentViewMode("list");
    expect(localStorage.getItem(CONTENT_VIEW_MODE_KEY)).toBe("list");
    expect(readContentViewMode()).toBe("list");
    writeContentViewMode("grid");
    expect(readContentViewMode()).toBe("grid");
  });

  it("falls back to grid on an unrecognised stored value", () => {
    localStorage.setItem(CONTENT_VIEW_MODE_KEY, "bogus");
    expect(readContentViewMode()).toBe("grid");
  });

  it("dispatches the change event on write so subscribers re-read", () => {
    const handler = vi.fn();
    window.addEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, handler);
    writeContentViewMode("list");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, handler);
  });
});
