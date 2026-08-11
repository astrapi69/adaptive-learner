/**
 * Tests for the #2562 client-side manifest fallback: deriving Discover
 * SearchableSets directly from a connected user repo's ``manifest.yaml``
 * when it has no ``search-index.json``.
 */

import { describe, expect, it } from "vitest";

import { deriveSearchableSet, deriveSearchIndexFromManifest } from "./manifest-search-index";
import type { ParsedSet } from "../../engine";

function set(overrides: Partial<ParsedSet> = {}): ParsedSet {
  return {
    id: "es-a1-from-de",
    title: "Spanisch A1",
    level: "a1",
    version: "1.0",
    lesson_count: 12,
    ...overrides,
  };
}

describe("deriveSearchableSet", () => {
  it("maps a manifest set onto a SearchableSet with the manifest's own fields", () => {
    const result = deriveSearchableSet(
      set({
        description: "Grundlagen Spanisch",
        source_language: "de",
        target_language: "es",
        domain: "language",
        tags: ["artikel", "alltag"],
      }),
      "jane/deck",
      "Jane's Deck",
      1,
    );
    expect(result).toMatchObject({
      id: "es-a1-from-de",
      name: "Spanisch A1",
      description: "Grundlagen Spanisch",
      source_language: "de",
      target_language: "es",
      level: "a1",
      domain: "language",
      lesson_count: 12,
      tags: ["artikel", "alltag"],
      repo_url: "jane/deck",
      repo_name: "Jane's Deck",
    });
  });

  it("defaults generator-only fields the manifest cannot supply", () => {
    const result = deriveSearchableSet(set(), "jane/deck", "Jane's Deck", 1);
    expect(result).toMatchObject({
      card_count: 0,
      ai_validated: false,
      trust_level: 1,
      updated_at: null,
      review_status: "authored",
    });
  });

  it("falls back to the legacy 'language' alias when target_language is absent", () => {
    const result = deriveSearchableSet(
      set({ target_language: undefined, language: "es" }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result?.target_language).toBe("es");
  });

  it("uses the id as the name when title is missing", () => {
    const result = deriveSearchableSet(
      set({ id: "fallback-id", title: "" }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result?.name).toBe("fallback-id");
  });

  it("drops a set with no id", () => {
    const result = deriveSearchableSet(
      set({ id: "" }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result).toBeNull();
  });

  it("drops a set marked visibility: hidden, same as a search-index.json entry", () => {
    const result = deriveSearchableSet(
      set({ visibility: "hidden" }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result).toBeNull();
  });

  it("projects a book block via the shared asContentSetBook helper", () => {
    const result = deriveSearchableSet(
      set({ book: { title: "Don Quijote", author: "Cervantes" } }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result?.book).toMatchObject({ title: "Don Quijote", author: "Cervantes" });
  });

  it("omits the book when the manifest's book block has no title", () => {
    const result = deriveSearchableSet(
      set({ book: { author: "Cervantes" } }),
      "jane/deck",
      "Jane's Deck",
      0,
    );
    expect(result?.book).toBeNull();
  });
});

describe("deriveSearchIndexFromManifest", () => {
  it("parses a raw manifest.yaml payload into SearchableSets", () => {
    const yaml = [
      "schema_version: '1.0'",
      "sets:",
      "  - id: es-a1-from-de",
      "    title: Spanisch A1",
      "    level: a1",
      "    version: '1.0'",
      "    lesson_count: 12",
      "    source_language: de",
      "    target_language: es",
    ].join("\n");
    const result = deriveSearchIndexFromManifest(yaml, "jane/deck", "Jane's Deck", 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "es-a1-from-de", source_language: "de" });
  });

  it("returns an empty array for a manifest with no sets", () => {
    const yaml = "schema_version: '1.0'\nname: Empty repo\n";
    expect(deriveSearchIndexFromManifest(yaml, "jane/deck", "Jane's Deck")).toEqual([]);
  });

  it("never throws on unparseable text, resolving to an empty array", () => {
    expect(() =>
      deriveSearchIndexFromManifest("{{{ not yaml or json", "jane/deck", "Jane's Deck"),
    ).not.toThrow();
  });
});
