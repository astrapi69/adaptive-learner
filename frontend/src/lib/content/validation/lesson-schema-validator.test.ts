/**
 * #1205 — ajv structural validation against the generated SoT schema
 * (EXP-039). These are the nine TDD fixtures from the #747 spike, written
 * RED-first: the structural shape moves to ajv against
 * ``schema/lesson.schema.json`` (mirrored bundle-local), the imperative
 * cross-field checks stay in ``validateGeneratedLesson``.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect } from "vitest";

import { validateLessonShape } from "./lesson-schema-validator";
import {
  validateGeneratedLesson,
  generateLessonFromAnalysis,
} from "../analysis/analysis-to-lesson";
import type { ContentLesson } from "../../../storage/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const INCEPTION = JSON.parse(
  readFileSync(join(HERE, "..", "__fixtures__", "inception-lesson.json"), "utf-8"),
) as ContentLesson;

/** A minimal schema-valid lesson: one card + one exercise that drills it. */
function makeLesson(overrides: Partial<ContentLesson> = {}): ContentLesson {
  return {
    id: "01-greetings",
    title: "Greetings",
    description: null,
    estimated_minutes: 5,
    cards: [{ id: "card-01", front: "Bonjour", back: "Hello", tags: [] }],
    steps: [
      { id: "theory-intro", type: "theory", body: "Some theory." },
      {
        id: "ex-match-01",
        type: "exercise",
        exercise: {
          id: "ex-match-01",
          type: "matching",
          prompt: "Match them.",
          card_ids: ["card-01"],
          distractors: [],
          pairs: [
            { left: "Bonjour", right: "Hello" },
            { left: "Merci", right: "Thanks" },
            { left: "Oui", right: "Yes" },
          ],
        },
      },
    ],
    ...overrides,
  } as ContentLesson;
}

