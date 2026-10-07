import { QUALITY_MINIMUMS } from "learn-content-engine/rules";
import { describe, expect, it } from "vitest";

import type { ContentLesson } from "../../../storage/types";
import { parseLesson } from "../engine";
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
        exercise: {
          id: "e3",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c1"],
          tiles: ["Bon", "jour"],
          distractors: [],
        },
      },
      {
        id: "e4",
        type: "exercise",
        exercise: {
          id: "e4",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c3"],
          tiles: ["Sa", "lut"],
          distractors: [],
        },
      },
      {
        id: "e5",
        type: "exercise",
        exercise: {
          id: "e5",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c2"],
          tiles: ["Mer", "ci"],
          distractors: [],
        },
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

  it("allows source == target for a non-language domain", () => {
    // Mirrors the content repo's validate_content.py: a psychology set
    // is explained in the same language it teaches (source == target).
    const psych: ValidationMeta = {
      ...META,
      target_language: "de",
      source_language: "de",
      domain: "psychology",
    };
    expect(codes(psych, [goodLesson()])).not.toContain("same_source_target");
  });

  it("still rejects source == target for the (default) language domain", () => {
    const lang: ValidationMeta = {
      ...META,
      target_language: "de",
      source_language: "de",
      // domain omitted -> defaults to "language".
    };
    expect(codes(lang, [goodLesson()])).toContain("same_source_target");
  });

  it.each([
    { field: "source_language", tag: "de_DE", code: "invalid_source_language" },
    { field: "target_language", tag: "e s", code: "invalid_target_language" },
  ])("rejects a $field that is not a well-formed language tag ($tag)", ({ field, tag, code }) => {
    // #3356: the rule is the engine's E-LANG-TAG (well-formed BCP 47).
    const result = validateSetForSharing({ ...META, [field]: tag }, [goodLesson()]);
    expect(result.issues).toContainEqual({ code, params: { code: tag } });
  });

  it.each(["gsw", "yue", "fil", "pt-BR"])(
    "accepts the well-formed target tag %s, which the old 2-letter check rejected",
    (tag) => {
      const codesFound = codes({ ...META, target_language: tag }, [goodLesson()]);
      expect(codesFound).not.toContain("invalid_target_language");
    },
  );

  it("requires title_native only for a language set (#3356, engine W-SET-TITLE-NATIVE)", () => {
    const knowledge: ValidationMeta = {
      ...META,
      title_native: null,
      target_language: "de",
      source_language: "de",
      domain: "psychology",
      level: "none",
    };
    expect(codes(knowledge, [goodLesson()])).not.toContain("missing_title_native");
  });

  it("does not report a same-language pair when the source is missing", () => {
    // The engine defaults an absent source to "en"; that default must not
    // add a pair finding next to missing_source_language.
    const result = codes({ ...META, source_language: "", target_language: "en" }, [goodLesson()]);
    expect(result).toContain("missing_source_language");
    expect(result).not.toContain("same_source_target");
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

  it("flags a non-http theory example_url (#139)", () => {
    const l = goodLesson();
    l.steps[0].example_url = "ftp://example.com/x";
    expect(codes(META, [l])).toContain("example_url_invalid");
  });

  it("accepts a valid https theory example_url (#139)", () => {
    const l = goodLesson();
    l.steps[0].example_url = "https://example.com/correlation";
    l.steps[0].example_label = "Visualisierung";
    expect(codes(META, [l])).not.toContain("example_url_invalid");
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

  // #3345 - the quality minimums are the engine's validateLessonQuality, so
  // the share check gives the verdict the content-repo gate gives.
  describe("quality minimums from the engine (#3345)", () => {
    type Exercise = NonNullable<ContentLesson["steps"][number]["exercise"]>;

    function withMatching(cardIds: string[]): ContentLesson {
      const l = goodLesson();
      const m = l.steps.find((s) => s.exercise?.type === "matching")!;
      // The raw shape API mode serves (alc-psychology psych-rhetorik/01,
      // ex-match-mittel): card_ids + from_cards, no literal pairs.
      m.exercise = {
        id: "e1",
        type: "matching",
        prompt: "Zuordnen",
        card_ids: cardIds,
        from_cards: true,
      } as unknown as Exercise;
      return l;
    }

    function withExercises(count: number, purpose?: string): ContentLesson {
      const l = goodLesson();
      const tiles = l.steps.filter((s) => s.exercise?.type === "word_tiles");
      l.steps = [l.steps[0], ...tiles, ...tiles.map((s) => ({ ...s, id: `${s.id}b` }))]
        .slice(0, count + 1)
        .map((s) =>
          s.exercise ? { ...s, exercise: { ...s.exercise, id: s.id } } : s,
        );
      if (purpose) (l as { purpose?: string }).purpose = purpose;
      return l;
    }

    it("counts the pairs a from_cards matching derives", () => {
      expect(codes(META, [withMatching(["c1", "c2", "c3"])])).not.toContain(
        "matching_too_few_pairs",
      );
    });

    it("flags a from_cards matching with fewer cards than the pair minimum", () => {
      const issue = validateSetForSharing(META, [withMatching(["c1", "c2"])]).issues.find(
        (i) => i.code === "matching_too_few_pairs",
      );
      expect(issue?.params).toMatchObject({
        lesson: "01-begruessung",
        exercise: "e1",
        count: 2,
        min: QUALITY.minMatchingPairs,
      });
    });

    it.each([
      ["practice (default)", undefined, ["lesson_too_few_exercises", "lesson_too_few_types"]],
      ["bridge", "bridge", []],
      ["quiz", "quiz", ["lesson_too_few_exercises"]],
    ])("applies the count minimums of purpose %s", (_label, purpose, expected) => {
      const found = codes(META, [withExercises(1, purpose)]).filter((c) =>
        ["lesson_too_few_exercises", "lesson_too_few_types"].includes(c),
      );
      expect(found.sort()).toEqual([...expected].sort());
    });

    it("lifts the type minimum but not the count for a full quiz", () => {
      const found = codes(META, [withExercises(5, "quiz")]);
      expect(found).not.toContain("lesson_too_few_types");
      expect(found).not.toContain("lesson_too_few_exercises");
    });

    it("keeps the theory minimum for a bridge lesson", () => {
      const l = withExercises(1, "bridge");
      l.steps = l.steps.filter((s) => s.type !== "theory");
      expect(codes(META, [l])).toContain("lesson_no_theory");
    });

    it.each(["free_text", "picture_choice"])(
      "no longer requires distractors on %s (removed, #3345)",
      (type) => {
        const l = goodLesson();
        const ft = l.steps.find((s) => s.exercise?.type === "free_text")!;
        ft.exercise = { ...ft.exercise!, type, distractors: [] } as Exercise;
        expect(codes(META, [l])).not.toContain("missing_distractors");
      },
    );
  });

  // #2376 class 4 - a repeated left value is objectively unsolvable for the
  // learner and hard-fails the engine gate (E-MATCH-DUP-LEFT,
  // learn-content-engine#54). The app-side check must catch it BEFORE export.
  it("flags matching exercises with duplicate left values", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: "Keimbahn-Editierung", right: "a" },
      { left: "Keimbahn-Editierung", right: "b" },
      { left: "Salut", right: "Hallo" },
    ];
    const result = validateSetForSharing(META, [l]);
    const dup = result.issues.find(
      (i) => i.code === "matching_duplicate_left",
    );
    expect(dup).toBeDefined();
    expect(dup!.params).toMatchObject({
      lesson: "01-begruessung",
      exercise: "e1",
      value: "Keimbahn-Editierung",
    });
  });

  it("does not flag matching exercises with distinct left values", () => {
    expect(codes(META, [goodLesson()])).not.toContain(
      "matching_duplicate_left",
    );
  });

  // #3222 PR 5: every engine rule reaches the author, not only the one
  // with dedicated wording. The generic code carries what the engine says,
  // so the content-repo gate never rejects a set the app called clean.
  describe("engine rules (learn-content-engine/rules)", () => {
    function withTwoCorrectOptions(): ContentLesson {
      const l = goodLesson();
      l.steps.push({
        id: "e-mc",
        type: "exercise",
        exercise: {
          id: "e-mc",
          type: "multiple_choice",
          prompt: "Was heisst Danke?",
          card_ids: ["c2"],
          options: ["Merci", "Bonjour", "Salut"],
          correct: [0, 1],
          distractors: [],
        } as unknown as ContentLesson["steps"][number]["exercise"],
      });
      return l;
    }

    it("reports an engine error the app has no wording for as engine_rule", () => {
      const result = validateSetForSharing(META, [withTwoCorrectOptions()]);
      expect(result.ok).toBe(false);
      const finding = result.issues.find((i) => i.code === "engine_rule");
      expect(finding).toBeDefined();
      expect(finding!.params).toMatchObject({
        lesson: "01-begruessung",
        rule: "E-MC-ONE-CORRECT",
      });
      expect(String(finding!.params!.path)).toMatch(/^\/steps\/\d+\/exercise/);
      expect(String(finding!.params!.message)).toContain("exactly one option");
    });

    it("keeps the dedicated wording for a duplicate left value and does not double it", () => {
      const l = goodLesson();
      const m = l.steps.find((s) => s.exercise?.type === "matching")!;
      m.exercise!.pairs = [
        { left: "Bonjour", right: "a" },
        { left: "Bonjour", right: "b" },
        { left: "Salut", right: "Hallo" },
      ];
      const issues = validateSetForSharing(META, [l]).issues;
      expect(issues.filter((i) => i.code === "matching_duplicate_left")).toHaveLength(1);
      expect(
        issues.filter(
          (i) => i.code === "engine_rule" && i.params?.rule === "E-MATCH-DUP-LEFT",
        ),
      ).toHaveLength(0);
    });

    it("reports an engine lint as engine_warning without blocking the share", () => {
      const l = goodLesson();
      l.cards.push({ id: "c-unused", front: "Au revoir", back: "Auf Wiedersehen", tags: [] });
      const result = validateSetForSharing(META, [l]);
      expect(result.ok).toBe(true);
      const lint = result.warnings.find((w) => w.code === "engine_warning");
      expect(lint).toBeDefined();
      expect(lint!.params).toMatchObject({ lesson: "01-begruessung", rule: "W-CARD-UNUSED" });
    });

    it("does not repeat a lint the app already reports under its own code", () => {
      const l = goodLesson();
      (l as ContentLesson & { domain?: string }).domain = "basket-weaving";
      const rules = validateSetForSharing(META, [l]).warnings.map((w) => w.params?.rule);
      expect(rules).not.toContain("W-DOMAIN-UNKNOWN");
    });

    it("accepts an adopted extension exercise through the app registry", () => {
      const l = goodLesson();
      (l as ContentLesson & { requires_extensions?: string[] }).requires_extensions = [
        "ext:al-ordering@1",
      ];
      l.steps.push({
        id: "e-order",
        type: "exercise",
        exercise: {
          id: "e-order",
          type: "ext:al-ordering",
          prompt: "Ordne",
          card_ids: ["c1"],
          distractors: [],
          items: ["Bonjour", "Merci", "Salut"],
        } as unknown as ContentLesson["steps"][number]["exercise"],
      });
      const issues = validateSetForSharing(META, [l]).issues;
      expect(issues.map((i) => i.params?.rule)).not.toContain("E-EXT-UNSUPPORTED");
      expect(issues.map((i) => i.params?.rule)).not.toContain("E-EXT-UNDECLARED");
    });
  });

  // #3222 PR 2: the check IS the engine's E-MATCH-DUP-LEFT
  // (learn-content-engine/rules), so the app cannot define "duplicate"
  // differently from the content-repo gate. The engine compares
  // case-insensitively and whitespace-trimmed; the app copy it replaces
  // compared trimmed but case-sensitively, so "Empathie" next to
  // "empathie" passed here and failed the repo gate.
  it("flags duplicate left values that differ only in case, as the engine does", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: "Empathie", right: "a" },
      { left: "empathie", right: "b" },
      { left: "Salut", right: "Hallo" },
    ];
    const dup = validateSetForSharing(META, [l]).issues.find(
      (i) => i.code === "matching_duplicate_left",
    );
    expect(dup).toBeDefined();
    expect(dup!.params).toMatchObject({
      lesson: "01-begruessung",
      exercise: "e1",
      value: "Empathie",
    });
  });

  it("flags duplicate left values that differ only in surrounding whitespace", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: " Haus ", right: "a" },
      { left: "Haus", right: "b" },
      { left: "Salut", right: "Hallo" },
    ];
    expect(codes(META, [l])).toContain("matching_duplicate_left");
  });

  it("flags two blank left values as a duplicate, as the engine does", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: "", right: "a" },
      { left: " ", right: "b" },
      { left: "Salut", right: "Hallo" },
    ];
    expect(codes(META, [l])).toContain("matching_duplicate_left");
  });

  it("does not flag left values that differ by a diacritic", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: "Haus", right: "a" },
      { left: "Häus", right: "b" },
      { left: "Salut", right: "Hallo" },
    ];
    expect(codes(META, [l])).not.toContain("matching_duplicate_left");
  });

  it("reports one issue per duplicate group, with the exercise id", () => {
    const l = goodLesson();
    const m = l.steps.find((s) => s.exercise?.type === "matching")!;
    m.exercise!.pairs = [
      { left: "a", right: "1" },
      { left: "A", right: "2" },
      { left: "b", right: "3" },
      { left: "b", right: "4" },
    ];
    const dups = validateSetForSharing(META, [l]).issues.filter(
      (i) => i.code === "matching_duplicate_left",
    );
    expect(dups.map((i) => i.params?.value)).toEqual(["a", "b"]);
    expect(dups.every((i) => i.params?.exercise === "e1")).toBe(true);
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

  // #3383 - the script check is the engine's W-CARD-BACK-SCRIPT (CLDR
  // likely-script for any language), not a hand-kept table of six.
  it.each([
    { name: "a Ukrainian source with Latin backs", source: "uk", back: "the house", flagged: true },
    { name: "a Hebrew source with Latin backs", source: "he", back: "the house", flagged: true },
    { name: "a Greek source with a back of digits only", source: "el", back: "42", flagged: false },
    { name: "a Korean source with a Han back", source: "ko", back: "學校", flagged: false },
    { name: "a Greek source with a Greek back", source: "el", back: "το σπίτι", flagged: false },
  ])("$name: back_language_mismatch is $flagged", ({ source, back, flagged }) => {
    const meta: ValidationMeta = { ...META, source_language: source };
    const l = goodLesson();
    for (const card of l.cards) card.back = back;
    expect(codes(meta, [l]).includes("back_language_mismatch")).toBe(flagged);
  });

  it("does not flag Latin-script source backs (de can't be told from en)", () => {
    expect(codes(META, [goodLesson()])).not.toContain("back_language_mismatch");
  });

  it("exposes the quality thresholds", () => {
    expect(QUALITY.minExercisesPerLesson).toBe(5);
  });

  // #3349 - a lesson without ``cards`` (alc-psychology
  // psych-intro/vertiefung-*-fallanwendung) read the way Dexie mode reads
  // it, in an A1 set: the check reports instead of throwing.
  it("checks a lesson without cards read through parseLesson (#3349)", () => {
    const { cards: _cards, ...cardless } = goodLesson();
    const lesson = parseLesson(JSON.stringify(cardless), {
      language: "fr",
      target_language: "fr",
      source_language: "de",
      domain: "language",
    });
    const result = validateSetForSharing(META, [lesson]);
    expect(result.issues.map((i) => i.code)).not.toContain("empty_card");
  });

  it("displays the numbers the engine checks against (#3345)", () => {
    expect({ ...QUALITY }).toEqual({ ...QUALITY_MINIMUMS });
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

  it.each([
    { name: "a language set", domain: undefined, warned: true },
    { name: "a knowledge set", domain: "psychology", warned: false },
  ])("treats level 'none' on $name as the engine does (W-LEVEL-UNKNOWN)", ({ domain, warned }) => {
    const meta: ValidationMeta = { ...META, level: "none", ...(domain ? { domain, source_language: "de", target_language: "de" } : {}) };
    expect(warnCodes(meta, [goodLesson()]).includes("non_cefr_level")).toBe(warned);
  });

  it("carries a set-level engine warning without an app code, non-blocking", () => {
    const result = validateSetForSharing({ ...META, target_language: "EN" }, [goodLesson()]);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "engine_set_warning",
        params: expect.objectContaining({ rule: "W-LANG-TAG-CANONICAL" }),
      }),
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
    expect(warnCodes({ ...META, target_language: "es" }, [l])).not.toContain(
      "target_language_heuristic",
    );
  });
});
