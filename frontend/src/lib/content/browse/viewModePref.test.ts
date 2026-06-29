/**
 * Content-view-mode preference (grid ⇄ list, #1240 + #1257).
 *
 * Pins the persistence contract: default is "list" (#1257 — deliberate
 * reversal of the #1240 grid default), an explicitly-stored "grid" is
 * preserved (existing-user migration keeps their choice), writes
 * round-trip through localStorage, and a write dispatches the change
 * event so consumers re-read live.
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
  it("defaults to list when nothing is stored (#1257)", () => {
    expect(readContentViewMode()).toBe("list");
  });

  it("preserves an explicitly stored grid choice (existing-user migration)", () => {
    localStorage.setItem(CONTENT_VIEW_MODE_KEY, "grid");
    expect(readContentViewMode()).toBe("grid");
  });

  it("round-trips a written value through localStorage", () => {
    writeContentViewMode("list");
    expect(localStorage.getItem(CONTENT_VIEW_MODE_KEY)).toBe("list");
    expect(readContentViewMode()).toBe("list");
    writeContentViewMode("grid");
    expect(readContentViewMode()).toBe("grid");
  });

  it("falls back to list on an unrecognised stored value (#1257)", () => {
    localStorage.setItem(CONTENT_VIEW_MODE_KEY, "bogus");
    expect(readContentViewMode()).toBe("list");
  });

  it("dispatches the change event on write so subscribers re-read", () => {
    const handler = vi.fn();
    window.addEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, handler);
    writeContentViewMode("list");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, handler);
  });
});
