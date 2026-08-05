import { describe, expect, it, beforeEach } from "vitest";

import {
  _resetLanguageNameCache,
  languageDisplayName,
  languageFlag,
  flaggedName,
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

/** The regional-indicator flag for a region code, for asserting values without
 *  hard-coding the surrogate pairs in the test. */
function flagOf(region: string): string {
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (region.charCodeAt(0) - base),
    A + (region.charCodeAt(1) - base),
  );
}

describe("languageFlag", () => {
  it("maps a known language to its regional-indicator flag emoji", () => {
    expect(languageFlag("de")).toBe(flagOf("DE"));
    expect(languageFlag("es")).toBe(flagOf("ES"));
    expect(languageFlag("ja")).toBe(flagOf("JP"));
    expect(languageFlag("en")).toBe(flagOf("GB"));
    expect(languageFlag("zh")).toBe(flagOf("CN"));
  });

  it("strips the region subtag before lookup", () => {
    expect(languageFlag("pt-BR")).toBe(flagOf("PT"));
  });

  it("returns an empty string for an unmapped or empty code", () => {
    expect(languageFlag("zz")).toBe("");
    expect(languageFlag("")).toBe("");
  });
});

describe("flaggedName", () => {
  it("prefixes the localised name with the flag when one exists", () => {
    expect(flaggedName("fr", "de")).toBe(`${flagOf("FR")} Französisch`);
  });

  it("returns the bare name (no leading space) when no flag is known", () => {
    expect(flaggedName("zz", "en")).toBe("ZZ");
  });
});
