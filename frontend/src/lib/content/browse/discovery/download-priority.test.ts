/**
 * Tests for the shared "downloaded content first" ordering (#909): downloaded +
 * started, then downloaded + not started, then not downloaded — each tier by
 * most-recent activity, title as the deterministic tiebreaker.
 */

import { describe, expect, it } from "vitest";

import {
  compareByDownloadPriority,
  downloadPriorityRank,
  type DownloadPriorityItem,
} from "./download-priority";

const started = (title: string, lastActivity: string): DownloadPriorityItem => ({
  downloaded: true,
  lastActivity,
  title,
});
const untouched = (title: string): DownloadPriorityItem => ({
  downloaded: true,
  lastActivity: null,
  title,
});
const untouchedAt = (
  title: string,
  downloadedAt: string | null,
): DownloadPriorityItem => ({
  downloaded: true,
  lastActivity: null,
  downloadedAt,
  title,
});
const notDownloaded = (title: string): DownloadPriorityItem => ({
  downloaded: false,
  lastActivity: null,
  title,
});

describe("downloadPriorityRank", () => {
  it("ranks downloaded+started 0, downloaded+not-started 1, not-downloaded 2", () => {
    expect(downloadPriorityRank(started("a", "2026-06-01T00:00:00Z"))).toBe(0);
    expect(downloadPriorityRank(untouched("a"))).toBe(1);
    expect(downloadPriorityRank(notDownloaded("a"))).toBe(2);
  });

  it("treats a not-downloaded set as tier 2 even if it somehow has activity", () => {
    expect(
      downloadPriorityRank({
        downloaded: false,
        lastActivity: "2026-06-01T00:00:00Z",
        title: "x",
      }),
    ).toBe(2);
  });
});

describe("compareByDownloadPriority", () => {
  it("orders the three tiers correctly", () => {
    const items = [
      notDownloaded("Z not downloaded"),
      untouched("B untouched"),
      started("A started", "2026-06-01T00:00:00Z"),
    ];
    const titles = [...items].sort(compareByDownloadPriority).map((i) => i.title);
    expect(titles).toEqual([
      "A started",
      "B untouched",
      "Z not downloaded",
    ]);
  });

  it("sorts started sets by most-recent activity first", () => {
    const items = [
      started("older", "2026-06-01T00:00:00Z"),
      started("newer", "2026-06-10T00:00:00Z"),
    ];
    expect([...items].sort(compareByDownloadPriority).map((i) => i.title)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("keeps a started set ahead of an untouched one regardless of title", () => {
    const items = [untouched("AAA"), started("ZZZ", "2026-06-01T00:00:00Z")];
    expect([...items].sort(compareByDownloadPriority).map((i) => i.title)).toEqual([
      "ZZZ",
      "AAA",
    ]);
  });

  it("falls back to a title sort within the untouched tier", () => {
    const items = [untouched("Beta"), untouched("Alpha")];
    expect([...items].sort(compareByDownloadPriority).map((i) => i.title)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("breaks an equal-timestamp tie by title (deterministic)", () => {
    const ts = "2026-06-05T00:00:00Z";
    const items = [started("Beta", ts), started("Alpha", ts)];
    expect([...items].sort(compareByDownloadPriority).map((i) => i.title)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  // #1211 — within the untouched-downloaded tier, the most recently
  // downloaded set comes first (download date descending), title only
  // as a deterministic tiebreaker.
  it("orders untouched downloaded sets by most-recent download first", () => {
    const items = [
      untouchedAt("Older download", "2026-06-01T00:00:00Z"),
      untouchedAt("Newer download", "2026-06-10T00:00:00Z"),
    ];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["Newer download", "Older download"]);
  });

  it("puts a freshly downloaded untouched set above older untouched ones, ignoring title", () => {
    const items = [
      untouchedAt("AAA old", "2026-06-01T00:00:00Z"),
      untouchedAt("ZZZ fresh", "2026-06-20T00:00:00Z"),
    ];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["ZZZ fresh", "AAA old"]);
  });

  it("sorts untouched sets without a download timestamp after timestamped ones, then by title", () => {
    const items = [
      untouchedAt("No ts B", null),
      untouchedAt("Has ts", "2026-06-01T00:00:00Z"),
      untouchedAt("No ts A", null),
    ];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["Has ts", "No ts A", "No ts B"]);
  });

  it("breaks an equal download-timestamp tie by title (deterministic, no flicker)", () => {
    const ts = "2026-06-05T00:00:00Z";
    const items = [untouchedAt("Beta", ts), untouchedAt("Alpha", ts)];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["Alpha", "Beta"]);
  });

  it("keeps a started set ahead of a freshly downloaded untouched one", () => {
    const items = [
      untouchedAt("Fresh untouched", "2026-06-20T00:00:00Z"),
      started("Started older", "2026-06-01T00:00:00Z"),
    ];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["Started older", "Fresh untouched"]);
  });

  it("uses download recency as a secondary tiebreaker within the started tier", () => {
    const act = "2026-06-05T00:00:00Z";
    const items: DownloadPriorityItem[] = [
      {downloaded: true, lastActivity: act, downloadedAt: "2026-06-01T00:00:00Z", title: "B older dl"},
      {downloaded: true, lastActivity: act, downloadedAt: "2026-06-04T00:00:00Z", title: "A newer dl"},
    ];
    expect(
      [...items].sort(compareByDownloadPriority).map((i) => i.title),
    ).toEqual(["A newer dl", "B older dl"]);
  });
});
