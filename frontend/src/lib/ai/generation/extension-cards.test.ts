/**
 * #2355 — tests for the text-extension half of the generation pipeline.
 */

import { describe, expect, it } from "vitest";

import {
  buildExtensionCard,
  capExtensionCards,
  extensionPayloadErrors,
  isExtensionCard,
  isTextExtensionType,
  TEXT_EXTENSION_TYPES,
  type ExtensionCard,
  CATEGORIZATION_EXT_TYPE,
  ERROR_CORRECTION_EXT_TYPE,
  READING_COMPREHENSION_EXT_TYPE,
  GRADED_QUIZ_EXT_TYPE,
} from "./extension-cards";

describe("isTextExtensionType", () => {
  it("recognises the four text extensions and rejects core / media types", () => {
    for (const type of TEXT_EXTENSION_TYPES) expect(isTextExtensionType(type)).toBe(true);
    expect(isTextExtensionType("matching")).toBe(false);
    expect(isTextExtensionType("multiple_choice")).toBe(false);
    expect(isTextExtensionType("ext:al-dictation")).toBe(false);
    expect(isTextExtensionType("ext:al-image-description")).toBe(false);
  });
});

describe("buildExtensionCard — reading-comprehension", () => {
  it("shapes passage + sub-questions into ext_payload and passes its validator", () => {
    const card = buildExtensionCard(
      {
        passage: "Ansible runs tasks over SSH. It is agentless.",
        questions: [
          {
            prompt: "How does Ansible connect?",
            type: "multiple_choice",
            options: [
              { text: "over SSH", correct: true },
              { text: "via an agent", correct: false },
            ],
          },
          {
            prompt: "What does agentless mean?",
            type: "free_text",
            accept: ["no agent installed on the host"],
          },
        ],
      },
      READING_COMPREHENSION_EXT_TYPE,
      "Read the passage and answer.",
    );
    expect(typeof card).not.toBe("string");
    if (typeof card === "string") throw new Error(card);
    expect(card.type).toBe(READING_COMPREHENSION_EXT_TYPE);
    expect(card.ext_payload.passage).toContain("agentless");
    expect(extensionPayloadErrors(card)).toEqual([]);
  });

  it("tolerates the is_correct alias on sub-question options", () => {
    const card = buildExtensionCard(
      {
        passage: "A passage long enough to read.",
        questions: [
          {
            prompt: "Pick one.",
            type: "multiple_choice",
            options: [
              { text: "right", is_correct: true },
              { text: "wrong", is_correct: false },
            ],
          },
        ],
      },
      READING_COMPREHENSION_EXT_TYPE,
      "Q",
    ) as ExtensionCard;
    expect(extensionPayloadErrors(card)).toEqual([]);
  });
});

describe("buildExtensionCard — graded-quiz", () => {
  it("carries points + pass_threshold and validates", () => {
    const card = buildExtensionCard(
      {
        pass_threshold: 60,
        questions: [
          {
            prompt: "Which are modules?",
            type: "multiple_choice",
            options: [
              { text: "copy", correct: true },
              { text: "banana", correct: false },
            ],
            points: 2,
          },
        ],
      },
      GRADED_QUIZ_EXT_TYPE,
      "End-of-lesson quiz",
    ) as ExtensionCard;
    expect((card.ext_payload as { pass_threshold?: number }).pass_threshold).toBe(60);
    expect(extensionPayloadErrors(card)).toEqual([]);
  });

  it("normalizes an omitted pass_threshold to a real passing bar (#2364)", () => {
    const card = buildExtensionCard(
      {
        questions: [
          { prompt: "Q?", type: "free_text", accept: ["a"], points: 1 },
        ],
      },
      GRADED_QUIZ_EXT_TYPE,
      "Quiz",
    ) as ExtensionCard;
    expect((card.ext_payload as { pass_threshold?: number }).pass_threshold).toBe(60);
  });

  it("normalizes a trivially-passable pass_threshold of 0 to a real bar (#2364)", () => {
    const card = buildExtensionCard(
      {
        pass_threshold: 0,
        questions: [{ prompt: "Q?", type: "free_text", accept: ["a"], points: 1 }],
      },
      GRADED_QUIZ_EXT_TYPE,
      "Quiz",
    ) as ExtensionCard;
    expect((card.ext_payload as { pass_threshold?: number }).pass_threshold).toBe(60);
  });

  it("keeps a valid positive pass_threshold as authored (#2364)", () => {
    const card = buildExtensionCard(
      {
        pass_threshold: 75,
        questions: [{ prompt: "Q?", type: "free_text", accept: ["a"], points: 1 }],
      },
      GRADED_QUIZ_EXT_TYPE,
      "Quiz",
    ) as ExtensionCard;
    expect((card.ext_payload as { pass_threshold?: number }).pass_threshold).toBe(75);
  });

  it("defaults missing points to 1 so the quiz still validates", () => {
    const card = buildExtensionCard(
      {
        questions: [
          { prompt: "Define X.", type: "free_text", accept: ["the X definition"] },
        ],
      },
      GRADED_QUIZ_EXT_TYPE,
      "Quiz",
    ) as ExtensionCard;
    expect(extensionPayloadErrors(card)).toEqual([]);
  });
});

