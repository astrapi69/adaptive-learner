import { describe, expect, it } from "vitest";

import {
  DATA_SECTIONS,
  DATA_SECTION_IDS,
  DATA_SECTION_PARAM,
  dataSectionAnchorId,
  isDataSectionId,
} from "./data-sections";
import { LEARNING_SECTION_PARAM } from "./learning-sections";

describe("data-sections (#3122)", () => {
  it("lists the six clusters in the #1451 causal order, danger zone last", () => {
    expect(DATA_SECTION_IDS).toEqual(["sources", "sync", "offline", "backup", "cleanup", "danger"]);
    expect(DATA_SECTIONS.map((section) => section.id)).toEqual([...DATA_SECTION_IDS]);
    expect(DATA_SECTION_IDS[DATA_SECTION_IDS.length - 1]).toBe("danger");
  });

  it("pairs every section with the cluster i18n key and an English fallback", () => {
    for (const section of DATA_SECTIONS) {
      expect(section.labelKey).toBe(`settings.cluster_data_${section.id}`);
      expect(section.fallback.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["sources", true],
    ["danger", true],
    ["backup", true],
    ["basics", false],
    ["bogus", false],
    ["", false],
    ["data-backup", false],
    [null, false],
    [undefined, false],
  ])("isDataSectionId(%j) -> %s", (value, expected) => {
    expect(isDataSectionId(value)).toBe(expected);
  });

  it("derives the DOM anchor id the SettingsCluster renders and shares the query param with Learning", () => {
    expect(dataSectionAnchorId("backup")).toBe("data-backup");
    expect(DATA_SECTION_PARAM).toBe("section");
    expect(DATA_SECTION_PARAM).toBe(LEARNING_SECTION_PARAM);
  });
});
