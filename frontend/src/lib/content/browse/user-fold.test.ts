/**
 * Tests for computeUserFold (#541) — the pure EXP-026 fold split
 * extracted from Content.tsx. Pins: a matched user set folds into the
 * tree (leaves "My Lessons"); a no-match set stays; a set whose lessons
 * have not loaded yet (undefined) never folds mid-load; userSetsByKey
 * maps every user set.
 */

import { describe, expect, it } from "vitest";
import type { ContentSetEntry } from "../../../storage/types";
import type { UserFoldInput } from "./content-tree";
import { computeUserFold } from "./user-fold";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "",
    id: "u1",
    title: "My deck",
    title_native: null,
    language: "es",
    target_language: "es",
    source_language: "de",
    level: "A1",
    domain: "analysis",
    version: "1.0.0",
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  };
}

const PUBLISHED: ContentSetEntry = entry({
  source: "astrapi69/adaptive-learner-content",
  id: "es-a1",
  domain: "language",
  source_language: "de",
  target_language: "es",
  level: "A1",
});

const lessons: UserFoldInput["lessons"] = [
  { id: "01", filename: "01.json", title: "Lesson 1", variation_of: undefined },
];

describe("computeUserFold", () => {
  it("folds a user set that matches a published node (leaves My Lessons)", () => {
    const userSet = entry({ id: "u-match", source_language: "de", target_language: "es", level: "A1" });
    const { matchedFold, unmatchedUserSets } = computeUserFold(
      [userSet],
      [PUBLISHED],
      { [`${userSet.source}#${userSet.id}`]: lessons },
    );
    expect(matchedFold).toHaveLength(1);
    expect(matchedFold[0].set.domain).toBe("language");
    expect(unmatchedUserSets).toHaveLength(0);
  });

  it("keeps a user set with no matching published node in My Lessons", () => {
    const userSet = entry({ id: "u-nomatch", target_language: "fr", level: "B2" });
    const { matchedFold, unmatchedUserSets } = computeUserFold(
      [userSet],
      [PUBLISHED],
      { [`${userSet.source}#${userSet.id}`]: lessons },
    );
    expect(matchedFold).toHaveLength(0);
    expect(unmatchedUserSets).toEqual([userSet]);
  });

  it("never folds a set whose lessons have not loaded yet (undefined)", () => {
    const userSet = entry({ id: "u-loading", target_language: "es", level: "A1" });
    const { matchedFold, unmatchedUserSets } = computeUserFold(
      [userSet],
      [PUBLISHED],
      {}, // lessons not loaded -> stays put, no mid-load flicker
    );
    expect(matchedFold).toHaveLength(0);
    expect(unmatchedUserSets).toEqual([userSet]);
  });

  it("maps every user set in userSetsByKey", () => {
    const a = entry({ id: "a" });
    const b = entry({ id: "b" });
    const { userSetsByKey } = computeUserFold([a, b], [], {});
    expect(Object.keys(userSetsByKey)).toEqual([
      "user-generated#a",
      "user-generated#b",
    ]);
  });
});
