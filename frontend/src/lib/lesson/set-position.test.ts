/** Tests for the in-set lesson position helper (#2793). */

import {describe, expect, it} from "vitest";

import {lessonAtOffset, resolveSetPosition} from "./set-position";

const LESSONS = ["01.json", "02.json", "03.json", "04.json", "05.json"];

describe("resolveSetPosition", () => {
  it.each([
    ["first", "01.json", 1, null, "02.json"],
    ["middle", "03.json", 3, "02.json", "04.json"],
    ["last", "05.json", 5, "04.json", null],
  ])(
    "reports index, total and both neighbours on the %s lesson",
    (_label, filename, index, previous, next) => {
      const pos = resolveSetPosition(LESSONS, filename as string);
      expect(pos).toEqual({index, total: 5, previous, next});
    },
  );

  it("a single-lesson set has no neighbours but a valid position", () => {
    expect(resolveSetPosition(["only.json"], "only.json")).toEqual({
      index: 1,
      total: 1,
      previous: null,
      next: null,
    });
  });

  it.each([
    ["an unknown filename", LESSONS, "missing.json"],
    ["an empty list (not loaded yet)", [], "01.json"],
  ])("returns null for %s", (_label, lessons, filename) => {
    expect(
      resolveSetPosition(lessons as string[], filename as string),
    ).toBeNull();
  });
});

describe("lessonAtOffset", () => {
  it.each([
    ["three back from the last", "05.json", -3, "02.json"],
    ["one back", "03.json", -1, "02.json"],
    ["one forward", "03.json", 1, "04.json"],
    ["clamps a too-large jump back to the first", "03.json", -10, "01.json"],
    ["clamps a too-large jump forward to the last", "03.json", 10, "05.json"],
  ])("resolves %s", (_label, filename, steps, expected) => {
    expect(lessonAtOffset(LESSONS, filename as string, steps as number)).toBe(
      expected,
    );
  });

  it.each([
    ["already at the first edge going back", "01.json", -2],
    ["already at the last edge going forward", "05.json", 3],
    ["a zero offset", "03.json", 0],
  ])("returns null when the offset does not move (%s)", (_l, filename, steps) => {
    expect(
      lessonAtOffset(LESSONS, filename as string, steps as number),
    ).toBeNull();
  });

  it("returns null for a lesson that is not in the set", () => {
    expect(lessonAtOffset(LESSONS, "missing.json", -1)).toBeNull();
  });
});
