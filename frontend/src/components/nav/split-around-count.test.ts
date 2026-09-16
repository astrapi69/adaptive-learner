import { describe, expect, it } from "vitest";

import { splitAroundCount } from "./split-around-count";

/**
 * #3123 - the phone header shows only the count of a badge; the word
 * around it is split off the catalog template so every word order works.
 */
describe("splitAroundCount (#3123)", () => {
  it.each([
    ["English, word after", "{n} due", "", " due"],
    ["German, word after", "{n} fällig", "", " fällig"],
    ["word before", "Fällig: {n}", "Fällig: ", ""],
    ["word on both sides", "noch {n} offen", "noch ", " offen"],
    ["placeholder only", "{n}", "", ""],
  ])("%s", (_name, template, before, after) => {
    expect(splitAroundCount(template)).toEqual([before, after]);
  });

  it("keeps the whole text as the trailing part when the placeholder is missing", () => {
    expect(splitAroundCount("updates")).toEqual(["", "updates"]);
  });
});
