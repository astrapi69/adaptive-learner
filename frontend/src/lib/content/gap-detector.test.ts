/**
 * Tests for the content gap detector (Phase 64E).
 */

import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../storage/types";
import { detectGaps } from "./gap-detector";

function set(
  source_language: string,
  target_language: string,
  level: string,
  over: Partial<ContentSetEntry> = {},
): ContentSetEntry {
  return {
    source: "github",
    branch: "main",
    id: `${target_language}-${level}-from-${source_language}`,
    title: `${target_language} ${level}`,
    title_native: null,
    language: target_language,
    target_language,
    source_language,
    level,
    domain: "language",
    version: "1.0.0",
    lesson_count: 10,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  };
}

describe("detectGaps — next_level", () => {
  it("suggests A2 when a pair has only A1", () => {
    const gaps = detectGaps([set("de", "fr", "A1")]);
    expect(gaps).toContainEqual({
      kind: "next_level",
      source: "de",
      target: "fr",
      level: "A2",
    });
  });

  it("suggests B1 when a pair has A1 + A2", () => {
    const gaps = detectGaps([set("de", "fr", "A1"), set("de", "fr", "A2")]);
    const next = gaps.find((g) => g.kind === "next_level");
    expect(next?.level).toBe("B1");
  });

  it("suggests no next level at the top of the ladder", () => {
    const gaps = detectGaps([set("de", "fr", "C2")]);
    expect(gaps.some((g) => g.kind === "next_level")).toBe(false);
  });
});

describe("detectGaps — missing_pair", () => {
  it("suggests a target taught for one source but missing for another active source", () => {
    // EN has FR + ES at A1; DE has only FR A1 -> DE is missing ES.
    const gaps = detectGaps([
      set("en", "fr", "A1"),
      set("en", "es", "A1"),
      set("de", "fr", "A1"),
    ]);
    expect(gaps).toContainEqual({
      kind: "missing_pair",
      source: "de",
      target: "es",
      level: "A1",
    });
  });

  it("emits no missing_pair when every source covers every target", () => {
    const gaps = detectGaps([
      set("en", "fr", "A1"),
      set("de", "fr", "A1"),
    ]);
    expect(gaps.some((g) => g.kind === "missing_pair")).toBe(false);
  });
});

describe("detectGaps — hygiene", () => {
  it("ignores user-generated drafts", () => {
    const gaps = detectGaps([
      set("de", "it", "A1", { source: "user-generated" }),
    ]);
    expect(gaps).toEqual([]);
  });

  it("de-duplicates and orders next_level before missing_pair", () => {
    const gaps = detectGaps([
      set("en", "fr", "A1"),
      set("en", "es", "A1"),
      set("de", "fr", "A1"),
    ]);
    const kinds = gaps.map((g) => g.kind);
    // every next_level index is before every missing_pair index
    const lastNext = kinds.lastIndexOf("next_level");
    const firstMissing = kinds.indexOf("missing_pair");
    if (lastNext >= 0 && firstMissing >= 0) {
      expect(lastNext).toBeLessThan(firstMissing);
    }
    // no duplicate entries
    const keys = gaps.map((g) => `${g.kind}:${g.source}:${g.target}:${g.level}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