describe("buildExtensionCard — categorization", () => {
  it("shapes categories and validates", () => {
    const card = buildExtensionCard(
      {
        categories: [
          { name: "Modules", items: ["copy", "service"] },
          { name: "Concepts", items: ["idempotence"] },
        ],
      },
      CATEGORIZATION_EXT_TYPE,
      "Sort the terms.",
    ) as ExtensionCard;
    expect(extensionPayloadErrors(card)).toEqual([]);
  });
});

describe("buildExtensionCard — error-correction", () => {
  it("shapes tokens/error_index/accept and validates", () => {
    const card = buildExtensionCard(
      {
        tokens: ["Ansible", "needs", "an", "agent"],
        error_index: 2,
        accept: ["no"],
      },
      ERROR_CORRECTION_EXT_TYPE,
      "Fix the wrong word.",
    ) as ExtensionCard;
    expect(extensionPayloadErrors(card)).toEqual([]);
  });
});

describe("buildExtensionCard — rejection paths", () => {
  it("returns an error string for a non-text-extension type", () => {
    expect(buildExtensionCard({}, "ext:al-dictation", "q")).toMatch(/unsupported extension/i);
    expect(buildExtensionCard({}, "matching", "q")).toMatch(/unsupported extension/i);
  });

  it("builds a card even for garbage, but the payload validator flags it", () => {
    const card = buildExtensionCard(
      { passage: "", questions: [] },
      READING_COMPREHENSION_EXT_TYPE,
      "q",
    ) as ExtensionCard;
    expect(extensionPayloadErrors(card).length).toBeGreaterThan(0);
  });
});

describe("isExtensionCard", () => {
  it("narrows a generated card by its ext type", () => {
    const ext: ExtensionCard = {
      type: CATEGORIZATION_EXT_TYPE,
      question: "q",
      ext_payload: {},
    };
    expect(isExtensionCard(ext)).toBe(true);
    expect(isExtensionCard({ type: "matching" })).toBe(false);
  });
});

describe("capExtensionCards — separate budget (#2355)", () => {
  const ext = (type: (typeof TEXT_EXTENSION_TYPES)[number]): ExtensionCard => ({
    type,
    question: `q-${type}-${Math.random}`,
    ext_payload: {},
  });

  it("keeps at most one reading-comprehension per lesson", () => {
    const cards = [
      ext(READING_COMPREHENSION_EXT_TYPE),
      ext(READING_COMPREHENSION_EXT_TYPE),
      ext(READING_COMPREHENSION_EXT_TYPE),
    ];
    const { cards: kept, dropped } = capExtensionCards(cards);
    expect(kept).toHaveLength(1);
    expect(dropped).toBe(2);
  });

  it("keeps at most one graded-quiz", () => {
    const cards = [ext(GRADED_QUIZ_EXT_TYPE), ext(GRADED_QUIZ_EXT_TYPE)];
    expect(capExtensionCards(cards).cards).toHaveLength(1);
  });

  it("keeps per-type budgets independently (first-seen order)", () => {
    const cards = [
      ext(READING_COMPREHENSION_EXT_TYPE),
      ext(CATEGORIZATION_EXT_TYPE),
      ext(CATEGORIZATION_EXT_TYPE),
      ext(CATEGORIZATION_EXT_TYPE),
      ext(ERROR_CORRECTION_EXT_TYPE),
    ];
    const kept = capExtensionCards(cards).cards.map((c) => c.type);
    expect(kept.filter((t) => t === CATEGORIZATION_EXT_TYPE)).toHaveLength(2);
    expect(kept.filter((t) => t === READING_COMPREHENSION_EXT_TYPE)).toHaveLength(1);
    expect(kept.filter((t) => t === ERROR_CORRECTION_EXT_TYPE)).toHaveLength(1);
  });
});
