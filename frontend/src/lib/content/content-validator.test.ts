import { describe, expect, it } from "vitest";

import type { ContentLesson } from "../../storage/types";
import {
  QUALITY,
  treePlacement,
  validateSetForSharing,
  type ValidationMeta,
} from "./content-validator";

const META: ValidationMeta = {
  title: "Französisch A1",
  title_native: "Français A1",
  target_language: "fr",
  source_language: "de",
  level: "A1",
};

function goodLesson(): ContentLesson {
  return {
    id: "01-begruessung",
    title: "Begrüßung",
    estimated_minutes: 10,
    cards: [
      { id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] },
      { id: "c2", front: "Merci", back: "Danke", tags: [] },
      { id: "c3", front: "Salut", back: "Hallo", tags: [] },
    ],
    steps: [
      { id: "intro", type: "theory", body: "# Begrüßung" },
      {
        id: "e1",
        type: "exercise",
        exercise: {
          id: "e1",
          type: "matching",
          prompt: "Zuordnen",
          card_ids: ["c1", "c2", "c3"],
          pairs: [
            { left: "Bonjour", right: "Guten Tag" },
            { left: "Merci", right: "Danke" },
            { left: "Salut", right: "Hallo" },
          ],
          distractors: [],
        },
      },
      {
        id: "e2",
        type: "exercise",
        exercise: {
          id: "e2",
          type: "free_text",
          prompt: "Tippe",
          card_ids: ["c1"],
          accept: ["Bonjour", "bonjour"],
          distractors: ["Salut", "Merci"],
        },
      },
      {
        id: "e3",
        type: "exercise",
        exercise: { id: "e3", type: "word_tiles", prompt: "Ordne", card_ids: ["c1"], tiles: ["Bon", "jour"], distractors: [] },
      },
      {
        id: "e4",
        type: "exercise",
        exercise: { id: "e4", type: "word_tiles", prompt: "Ordne", card_ids: ["c3"], tiles: ["Sa", "lut"], distractors: [] },
      },
      {
        id: "e5",
        type: "exercise",
        exercise: { id: "e5", type: "word_tiles", prompt: "Ordne", card_ids: ["c2"], tiles: ["Mer", "ci"], distractors: [] },
      },
    ],
  } as ContentLesson;
}

function codes(meta: ValidationMeta, lessons: ContentLesson[]): string[] {
  return validateSetForSharing(meta, lessons).issues.map((i) => i.code);
}

describe("validateSetForSharing", () => {
  it("passes a complete, valid set", () => {
    const result = validateSetForSharing(META, [goodLesson()]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects an empty set", () => {
    expect(codes(META, [])).toContain("no_lessons");
  });

  it("requires source != target", () => {
    expect(codes({ ...META, source_language: "fr" }, [goodLesson()])).toContain(
      "same_source_target",
    );
  });

  it("requires a valid ISO 639-1 source language", () => {
    expect(
      codes({ ...META, source_language: "deutsch" }, [goodLesson()]),
    ).toContain("invalid_source_language");
  });

  it("requires title_native", () => {
    expect(codes({ ...META, title_native: null }, [goodLesson()])).toContain(
      "missing_title_native",
    );
  });

  it("enforces the minimum exercise count", () => {
    const l = goodLesson();
    l.steps = l.steps.filter((s) => s.id !== "e5"); // 4 exercises
    expect(codes(META, [l])).toContain("lesson_too_few_exercises");
  });

  it("enforces at least 2 exercise types", () => {
    const l = goodLesson();
    // Replace matching + free_text with word_tiles so only one type.
    l.steps = l.steps.map((s) =>
      s.exercise && s.exercise.type !== "word_tiles"
        ? {
            ...s,
            exercise: { ...s.exercise, type: "word_tiles", tiles: ["a", "b"] },
          }
        : s,
    );
    expect(codes(META, [l])).toContain("lesson_too_few_types");
  });

  it("requires at least one theory step", () => {
    const l = goodLesson();
    l.steps = l.steps.filter((s) => s.type !== "theory");
    // also keep >=5 exercises (still 5)
    expect(codes(META, [l])).toContain("lesson_no_theory");
  });

  it("requires free_text exercises to have >= 2 accepts", () => {
    const l = goodLesson();
    const ft = l.steps.find((s) => s.exercise?.type === "free_text")!;
    ft.exercise!.accept = ["only"];
    expect(codes(META, [l])).toContain("free_text_too_few_accepts");
  });

  it("requires matching exercises to have >= 3 pairs", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [{ left: "a", right: "b" }];
    expect(codes(META, [l])).toContain("matching_too_few_pairs");
  });

  it("flags empty card front/back", () => {
    const l = goodLesson();
    l.cards[0].back = "";
    expect(codes(META, [l])).toContain("empty_card");
  });

  it("flags a Latin back in a non-Latin (Greek) source set", () => {
    const greek: ValidationMeta = { ...META, source_language: "el" };
    const l = goodLesson(); // backs are German (Latin), source claims Greek
    expect(codes(greek, [l])).toContain("back_language_mismatch");
  });

  it("does not flag Latin-script source backs (de can't be told from en)", () => {
    expect(codes(META, [goodLesson()])).not.toContain("back_language_mismatch");
  });

  it("exposes the quality thresholds", () => {
    expect(QUALITY.minExercisesPerLesson).toBe(5);
  });
});

