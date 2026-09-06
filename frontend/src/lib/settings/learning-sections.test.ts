import { describe, expect, it } from "vitest";

import {
  LEARNING_SECTIONS,
  LEARNING_SECTION_IDS,
  LEARNING_SECTION_PARAM,
  isLearningSectionId,
  learningSectionAnchorId,
} from "./learning-sections";

describe("learning-sections (#2961)", () => {
  it("lists the five clusters in the #1459 tab order", () => {
    expect(LEARNING_SECTION_IDS).toEqual(["basics", "lessons", "voice", "review", "motivation"]);
    expect(LEARNING_SECTIONS.map((section) => section.id)).toEqual([...LEARNING_SECTION_IDS]);
  });

  it("pairs every section with the cluster i18n key and an English fallback", () => {
    for (const section of LEARNING_SECTIONS) {
      expect(section.labelKey).toBe(`settings.cluster_${section.id}`);
      expect(section.fallback.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["basics", true],
    ["motivation", true],
    ["voice", true],
    ["bogus", false],
    ["", false],
    ["learning-basics", false],
    [null, false],
    [undefined, false],
  ])("isLearningSectionId(%j) -> %s", (value, expected) => {
    expect(isLearningSectionId(value)).toBe(expected);
  });

  it("derives the DOM anchor id the SettingsCluster renders", () => {
    expect(learningSectionAnchorId("review")).toBe("learning-review");
    expect(LEARNING_SECTION_PARAM).toBe("section");
  });
});
