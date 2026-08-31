import { describe, expect, it } from "vitest";

import {
  buildLessonHaystack,
  buildSetHaystack,
  MIN_QUERY_LENGTH,
  normalizeSearchText,
  searchContentIndex,
  splitHighlight,
  type IndexedSet,
} from "./content-search";

function idxLesson(filename: string, title: string, cards: { front: string; back: string }[] = []) {
  return { filename, title, haystack: buildLessonHaystack(title, cards) };
}

function idxSet(
  setId: string,
  opts: {
    title: string;
    description?: string;
    domainLabel?: string;
    tags?: string[];
    lessons?: ReturnType<typeof idxLesson>[];
  },
): IndexedSet {
  return {
    setId,
    source: "astrapi69/adaptive-learner-content",
    setHaystack: buildSetHaystack(
      opts.title,
      opts.description ?? "",
      opts.domainLabel ?? "",
      opts.tags ?? [],
    ),
    lessons: opts.lessons ?? [],
  };
}

// A small library spanning 3 domains.
function library(): IndexedSet[] {
  return [
    idxSet("language-fr-a1", {
      title: "Französisch A1",
      description: "Beginner French.",
      domainLabel: "Sprachen",
      lessons: [
        idxLesson("01-bonjour.json", "Bonjour et salutations", [
          { front: "Bonjour", back: "Guten Tag" },
          { front: "Je parle français", back: "Ich spreche Französisch" },
        ]),
        idxLesson("03-articles.json", "Les articles", [
          { front: "le", back: "der" },
        ]),
      ],
    }),
    idxSet("programming-python-basics", {
      title: "Python Grundlagen",
      description: "Erste Schritte in Python.",
      domainLabel: "Programmierung",
      lessons: [
        idxLesson("01-variablen.json", "Variablen und Datentypen", [
          { front: "print()", back: "Gibt Text aus" },
        ]),
      ],
    }),
    idxSet("psychology-trauma", {
      title: "Psychologie: Trauma",
      description: "Klinische Grundlagen.",
      domainLabel: "Psychologie",
      lessons: [
        idxLesson("01-ptbs.json", "Trauma & PTBS", [
          { front: "Konditionierung", back: "conditioning" },
        ]),
      ],
    }),
  ];
}

describe("normalizeSearchText", () => {
  it("lowercases", () => {
    expect(normalizeSearchText("PYTHON")).toBe("python");
  });
  it("folds diacritics (e matches é, c matches ç)", () => {
    expect(normalizeSearchText("français")).toBe("francais");
    expect(normalizeSearchText("café")).toBe("cafe");
  });
  it("expands German digraphs (ue matches ü)", () => {
    expect(normalizeSearchText("Grüße")).toBe("gruesse");
    expect(normalizeSearchText("Französisch")).toBe("franzoesisch");
  });
});

describe("searchContentIndex", () => {
  it("matches a set by title (Python -> Python Grundlagen)", () => {
    const result = searchContentIndex(library(), "Python");
    expect(result.active).toBe(true);
    const ids = result.matches.map((m) => m.setId);
    expect(ids).toContain("programming-python-basics");
    expect(ids).not.toContain("psychology-trauma");
  });

  it("matches a lesson by title (article -> Les articles)", () => {
    const result = searchContentIndex(library(), "article");
    const fr = result.matches.find((m) => m.setId === "language-fr-a1");
    expect(fr).toBeTruthy();
    expect(fr!.matchedLessons.map((l) => l.filename)).toContain(
      "03-articles.json",
    );
  });

  it("matches a lesson by card content (Bonjour -> FR lesson 01)", () => {
    const result = searchContentIndex(library(), "Bonjour");
    const fr = result.matches.find((m) => m.setId === "language-fr-a1")!;
    expect(fr.matchedLessons.map((l) => l.filename)).toContain(
      "01-bonjour.json",
    );
  });

  it("is case-insensitive (PYTHON matches python)", () => {
    expect(
      searchContentIndex(library(), "PYTHON").matches.map((m) => m.setId),
    ).toContain("programming-python-basics");
  });

  it("is diacritic-insensitive (francais matches Français)", () => {
    const result = searchContentIndex(library(), "francais");
    expect(result.matches.map((m) => m.setId)).toContain("language-fr-a1");
  });

  it("filters the tree: non-matching sets are absent", () => {
    const result = searchContentIndex(library(), "python");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].setId).toBe("programming-python-basics");
  });

  it("combines with a domain filter (pre-filtered index)", () => {
    // Simulate an active "Sprachen" domain filter by passing only the
    // language sets to the search.
    const languageOnly = library().filter((s) =>
      s.setId.startsWith("language-"),
    );
    const result = searchContentIndex(languageOnly, "grundlagen");
    // "Python Grundlagen" is filtered out -> no results.
    expect(result.matches).toHaveLength(0);
  });

  it("returns no matches for a missing term", () => {
    const result = searchContentIndex(library(), "zzzznotfound");
    expect(result.active).toBe(true);
    expect(result.matches).toHaveLength(0);
    expect(result.lessonCount).toBe(0);
  });

  it("is inactive under the minimum query length", () => {
    const result = searchContentIndex(library(), "p");
    expect(result.active).toBe(false);
    expect(MIN_QUERY_LENGTH).toBe(2);
  });

  it("counts surfaced lessons", () => {
    // A set-title match surfaces all the set's lessons.
    const result = searchContentIndex(library(), "Python Grundlagen");
    expect(result.lessonCount).toBe(1);
  });
});

describe("splitHighlight", () => {
  it("wraps the matched substring (case-insensitive)", () => {
    const segs = splitHighlight("Les articles", "artikel");
    // No raw substring "artikel" in "Les articles" -> single non-match.
    expect(segs).toEqual([{ text: "Les articles", match: false }]);
  });
  it("highlights a raw match", () => {
    const segs = splitHighlight("Python Grundlagen", "python");
    expect(segs[0]).toEqual({ text: "Python", match: true });
    expect(segs[1].text).toContain("Grundlagen");
  });
  it("returns the whole string for an empty query", () => {
    expect(splitHighlight("abc", "")).toEqual([{ text: "abc", match: false }]);
  });
});
