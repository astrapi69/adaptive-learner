import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INFO_BLINK_MAX_VISITS,
  infoHintKey,
  readInfoHint,
  writeInfoHint,
} from "./infoHintPref";

describe("infoHintPref", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to unseen with zero visits when nothing is stored", () => {
    expect(readInfoHint("content_my")).toEqual({ seen: false, visits: 0 });
  });

  it("round-trips a written state", () => {
    writeInfoHint("content_my", { seen: true, visits: 3 });
    expect(readInfoHint("content_my")).toEqual({ seen: true, visits: 3 });
  });

  it("keeps separate state per id (per tab)", () => {
    writeInfoHint("content_my", { seen: true, visits: 1 });
    writeInfoHint("content_discover", { seen: false, visits: 2 });
    expect(readInfoHint("content_my")).toEqual({ seen: true, visits: 1 });
    expect(readInfoHint("content_discover")).toEqual({ seen: false, visits: 2 });
  });

  it("uses the established adaptive-learner.* localStorage namespace", () => {
    expect(infoHintKey("content_my")).toBe("adaptive-learner.info_hint.content_my");
  });

  it("falls back to the default on corrupt JSON", () => {
    localStorage.setItem(infoHintKey("content_my"), "{not json");
    expect(readInfoHint("content_my")).toEqual({ seen: false, visits: 0 });
  });

  it("exposes a positive blink threshold constant", () => {
    expect(INFO_BLINK_MAX_VISITS).toBeGreaterThan(0);
  });
});