// ---------------------------------------------------------------------------
// Fixture 1 — backward compatibility: real + synthesised content stays green.
// ---------------------------------------------------------------------------
describe("#1205 fixture 1 — backward compatibility (existing content stays valid)", () => {
  it("accepts the committed inception lesson against the SoT schema", () => {
    const result = validateLessonShape(INCEPTION);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(() => validateGeneratedLesson(INCEPTION)).not.toThrow();
  });

  it("accepts a freshly synthesised analysis lesson", () => {
    const lesson = generateLessonFromAnalysis(
      {
        topic: "Spanish travel vocabulary",
        vocabulary: [
          { word: "la cuenta", translation: "the bill" },
          { word: "el agua", translation: "the water" },
          { word: "la calle", translation: "the street" },
          { word: "izquierda", translation: "left" },
          { word: "derecha", translation: "right" },
        ],
      },
      { id: "conv-1" },
    );
    expect(validateLessonShape(lesson).ok).toBe(true);
  });

  it("accepts the minimal hand-built lesson", () => {
    expect(validateLessonShape(makeLesson()).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture 2 — additionalProperties: a foreign field is rejected.
// ---------------------------------------------------------------------------
describe("#1205 fixture 2 — additionalProperties:false (foreign field)", () => {
  it("rejects a lesson carrying an unknown top-level field", () => {
    const bad = { ...makeLesson(), bogus: 1 } as unknown as ContentLesson;
    const result = validateLessonShape(bad);
    expect(result.ok).toBe(false);
    expect(() => validateGeneratedLesson(bad)).toThrow(/generated lesson invalid/);
  });

  it("rejects an unknown field nested inside an exercise", () => {
    const lesson = makeLesson();
    (lesson.steps[1].exercise as Record<string, unknown>).bogus = "x";
    expect(validateLessonShape(lesson).ok).toBe(false);
  });

  // Error-message mapping: the reject must name the offending field, not a
  // raw [object Object] / JSON dump.
  it("names the offending field in the error message", () => {
    const bad = { ...makeLesson(), bogus: 1 } as unknown as ContentLesson;
    const [first] = validateLessonShape(bad).errors;
    expect(first).toMatch(/bogus/);
    expect(first).not.toMatch(/\[object Object\]/);
  });
});

// ---------------------------------------------------------------------------
// Fixture 3 — referential integrity (imperative): card_ids -> cards.
// ---------------------------------------------------------------------------
describe("#1205 fixture 3 — referential integrity (imperative)", () => {
  it("rejects an exercise referencing a missing card", () => {
    const lesson = makeLesson();
    lesson.steps[1].exercise!.card_ids = ["does-not-exist"];
    // Shape alone is fine (card_ids is just an array of strings)...
    expect(validateLessonShape(lesson).ok).toBe(true);
    // ...the imperative check catches it.
    expect(() => validateGeneratedLesson(lesson)).toThrow(/missing card/);
  });
});

// ---------------------------------------------------------------------------
// Fixture 4 — cloze marker/blank count (imperative).
// ---------------------------------------------------------------------------
describe("#1205 fixture 4 — cloze marker/blank mismatch (imperative)", () => {
  it("rejects when ___ count !== blanks length", () => {
    const lesson = makeLesson({
      steps: [
        { id: "theory-intro", type: "theory", body: "t" },
        {
          id: "ex-cloze-01",
          type: "exercise",
          exercise: {
            id: "ex-cloze-01",
            type: "cloze",
            prompt: "Fill in.",
            card_ids: ["card-01"],
            distractors: [],
            sentence: "Le ___ et la ___.",
            blanks: [{ accept: ["chat"] }],
          },
        },
      ],
    });
    expect(validateLessonShape(lesson).ok).toBe(true);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/marker|blank/i);
  });
});

// ---------------------------------------------------------------------------
// Fixture 5 — picture_choice exactly one is_correct (imperative).
// ---------------------------------------------------------------------------
describe("#1205 fixture 5 — picture_choice single correct (imperative)", () => {
  function pictureLesson(images: Array<Record<string, string>>): ContentLesson {
    return makeLesson({
      steps: [
        { id: "theory-intro", type: "theory", body: "t" },
        {
          id: "ex-pic-01",
          type: "exercise",
          exercise: {
            id: "ex-pic-01",
            type: "picture_choice",
            prompt: "Pick one.",
            card_ids: ["card-01"],
            distractors: [],
            images,
          },
        },
      ],
    } as Partial<ContentLesson>);
  }

  it("rejects zero correct images", () => {
    const lesson = pictureLesson([
      { src: "assets/img/a.png", label: "A" },
      { src: "assets/img/b.png", label: "B" },
    ]);
    expect(validateLessonShape(lesson).ok).toBe(true);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/correct/i);
  });

  it("rejects two correct images", () => {
    const lesson = pictureLesson([
      { src: "assets/img/a.png", label: "A", is_correct: "true" },
      { src: "assets/img/b.png", label: "B", is_correct: "true" },
    ]);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/correct/i);
  });

  it("accepts exactly one correct image", () => {
    const lesson = pictureLesson([
      { src: "assets/img/a.png", label: "A", is_correct: "true" },
      { src: "assets/img/b.png", label: "B" },
    ]);
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });

  // Engine 0.13.0 / schema 1.8 (engine#66): ``src`` is an anyOf of the
  // original assets/ path (<= 500 chars) OR an inline base64 data URI
  // with its own 250000-char cap (sized for the 150-KiB upload
  // compression from #1763). RED before the 0.13.0 re-pin.
  describe("src formats (schema 1.8, engine 0.13.0)", () => {
    const dataUriSrc = (base64Length: number): string => `data:image/jpeg;base64,${"A".repeat(base64Length)}`;

    it("accepts a base64 data-URI src longer than the 500-char path cap", () => {
      const lesson = pictureLesson([
        { src: dataUriSrc(10_000), label: "A", is_correct: "true" },
        { src: "assets/img/b.png", label: "B" },
      ]);
      expect(validateLessonShape(lesson).ok).toBe(true);
      expect(() => validateGeneratedLesson(lesson)).not.toThrow();
    });

    it("rejects a data-URI src beyond the 250000-char cap", () => {
      const lesson = pictureLesson([
        { src: dataUriSrc(250_001), label: "A", is_correct: "true" },
        { src: "assets/img/b.png", label: "B" },
      ]);
      expect(validateLessonShape(lesson).ok).toBe(false);
    });

    it("still rejects a non-data-URI src longer than 500 chars", () => {
      const lesson = pictureLesson([
        { src: `assets/img/${"x".repeat(600)}.png`, label: "A", is_correct: "true" },
        { src: "assets/img/b.png", label: "B" },
      ]);
      expect(validateLessonShape(lesson).ok).toBe(false);
    });

    it("keeps existing path srcs valid (regression for the ecosystem's picture_choice stock)", () => {
      const lesson = pictureLesson([
        { src: "assets/img/a.png", label: "A", is_correct: "true" },
        { src: "assets/img/b.png", label: "B" },
      ]);
      expect(validateLessonShape(lesson).ok).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Fixture 6 — accept_orderings must be a permutation (imperative).
// ---------------------------------------------------------------------------
describe("#1205 fixture 6 — accept_orderings permutation (imperative)", () => {
  function tilesLesson(accept_orderings: number[][]): ContentLesson {
    return makeLesson({
      steps: [
        { id: "theory-intro", type: "theory", body: "t" },
        {
          id: "ex-tiles-01",
          type: "exercise",
          exercise: {
            id: "ex-tiles-01",
            type: "word_tiles",
            prompt: "Order them.",
            card_ids: ["card-01"],
            distractors: [],
            tiles: ["Le", "chat", "noir"],
            accept_orderings,
          },
        },
      ],
    } as Partial<ContentLesson>);
  }

  it("rejects an ordering that is not a permutation of [0..len-1]", () => {
    const lesson = tilesLesson([[0, 1, 1]]);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/permutation|ordering/i);
  });

  it("rejects an ordering of the wrong length", () => {
    const lesson = tilesLesson([[0, 1]]);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/permutation|ordering/i);
  });

  it("accepts a valid permutation", () => {
    const lesson = tilesLesson([
      [0, 1, 2],
      [2, 1, 0],
    ]);
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Fixture 7 — slug-safe ids + uniqueness (imperative).
// ---------------------------------------------------------------------------
describe("#1205 fixture 7 — slug-safe + uniqueness (imperative)", () => {
  it("rejects a non-slug card id", () => {
    const lesson = makeLesson();
    lesson.cards[0].id = "Not Slug";
    expect(() => validateGeneratedLesson(lesson)).toThrow(/slug-safe/);
  });

  it("rejects a duplicate card id", () => {
    const lesson = makeLesson({
      cards: [
        { id: "card-01", front: "a", back: "b", tags: [] },
        { id: "card-01", front: "c", back: "d", tags: [] },
      ],
    });
    expect(() => validateGeneratedLesson(lesson)).toThrow(/duplicate card/);
  });

  it("rejects a duplicate step id", () => {
    const lesson = makeLesson();
    lesson.steps[1].id = "theory-intro";
    expect(() => validateGeneratedLesson(lesson)).toThrow(/duplicate step/);
  });

  it("accepts unicode-lowercase card ids and tags (#1808)", () => {
    const lesson = makeLesson();
    lesson.cards[0].id = "pr\u00e4senz";
    lesson.cards[0].tags = ["w\u00e4hrung"];
    const exerciseStep = lesson.steps.find((step) => step.exercise);
    if (exerciseStep?.exercise) {
      exerciseStep.exercise.card_ids = ["pr\u00e4senz"];
    }
    expect(() => validateGeneratedLesson(lesson)).not.toThrow();
  });

  it("still rejects uppercase umlauts and inner spaces", () => {
    const lesson = makeLesson();
    lesson.cards[0].tags = ["\u00c4rger"];
    expect(() => validateGeneratedLesson(lesson)).toThrow(/slug-safe/);
  });
});

// ---------------------------------------------------------------------------
// Fixture 8 — closed ExerciseType enum (ajv).
// ---------------------------------------------------------------------------
describe("#1205 fixture 8 — closed exercise.type enum (ajv)", () => {
  it("rejects an unknown exercise type (e.g. ordering)", () => {
    const lesson = makeLesson();
    (lesson.steps[1].exercise as Record<string, unknown>).type =
      "ordering";
    const result = validateLessonShape(lesson);
    expect(result.ok).toBe(false);
    expect(() => validateGeneratedLesson(lesson)).toThrow(/generated lesson invalid/);
  });

  it("rejects an unknown step type", () => {
    const lesson = makeLesson();
    (lesson.steps[0] as Record<string, unknown>).type = "video";
    expect(validateLessonShape(lesson).ok).toBe(false);
  });

  it("names the field path of the bad enum value", () => {
    const lesson = makeLesson();
    (lesson.steps[1].exercise as Record<string, unknown>).type =
      "ordering";
    const [first] = validateLessonShape(lesson).errors;
    // The instancePath points at the offending field, not the whole object.
    expect(first).toMatch(/steps\/1\/exercise\/type/);
  });
});

// ---------------------------------------------------------------------------
// cloze_mode enum — validated from the schema, not hard-coded (anti-drift).
// ---------------------------------------------------------------------------
describe("#1205 — cloze_mode is schema-validated", () => {
  function clozeLesson(cloze_mode: string): ContentLesson {
    return makeLesson({
      steps: [
        { id: "theory-intro", type: "theory", body: "t" },
        {
          id: "ex-cloze-01",
          type: "exercise",
          exercise: {
            id: "ex-cloze-01",
            type: "cloze",
            prompt: "Fill in.",
            card_ids: ["card-01"],
            distractors: [],
            cloze_mode,
            sentence: "Le ___.",
            blanks: [{ accept: ["chat"] }],
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);
  }

  it("accepts an allowed cloze_mode ('select')", () => {
    expect(validateLessonShape(clozeLesson("select")).ok).toBe(true);
  });

  it("accepts cloze_mode 'multiselect' (#1195) — read from the schema, not hard-coded", () => {
    // multiselect entered the schema via #1195; ajv accepts it with NO change
    // to this validator because the allowed set is read from
    // schema/lesson.schema.json. That automatic follow-through is the
    // anti-drift payoff (change the Pydantic model -> make sync-schema -> ajv
    // validates the new shape).
    expect(validateLessonShape(clozeLesson("multiselect")).ok).toBe(true);
  });

  it("rejects an unknown cloze_mode", () => {
    expect(validateLessonShape(clozeLesson("not-a-real-mode")).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture 9 — golden parity pin (app-side).
//
// The cross-LANGUAGE half (the content-repo's stdlib ``validate_content.py``)
// lives in a separate repo and checks a disjoint QUALITY layer (#699 /
// EXP-039 §1.2); it cannot be exercised here. This golden pins the APP-side
// shape contract: a known-good lesson validates and a known-bad one rejects
// with a stable reason, so neither the ajv layer nor the imperative layer can
// silently drift.
// ---------------------------------------------------------------------------
interface ParityCase {
  name: string;
  expectValid: boolean;
  reason: string;
  lesson: unknown;
}
const PARITY = JSON.parse(
  readFileSync(join(HERE, "..", "__fixtures__", "lesson-shape-parity.json"), "utf-8"),
) as { cases: ParityCase[] };

describe("#1205 fixture 9 — shared shape-parity fixture (app-side)", () => {
  it("golden-good: the inception lesson validates clean", () => {
    expect(validateLessonShape(INCEPTION).ok).toBe(true);
    expect(() => validateGeneratedLesson(INCEPTION)).not.toThrow();
  });

  // Each case in the shared fixture file must get the expected SHAPE verdict
  // from the app-side ajv validator. The SAME file is the parity contract the
  // content-repo validator is to be pinned against once it adopts jsonschema
  // (EXP-039 step 8 / CCWc follow-up) — see the PR/report.
  it.each(PARITY.cases)(
    "shared fixture '$name' -> expectValid=$expectValid",
    ({ lesson, expectValid }) => {
      expect(validateLessonShape(lesson).ok).toBe(expectValid);
    },
  );
});


describe("extension tier load guard (#1565, schema 1.7)", () => {
  // The loud-refusal contract (engine E-EXT-UNSUPPORTED) must hold at the
  // app's LOAD boundary too: structurally a requires_extensions lesson is
  // valid 1.7, but this app has adopted no extensions - loading one and
  // letting the ext exercise fall through to unknown-type rendering would
  // be exactly the silent mis-rendering the contract forbids.
  it("refuses a lesson declaring an extension this app has not adopted", () => {
    const declared = makeLesson({
      requires_extensions: ["ext:ref-ordering@1"],
    } as Partial<ContentLesson>);
    const result = validateLessonShape(declared);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("ext:ref-ordering@1");
  });

  it("names every declared extension in the refusal", () => {
    const declared = makeLesson({
      requires_extensions: ["ext:ref-ordering@1", "ext:acme-cards@2"],
    } as Partial<ContentLesson>);
    const joined = validateLessonShape(declared).errors.join(" ");
    expect(joined).toContain("ext:ref-ordering@1");
    expect(joined).toContain("ext:acme-cards@2");
  });

  it("an explicitly empty requires_extensions stays loadable (boundary)", () => {
    const empty = makeLesson({ requires_extensions: [] } as Partial<ContentLesson>);
    expect(validateLessonShape(empty).ok).toBe(true);
  });

  it("core lessons without the field stay loadable (regression)", () => {
    expect(validateLessonShape(makeLesson()).ok).toBe(true);
  });
});


describe("adopted extension ext:al-categorization (#1579)", () => {
  // First real adoption of the schema-1.7 extension tier: the load guard
  // lets the adopted type through, and the semantic layer validates the
  // ext_payload the core schema treats as opaque.
  const categorizationExercise = {
    id: "ex-categ-01",
    type: "ext:al-categorization",
    prompt: "Ordne jedes Signal der richtigen Kategorie zu.",
    card_ids: ["card-01"],
    distractors: [],
    ext_payload: {
      categories: [
        { name: "Sichtzeichen", items: ["flache Hand", "Zeigefinger hoch"] },
        { name: "Hoerzeichen", items: ["Sitz", "Platz"] },
      ],
    },
  };

  const categorizationLesson = (payloadOverride?: unknown) =>
    makeLesson({
      requires_extensions: ["ext:al-categorization@1"],
      steps: [
        {
          id: "step-categ-01",
          type: "exercise",
          exercise: {
            ...categorizationExercise,
            ...(payloadOverride === undefined
              ? {}
              : { ext_payload: payloadOverride }),
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);

  it("the load guard accepts a lesson declaring the adopted extension", () => {
    const shape = validateLessonShape(categorizationLesson());
    expect(shape.errors).toEqual([]);
    expect(shape.ok).toBe(true);
  });

  it("a lesson mixing adopted and unadopted extensions is still refused, naming only the unadopted one", () => {
    const mixed = makeLesson({
      requires_extensions: ["ext:al-categorization@1", "ext:ref-ordering@1"],
    } as Partial<ContentLesson>);
    const shape = validateLessonShape(mixed);
    expect(shape.ok).toBe(false);
    const joined = shape.errors.join(" ");
    expect(joined).toContain("ext:ref-ordering@1");
    expect(joined).not.toContain("ext:al-categorization@1");
  });

  it("validateGeneratedLesson passes a well-formed categorization exercise", () => {
    expect(() => validateGeneratedLesson(categorizationLesson())).not.toThrow();
  });

  it("validateGeneratedLesson refuses a broken ext_payload (single bucket)", () => {
    const singleBucket = categorizationLesson({
      categories: [{ name: "Sichtzeichen", items: ["flache Hand"] }],
    });
    expect(() => validateGeneratedLesson(singleBucket)).toThrow(
      /at least 2 categories/,
    );
  });

  it("validateGeneratedLesson refuses a malformed ext_payload shape", () => {
    // A non-object ext_payload is already refused by the ajv layer; the
    // semantic layer owns everything INSIDE the opaque object.
    const malformed = categorizationLesson({categories: "nope"});
    expect(() => validateGeneratedLesson(malformed)).toThrow(/categories/);
  });
});


describe("adopted extension ext:al-error-correction (#1579, second adoption)", () => {
  const errorCorrectionLesson = (payloadOverride?: unknown) =>
    makeLesson({
      requires_extensions: ["ext:al-error-correction@1"],
      steps: [
        {
          id: "step-errcorr-01",
          type: "exercise",
          exercise: {
            id: "ex-errcorr-01",
            type: "ext:al-error-correction",
            prompt: "Ein Wort ist falsch - tippe es an und korrigiere es.",
            card_ids: ["card-01"],
            distractors: [],
            ext_payload:
              payloadOverride === undefined
                ? {
                    tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
                    error_index: 3,
                    accept: ["dem", "einem"],
                  }
                : payloadOverride,
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);

  it("the load guard accepts a lesson declaring the adopted extension", () => {
    const shape = validateLessonShape(errorCorrectionLesson());
    expect(shape.errors).toEqual([]);
    expect(shape.ok).toBe(true);
  });

  it("a lesson declaring BOTH adopted extensions loads", () => {
    const both = makeLesson({
      requires_extensions: [
        "ext:al-categorization@1",
        "ext:al-error-correction@1",
      ],
    } as Partial<ContentLesson>);
    expect(validateLessonShape(both).ok).toBe(true);
  });

  it("validateGeneratedLesson passes a well-formed error-correction exercise", () => {
    expect(() => validateGeneratedLesson(errorCorrectionLesson())).not.toThrow();
  });

  it("validateGeneratedLesson refuses a no-op accept entry", () => {
    const noop = errorCorrectionLesson({
      tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
      error_index: 3,
      accept: ["das"],
    });
    expect(() => validateGeneratedLesson(noop)).toThrow(
      /differ from the marked token/,
    );
  });

  it("validateGeneratedLesson refuses a malformed ext_payload shape", () => {
    const malformed = errorCorrectionLesson({tokens: ["a", "b"]});
    expect(() => validateGeneratedLesson(malformed)).toThrow(/accept/);
  });
});


describe("adopted extension ext:al-reading-comprehension (#1579, third adoption)", () => {
  const rcLesson = (payloadOverride?: unknown) =>
    makeLesson({
      requires_extensions: ["ext:al-reading-comprehension@1"],
      steps: [
        {
          id: "step-rc-01",
          type: "exercise",
          exercise: {
            id: "ex-rc-01",
            type: "ext:al-reading-comprehension",
            prompt: "Lies den Text und beantworte die Fragen.",
            card_ids: ["card-01"],
            distractors: [],
            ext_payload:
              payloadOverride === undefined
                ? {
                    passage: "Rex lief in den Garten und kam auf 'Hier' zurueck.",
                    questions: [
                      {
                        prompt: "Wohin lief Rex?",
                        type: "multiple_choice",
                        options: [
                          { text: "In den Garten", correct: true },
                          { text: "Auf die Strasse" },
                        ],
                      },
                      { prompt: "Wie hiess der Hund?", type: "free_text", accept: ["Rex"] },
                    ],
                  }
                : payloadOverride,
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);

  it("the load guard accepts a lesson declaring the adopted extension", () => {
    const shape = validateLessonShape(rcLesson());
    expect(shape.errors).toEqual([]);
    expect(shape.ok).toBe(true);
  });

  it("all three adopted extensions load together", () => {
    const all = makeLesson({
      requires_extensions: [
        "ext:al-categorization@1",
        "ext:al-error-correction@1",
        "ext:al-reading-comprehension@1",
      ],
    } as Partial<ContentLesson>);
    expect(validateLessonShape(all).ok).toBe(true);
  });

  it("validateGeneratedLesson passes a well-formed reading-comprehension exercise", () => {
    expect(() => validateGeneratedLesson(rcLesson())).not.toThrow();
  });

  it("validateGeneratedLesson refuses a payload with no questions", () => {
    const noQuestions = rcLesson({ passage: "Ein Text.", questions: [] });
    expect(() => validateGeneratedLesson(noQuestions)).toThrow(/at least 1 question/);
  });

  it("validateGeneratedLesson refuses a malformed ext_payload shape", () => {
    const malformed = rcLesson({ passage: "Ein Text." });
    expect(() => validateGeneratedLesson(malformed)).toThrow(/questions/);
  });
});


describe("adopted extension ext:al-graded-quiz (#1579, fourth adoption)", () => {
  const gqLesson = (payloadOverride?: unknown) =>
    makeLesson({
      requires_extensions: ["ext:al-graded-quiz@1"],
      steps: [
        {
          id: "step-gq-01",
          type: "exercise",
          exercise: {
            id: "ex-gq-01",
            type: "ext:al-graded-quiz",
            prompt: "Beantworte alle Fragen.",
            card_ids: ["card-01"],
            distractors: [],
            ext_payload:
              payloadOverride === undefined
                ? {
                    pass_threshold: 60,
                    questions: [
                      { prompt: "2+2?", type: "multiple_choice", options: [{ text: "4", correct: true }, { text: "5" }], points: 2 },
                      { prompt: "Synonym?", type: "free_text", accept: ["rasch"], points: 3 },
                    ],
                  }
                : payloadOverride,
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);

  it("the load guard accepts a lesson declaring the adopted extension", () => {
    const shape = validateLessonShape(gqLesson());
    expect(shape.errors).toEqual([]);
    expect(shape.ok).toBe(true);
  });

  it("all four adopted extensions load together", () => {
    const all = makeLesson({
      requires_extensions: [
        "ext:al-categorization@1",
        "ext:al-error-correction@1",
        "ext:al-reading-comprehension@1",
        "ext:al-graded-quiz@1",
      ],
    } as Partial<ContentLesson>);
    expect(validateLessonShape(all).ok).toBe(true);
  });

  it("validateGeneratedLesson passes a well-formed graded quiz", () => {
    expect(() => validateGeneratedLesson(gqLesson())).not.toThrow();
  });

  it("validateGeneratedLesson refuses a quiz with no questions", () => {
    expect(() => validateGeneratedLesson(gqLesson({ questions: [] }))).toThrow(/at least 1 question/);
  });

  it("validateGeneratedLesson refuses a non-positive points value", () => {
    const badPoints = gqLesson({ questions: [{ prompt: "x", type: "free_text", accept: ["a"], points: 0 }] });
    expect(() => validateGeneratedLesson(badPoints)).toThrow(/positive points/);
  });
});

describe("adopted extension ext:al-dictation (#1881, fifth adoption)", () => {
  const dictationExercise = {
    id: "ex-dict-01",
    type: "ext:al-dictation",
    prompt: "Hoere zu und schreibe, was du hoerst.",
    card_ids: [],
    distractors: [],
    ext_payload: {
      audio: "assets/audio/bonjour.mp3",
      accept: ["Bonjour", "bonjour"],
    },
  };

  const dictationLesson = (payloadOverride?: unknown) =>
    makeLesson({
      requires_extensions: ["ext:al-dictation@1"],
      steps: [
        {
          id: "step-dict-01",
          type: "exercise",
          exercise: {
            ...dictationExercise,
            ...(payloadOverride === undefined
              ? {}
              : { ext_payload: payloadOverride }),
          },
        },
      ],
    } as unknown as Partial<ContentLesson>);

  it("the load guard accepts a lesson declaring the adopted extension", () => {
    const shape = validateLessonShape(dictationLesson());
    expect(shape.errors).toEqual([]);
    expect(shape.ok).toBe(true);
  });

  it("validateGeneratedLesson passes a well-formed dictation exercise", () => {
    expect(() => validateGeneratedLesson(dictationLesson())).not.toThrow();
  });

  it("validateGeneratedLesson refuses an empty audio reference", () => {
    const noAudio = dictationLesson({ audio: "", accept: ["Bonjour"] });
    expect(() => validateGeneratedLesson(noAudio)).toThrow(/audio/);
  });

  it("validateGeneratedLesson refuses an accept list with no non-empty entry", () => {
    const noAccept = dictationLesson({ audio: "a.mp3", accept: ["", "  "] });
    expect(() => validateGeneratedLesson(noAccept)).toThrow(/accept/);
  });
});
