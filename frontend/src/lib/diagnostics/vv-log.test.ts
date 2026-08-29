/** Tests for the persistent viewport/tap diagnostics log (#2782). */

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  appendVvLogEntry,
  clearVvLog,
  readVvLog,
  vvLogAsText,
  vvLogCount,
  VV_LOG_MAX_ENTRIES,
} from "./vv-log";

const LOG_KEY = "adaptive-learner.vv_diag_log";

function tap(deltaY: number): Parameters<typeof appendVvLogEntry>[0] {
  return {kind: "tap", ts: 1735689600000, fix: "off", deltaY, tag: "button"};
}

describe("vv-log", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("starts empty and appends entries in order (oldest first)", () => {
    expect(readVvLog()).toEqual([]);
    appendVvLogEntry(tap(-1));
    appendVvLogEntry(tap(-42));
    const entries = readVvLog();
    expect(entries).toHaveLength(2);
    expect(entries[0].deltaY).toBe(-1);
    expect(entries[1].deltaY).toBe(-42);
    expect(vvLogCount()).toBe(2);
  });

  it("survives a reload (persisted in localStorage, not memory)", () => {
    appendVvLogEntry(tap(-7));
    // A "reload" is a fresh read from storage — no module state involved.
    expect(JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]")).toHaveLength(1);
    expect(readVvLog()[0].deltaY).toBe(-7);
  });

  it("caps the ring buffer and drops the oldest entries", () => {
    for (let i = 0; i < VV_LOG_MAX_ENTRIES + 10; i += 1) {
      appendVvLogEntry(tap(i));
    }
    const entries = readVvLog();
    expect(entries).toHaveLength(VV_LOG_MAX_ENTRIES);
    expect(entries[0].deltaY).toBe(10); // 0..9 dropped
    expect(entries[entries.length - 1].deltaY).toBe(VV_LOG_MAX_ENTRIES + 9);
  });

  it("clearVvLog removes everything", () => {
    appendVvLogEntry(tap(-3));
    clearVvLog();
    expect(readVvLog()).toEqual([]);
    expect(vvLogCount()).toBe(0);
  });

  it("renders a paste-ready text protocol with header and one line per entry", () => {
    appendVvLogEntry(tap(-21));
    const text = vvLogAsText();
    expect(text).toContain("[vvdiag-log] entries=1");
    expect(text).toContain("tap");
    expect(text).toContain("deltaY=-21");
    expect(text).toContain("2025-01-01T00:00:00.000Z");
  });

  it("fails open on corrupt storage content", () => {
    localStorage.setItem(LOG_KEY, "{not json");
    expect(readVvLog()).toEqual([]);
    appendVvLogEntry(tap(-5)); // must not throw; replaces the corrupt value
    expect(vvLogCount()).toBe(1);
  });
});
