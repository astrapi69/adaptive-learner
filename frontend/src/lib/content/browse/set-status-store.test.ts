/**
 * Mode-agnostic lifecycle-status persistence for content sets
 * (recurring status-reset bug: a set deferred in "Meine Inhalte" reverted
 * to "active" after leaving and re-entering the page).
 *
 * Root cause the prior #1300/#1351 fix left open: set status was persisted
 * ONLY on the Dexie content-cache row, so API mode
 * (``ApiStorage.setSetStatus`` was a documented no-op) never stored it and
 * every reload read the "active" default. This store mirrors
 * ``dismissed-sets`` (#1709): one localStorage-backed source of truth that
 * works IDENTICALLY in both storage modes, overlaid on the read path.
 *
 * These tests run against REAL ``localStorage`` (happy-dom) — no storage
 * mock — and model the "reload" (leave + return to the page) as a fresh
 * entry array each time, exactly what ``loadSets`` produces on remount.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  applyStoredStatuses,
  getSetStatus,
  readSetStatuses,
  storeSetStatus,
  storeSetStatuses,
} from "./set-status-store";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";

const KEY = "adaptive-learner.set-status";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "owner/repo",
    branch: "main",
    id: "psych",
    title: "Psychologie",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
    version: "1.0.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    downloaded_at: null,
    status: "active",
    book: null,
    ...over,
  } as ContentSetEntry;
}

beforeEach(() => {
  localStorage.clear();
});

describe("set-status-store — persistence", () => {
  it("defaults to no stored status (read as active by the overlay)", () => {
    expect(getSetStatus("owner/repo", "psych")).toBeNull();
    expect(readSetStatuses()).toEqual({});
  });

  it("persists a single transition", () => {
    storeSetStatus("owner/repo", "psych", "deferred");
    expect(getSetStatus("owner/repo", "psych")).toBe("deferred");
    expect(readSetStatuses()).toEqual({ "owner/repo::psych": "deferred" });
  });

  it("persists a bulk transition in one write", () => {
    storeSetStatuses(
      [
        { source: "owner/repo", setId: "a" },
        { source: "owner/repo", setId: "b" },
      ],
      "completed",
    );
    expect(getSetStatus("owner/repo", "a")).toBe("completed");
    expect(getSetStatus("owner/repo", "b")).toBe("completed");
  });

  it("records an explicit re-activation (so it wins over a stale Dexie row)", () => {
    storeSetStatus("owner/repo", "psych", "deferred");
    storeSetStatus("owner/repo", "psych", "active");
    expect(getSetStatus("owner/repo", "psych")).toBe("active");
  });
});

describe("set-status-store — the reproduction (overlay on reload)", () => {
  it("carries the stored status onto an entry that reloads as active (API-mode / reset row)", () => {
    // The user defers the set.
    storeSetStatus("owner/repo", "psych", "deferred");

    // Reload: the storage layer returns the set with the DEFAULT status
    // (API mode has no status column; a fresh Dexie row reads active). This
    // is the exact byte the bug produced.
    const reloaded = [entry({ status: "active" })];
    const overlaid = applyStoredStatuses(reloaded);

    expect(overlaid[0].status).toBe("deferred");
  });

  it("keeps the entry's own status when nothing is stored (existing Dexie deferral survives the upgrade)", () => {
    const reloaded = [entry({ status: "deferred" })];
    const overlaid = applyStoredStatuses(reloaded);
    expect(overlaid[0].status).toBe("deferred");
  });

  it("an explicit stored value overrides the entry's own status (re-activate a stale row)", () => {
    storeSetStatus("owner/repo", "psych", "active");
    const reloaded = [entry({ status: "deferred" })];
    const overlaid = applyStoredStatuses(reloaded);
    expect(overlaid[0].status).toBe("active");
  });

  it("survives repeated reloads (each a fresh array, as remount produces)", () => {
    storeSetStatus("owner/repo", "psych", "completed");
    for (let i = 0; i < 3; i++) {
      const overlaid = applyStoredStatuses([entry({ status: "active" })]);
      expect(overlaid[0].status).toBe("completed");
    }
  });

  it("preserves the array reference when no status differs (referential stability for [sets]-keyed effects)", () => {
    const reloaded = [entry({ status: "active" })];
    expect(applyStoredStatuses(reloaded)).toBe(reloaded);
  });

  it("scopes status by source (same set id from two repos is independent)", () => {
    storeSetStatus("owner/repo", "psych", "deferred");
    const overlaid = applyStoredStatuses([
      entry({ source: "owner/repo", id: "psych", status: "active" }),
      entry({ source: "other/repo", id: "psych", status: "active" }),
    ]);
    expect(overlaid[0].status).toBe("deferred");
    expect(overlaid[1].status).toBe("active");
  });
});

describe("set-status-store — corruption tolerance", () => {
  it("returns an empty map on corrupt storage", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readSetStatuses()).toEqual({});
  });

  it("drops non-status values on read", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ "owner/repo::psych": "bogus", "owner/repo::ok": "deferred" }),
    );
    const map = readSetStatuses();
    expect(map).toEqual({ "owner/repo::ok": "deferred" });
  });
});

// Type-only guard: the exported SetStatus union stays in sync.
const _statuses: SetStatus[] = ["active", "deferred", "completed"];
void _statuses;
