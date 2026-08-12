/**
 * element-identity — the identity-preferring counterpart to element-keys
 * (engine#91 element-level stable_id).
 *
 * elementKeysOf() stays the canonical/DISPLAY rule: for cloze and
 * multiple_choice its output is also written as the learner-facing
 * ``correct_answer``, so it must never surface an opaque id. This module's
 * elementIdentityKeysOf() is a SEPARATE rule used only where the key
 * addresses storage or a comparison: prefer a pair/blank/option's own
 * stable_id, fall back to the canonical text elementKeysOf() already
 * computes. For every type without a per-element identity concept the two
 * must agree exactly - that parity is asserted below, not assumed.
 */

import { describe, expect, it } from "vitest";
import { elementKeysOf } from "./element-keys";
import { elementIdentityKeysOf } from "./element-identity";
import type { ContentLessonExercise } from "../../storage/types";

/** Minimal exercise carrying only what the key rule reads. */
function ex(partial: Partial<ContentLessonExercise>): ContentLessonExercise {
  return {
    id: "ex-1",
    prompt: "p",
    card_ids: [],
    distractors: [],
    ...partial,
  } as ContentLessonExercise;
}

describe("elementIdentityKeysOf — matching", () => {
  it("prefers a pair's stable_id when present", () => {
    const matching = ex({
      type: "matching",
      pairs: [
        { left: "merci", right: "danke", stable_id: "pair-aaaa0001" },
        { left: "bonjour", right: "guten Tag" },
      ],
    });
    expect(elementIdentityKeysOf(matching)).toEqual(["pair-aaaa0001", "bonjour"]);
  });

  it("falls back to elementKeysOf's canonical text when stable_id is absent on every pair", () => {
    const matching = ex({
      type: "matching",
      pairs: [{ left: "merci", right: "danke" }],
    });
    expect(elementIdentityKeysOf(matching)).toEqual(elementKeysOf(matching));
  });
});

describe("elementIdentityKeysOf — cloze", () => {
  it("prefers a blank's stable_id in type/select mode", () => {
    const cloze = ex({
      type: "cloze",
      sentence: "Je ___ ici et ___ content.",
      blanks: [{ accept: ["suis"], stable_id: "blank-aaaa0001" }, { accept: ["tres"] }],
    });
    expect(elementIdentityKeysOf(cloze)).toEqual(["blank-aaaa0001", "tres"]);
  });

  it("boundary: multiselect mode ignores blank stable_id (its key is built from exercise.accept, not blanks[])", () => {
    const multiselect = ex({
      type: "cloze",
      cloze_mode: "multiselect",
      sentence: "Welche sind Verben?",
      accept: ["laufen", "essen"],
      blanks: [{ accept: ["laufen"], stable_id: "blank-aaaa0001" }],
    });
    expect(elementIdentityKeysOf(multiselect)).toEqual(elementKeysOf(multiselect));
  });
});

describe("elementIdentityKeysOf — multiple_choice", () => {
  it("substitutes stable_id per correct option, still one collapsed key", () => {
    const mc = ex({
      type: "multiple_choice",
      options: [
        { text: "un", correct: true, stable_id: "opt-aaaa0001" },
        { text: "deux", correct: false },
        { text: "trois", correct: true },
      ],
    });
    // sorted join of the two correct options' identities: "opt-aaaa0001" then "trois"
    expect(elementIdentityKeysOf(mc)).toEqual([["opt-aaaa0001", "trois"].sort().join(", ")]);
    expect(elementIdentityKeysOf(mc)).toHaveLength(1);
  });

  it("falls back to canonical text when no correct option has a stable_id", () => {
    const mc = ex({
      type: "multiple_choice",
      options: [
        { text: "un", correct: true },
        { text: "trois", correct: true },
      ],
    });
    expect(elementIdentityKeysOf(mc)).toEqual(elementKeysOf(mc));
  });

  it("partial minting still helps: only the minted option's identity is substituted", () => {
    const mintedFirst = ex({
      type: "multiple_choice",
      options: [
        { text: "un", correct: true, stable_id: "opt-aaaa0001" },
        { text: "trois", correct: true },
      ],
    });
    const key = elementIdentityKeysOf(mintedFirst);
    expect(key).toEqual([["opt-aaaa0001", "trois"].sort().join(", ")]);
    // Correcting the un-minted option's text still changes the key...
    const correctedUnminted = ex({
      type: "multiple_choice",
      options: [
        { text: "un", correct: true, stable_id: "opt-aaaa0001" },
        { text: "trois corrige", correct: true },
      ],
    });
    expect(elementIdentityKeysOf(correctedUnminted)).not.toEqual(key);
    // ...but correcting the MINTED option's text does not move the key.
    const correctedMinted = ex({
      type: "multiple_choice",
      options: [
        { text: "un corrige", correct: true, stable_id: "opt-aaaa0001" },
        { text: "trois", correct: true },
      ],
    });
    expect(elementIdentityKeysOf(correctedMinted)).toEqual(key);
  });
});

describe("elementIdentityKeysOf — pass-through for types with no element-level identity", () => {
  it("free_text: identical to elementKeysOf", () => {
    const freeText = ex({ type: "free_text", accept: ["Merci", "merci beaucoup"] });
    expect(elementIdentityKeysOf(freeText)).toEqual(elementKeysOf(freeText));
  });

  it("word_tiles: identical to elementKeysOf", () => {
    const wordTiles = ex({ type: "word_tiles", tiles: ["je", "suis", "ici"] });
    expect(elementIdentityKeysOf(wordTiles)).toEqual(elementKeysOf(wordTiles));
  });

  it("picture_choice: identical to elementKeysOf", () => {
    const pictureChoice = ex({
      type: "picture_choice",
      images: [{ label: "le chat", is_correct: "true", src: "a.png" }],
    });
    expect(elementIdentityKeysOf(pictureChoice)).toEqual(elementKeysOf(pictureChoice));
  });
});

describe("elementIdentityKeysOf fails closed on an unknown type, same as elementKeysOf", () => {
  it("returns null for an undeclared ext: type", () => {
    expect(elementIdentityKeysOf(ex({ type: "ext:acme-ordering" }))).toBeNull();
  });

  it("returns null for a missing type", () => {
    expect(elementIdentityKeysOf(ex({}))).toBeNull();
  });
});