function warnCodes(meta: ValidationMeta, lessons: ContentLesson[]): string[] {
  return validateSetForSharing(meta, lessons).warnings.map((w) => w.code);
}

describe("treePlacement", () => {
  it("builds the source-language tree path", () => {
    expect(treePlacement(META)).toEqual({
      source: "de",
      target: "fr",
      level: "A1",
      path: "sets/de/fr-a1",
    });
  });
});

// A lesson whose backs are LONG (>10 words/side avg) — exercises
// the level word-count proxy.
function wordyGermanLesson(): ContentLesson {
  const l = goodLesson();
  l.cards = l.cards.map((c, i) => ({
    ...c,
    back: `Dies ist eine ausführliche deutsche Erklärung Nummer ${i} mit vielen Wörtern`,
  }));
  return l;
}

describe("validateSetForSharing — warnings (non-blocking)", () => {
  it("warnings never flip ok to false", () => {
    const r = validateSetForSharing(META, [wordyGermanLesson()]);
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0); // level_too_complex
  });

  it("warns when the level is not a CEFR band", () => {
    expect(warnCodes({ ...META, level: "beginner" }, [goodLesson()])).toContain(
      "non_cefr_level",
    );
  });

  it("warns when A1 card text is too long for the level", () => {
    expect(warnCodes(META, [wordyGermanLesson()])).toContain(
      "level_too_complex",
    );
  });

  // Regression pin for the Phase 61 review FAIL: correctly-labelled
  // French content whose early lessons are diacritic-free (greetings,
  // numbers, articles) must NOT trip the target-language heuristic.
  it("does NOT flag diacritic-free but correct target content (de/fr-a1 case)", () => {
    const lesson = goodLesson(); // fronts: Bonjour, Merci, Salut (no accents)
    const codes = warnCodes(META, [lesson]);
    expect(codes).not.toContain("target_language_heuristic");
    expect(codes).not.toContain("source_language_heuristic");
  });

  it("flags a non-Latin script on the source back (Japanese in a German source)", () => {
    const l = goodLesson();
    l.cards[0].back = "これはドイツ語ではありません"; // Japanese in a de-source set
    expect(warnCodes(META, [l])).toContain("source_language_heuristic");
  });

  it("does NOT flag Latin source quoting the target language (ñ in an English note about Spanish)", () => {
    // The es-a1-from-en false positive: English source notes quote
    // Spanish (ñ/¿). Latin markers are NOT checked on the source side.
    const l = goodLesson();
    l.cards[0].back = "child (from the Spanish 'niño', note the ñ)";
    expect(
      warnCodes({ ...META, source_language: "en", target_language: "es" }, [l]),
    ).not.toContain("source_language_heuristic");
  });

  it("flags a CONFLICTING marker: German ß on a French-target front", () => {
    const l = goodLesson();
    l.cards[0].front = "Straße"; // German ß where French is expected
    expect(warnCodes(META, [l])).toContain("target_language_heuristic");
  });

  it("flags a non-Latin script mismatch (Greek where French expected)", () => {
    const l = goodLesson();
    l.cards[0].front = "Καλημέρα";
    expect(warnCodes(META, [l])).toContain("target_language_heuristic");
  });

  it("does NOT flag the expected target's own marker (Spanish ñ on a Spanish front)", () => {
    const l = goodLesson();
    l.cards[0].front = "el niño"; // ñ is Spanish's own marker
    expect(
      warnCodes({ ...META, target_language: "es" }, [l]),
    ).not.toContain("target_language_heuristic");
  });
});
