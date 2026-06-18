/**
 * EXP-032 / CQV-01..03 — deterministic content-quality checks.
 */

import { describe, it, expect } from "vitest";

import { checkAccents } from "./accent-check";
import { checkArticles } from "./article-check";
import { checkDuplicates } from "./duplicate-check";
import {
  countQualityFindings,
  hasQualityFindings,
  runContentQualityChecks,
} from "./index";
import type { QualityCard } from "./types";

function card(id: string, front: string, back = ""): QualityCard {
  return { id, front, back };
}

describe("checkAccents (CQV-01)", () => {
  it("flags a missing accent with the corrected form (es)", () => {
    const out = checkAccents([card("c1", "cafe")], "es");
    expect(out).toEqual([
      { card_id: "c1", field: "front", word: "cafe", expected: "café" },
    ]);
  });

  it("does NOT flag the correctly-accented form (no false positive)", () => {
    expect(checkAccents([card("c1", "café")], "es")).toEqual([]);
  });

  it("flags a French missing accent", () => {
    const out = checkAccents([card("c1", "etre")], "fr");
    expect(out[0]).toMatchObject({ word: "etre", expected: "être" });
  });

  it("flags a German missing umlaut", () => {
    const out = checkAccents([card("c1", "fur")], "de");
    expect(out[0]).toMatchObject({ word: "fur", expected: "für" });
  });

  it("ignores a valid homograph the dictionary deliberately omits", () => {
    // "el" is a valid Spanish word; it must never be flagged as "él".
    expect(checkAccents([card("c1", "el perro")], "es")).toEqual([]);
  });

  it("returns nothing for an unsupported language", () => {
    expect(checkAccents([card("c1", "cafe")], "en")).toEqual([]);
  });

  it("de-dupes a repeated word within one card", () => {
    const out = checkAccents([card("c1", "cafe cafe")], "es");
    expect(out).toHaveLength(1);
  });
});

describe("checkArticles (CQV-02)", () => {
  it("flags a wrong article with the correct one (es)", () => {
    const out = checkArticles([card("c1", "la libro")], "es");
    expect(out).toEqual([
      { card_id: "c1", noun: "libro", expected_article: "el", actual: "la" },
    ]);
  });

  it("does NOT flag a correct article (no false positive)", () => {
    expect(checkArticles([card("c1", "el libro")], "es")).toEqual([]);
  });

  it("preserves number + definiteness when correcting", () => {
    const out = checkArticles([card("c1", "una problema")], "es");
    expect(out[0]).toMatchObject({ noun: "problema", expected_article: "un" });
  });

  it("flags a wrong French article", () => {
    const out = checkArticles([card("c1", "la livre")], "fr");
    expect(out[0]).toMatchObject({ noun: "livre", expected_article: "le" });
  });

  it("flags a wrong German nominative article", () => {
    const out = checkArticles([card("c1", "der Mädchen")], "de");
    expect(out[0]).toMatchObject({ noun: "Mädchen", expected_article: "das" });
  });

  it("skips gender-neutral French articles (les/des)", () => {
    expect(checkArticles([card("c1", "les livre")], "fr")).toEqual([]);
  });

  it("skips unknown nouns (conservative)", () => {
    expect(checkArticles([card("c1", "la xyzzy")], "es")).toEqual([]);
  });
});

describe("checkDuplicates (CQV-03)", () => {
  it("finds two cards that are the same question", () => {
    const out = checkDuplicates([
      card("a", "el gato", "die Katze"),
      card("b", "El Gato", "die Katze"),
    ]);
    expect(out).toEqual([{ card_id_a: "a", card_id_b: "b", similarity: 1 }]);
  });

  it("does NOT flag similar-but-different cards", () => {
    const out = checkDuplicates([
      card("a", "el gato", "die Katze"),
      card("b", "el perro", "der Hund"),
    ]);
    expect(out).toEqual([]);
  });

  it("normalises accents + German digraphs before comparing", () => {
    const out = checkDuplicates([
      card("a", "Begrüßung", "greeting"),
      card("b", "Begruessung", "greeting"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("anchors each later duplicate to the first occurrence", () => {
    const out = checkDuplicates([
      card("a", "uno", "eins"),
      card("b", "uno", "eins"),
      card("c", "uno", "eins"),
    ]);
    expect(out).toEqual([
      { card_id_a: "a", card_id_b: "b", similarity: 1 },
      { card_id_a: "a", card_id_b: "c", similarity: 1 },
    ]);
  });

  it("ignores entirely empty cards", () => {
    expect(checkDuplicates([card("a", "", ""), card("b", "", "")])).toEqual([]);
  });
});

describe("runContentQualityChecks", () => {
  it("aggregates all three checks", () => {
    const report = runContentQualityChecks(
      [
        card("c1", "la libro"),
        card("c2", "cafe"),
        card("c3", "uno", "eins"),
        card("c4", "uno", "eins"),
      ],
      "es",
    );
    expect(report.articles).toHaveLength(1);
    expect(report.accents).toHaveLength(1);
    expect(report.duplicates).toHaveLength(1);
    expect(hasQualityFindings(report)).toBe(true);
    expect(countQualityFindings(report)).toBe(3);
  });

  it("reports a clean set as no findings", () => {
    const report = runContentQualityChecks([card("c1", "el libro")], "es");
    expect(hasQualityFindings(report)).toBe(false);
    expect(countQualityFindings(report)).toBe(0);
  });
});
