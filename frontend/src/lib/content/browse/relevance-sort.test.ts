import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
import { sortSetsByLanguageRelevance } from "./relevance-sort";

/** Minimal entry: only the fields the sort reads plus an id to track order. */
function entry(id: string, sourceLanguage: string): ContentSetEntry {
  return { id, source_language: sourceLanguage } as ContentSetEntry;
}

const ids = (sets: ContentSetEntry[]) => sets.map((s) => s.id);

describe("sortSetsByLanguageRelevance", () => {
  it("moves sets matching the user's language to the front (the Hindi-first fix)", () => {
    const catalogue = [
      entry("en-a1-from-hi", "hi"),
      entry("en-a2-from-hi", "hi"),
      entry("fr-a1-from-en", "en"),
      entry("en-a1-from-de", "de"),
      entry("app-tutorial", "de"),
    ];
    expect(ids(sortSetsByLanguageRelevance(catalogue, "de"))).toEqual([
      "en-a1-from-de",
      "app-tutorial",
      "en-a1-from-hi",
      "en-a2-from-hi",
      "fr-a1-from-en",
    ]);
  });

  it("keeps the original order inside both groups (stable partition)", () => {
    const catalogue = [
      entry("b-from-en", "en"),
      entry("a-from-de", "de"),
      entry("a-from-en", "en"),
      entry("b-from-de", "de"),
    ];
    expect(ids(sortSetsByLanguageRelevance(catalogue, "de"))).toEqual([
      "a-from-de",
      "b-from-de",
      "b-from-en",
      "a-from-en",
    ]);
  });

  it("returns the input array unchanged when the order is already right", () => {
    const catalogue = [entry("a-from-de", "de"), entry("b-from-en", "en")];
    expect(sortSetsByLanguageRelevance(catalogue, "de")).toBe(catalogue);
  });

  it("returns the input array when nothing matches the user's language", () => {
    const catalogue = [entry("a-from-de", "de"), entry("b-from-en", "en")];
    expect(sortSetsByLanguageRelevance(catalogue, "tr")).toBe(catalogue);
  });

  it("compares base language codes, so regional variants still match", () => {
    const catalogue = [
      entry("a-from-en", "en"),
      entry("b-from-pt", "pt-BR"),
    ];
    expect(ids(sortSetsByLanguageRelevance(catalogue, "pt"))).toEqual([
      "b-from-pt",
      "a-from-en",
    ]);
    expect(ids(sortSetsByLanguageRelevance(catalogue, "de-DE"))).toEqual([
      "a-from-en",
      "b-from-pt",
    ]);
  });

  it("treats an empty or missing user language as no preference", () => {
    const catalogue = [entry("a-from-hi", "hi"), entry("b-from-de", "de")];
    expect(sortSetsByLanguageRelevance(catalogue, "")).toBe(catalogue);
  });
});
