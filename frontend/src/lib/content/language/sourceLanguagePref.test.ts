import { afterEach, describe, expect, it } from "vitest";

import {
  readAdditionalSourceLanguages,
  SOURCE_LANGUAGES_KEY,
  writeAdditionalSourceLanguages,
} from "./sourceLanguagePref";

afterEach(() => {
  localStorage.clear();
});

describe("sourceLanguagePref", () => {
  it("returns [] when nothing is stored", () => {
    expect(readAdditionalSourceLanguages()).toEqual([]);
  });

  it("round-trips a list", () => {
    writeAdditionalSourceLanguages(["en", "es"]);
    expect(readAdditionalSourceLanguages()).toEqual(["en", "es"]);
  });

  it("normalises to base subtags and dedupes on write", () => {
    writeAdditionalSourceLanguages(["en-US", "EN", "fr"]);
    expect(readAdditionalSourceLanguages()).toEqual(["en", "fr"]);
  });

  it("ignores malformed stored JSON", () => {
    localStorage.setItem(SOURCE_LANGUAGES_KEY, "{not json");
    expect(readAdditionalSourceLanguages()).toEqual([]);
  });

  it("filters out non-string / too-short entries on read", () => {
    localStorage.setItem(
      SOURCE_LANGUAGES_KEY,
      JSON.stringify(["en", 5, "x", "de"]),
    );
    expect(readAdditionalSourceLanguages()).toEqual(["en", "de"]);
  });
});
