import { describe, expect, it, beforeEach } from "vitest";

import {
  _resetLanguageNameCache,
  languageDisplayName,
} from "./language-names";

beforeEach(() => {
  _resetLanguageNameCache();
});

describe("languageDisplayName", () => {
  it("localises a language name to the display language", () => {
    // Intl.DisplayNames is available on the Node test runtime.
    expect(languageDisplayName("fr", "de")).toBe("Französisch");
    expect(languageDisplayName("fr", "en")).toBe("French");
    expect(languageDisplayName("es", "en")).toBe("Spanish");
  });

  it("strips the region subtag before lookup", () => {
    expect(languageDisplayName("de-AT", "en")).toBe("German");
  });

  it("falls back to the uppercased code for an unknown language", () => {
    expect(languageDisplayName("zz", "en")).toBe("ZZ");
  });

  it("returns the input unchanged for an empty code", () => {
    expect(languageDisplayName("", "en")).toBe("");
  });
});
