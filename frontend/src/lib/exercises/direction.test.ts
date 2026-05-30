/**
 * EXP-018 / Phase 62 — exercise direction helpers.
 */

import {describe, expect, it} from "vitest";

import {
  instructionKey,
  resolveConcreteDirection,
  resolveDirectionDisplay,
} from "./direction";

describe("resolveConcreteDirection", () => {
  it("passes concrete values through", () => {
    expect(resolveConcreteDirection("source_to_target", "ex")).toBe(
      "source_to_target",
    );
    expect(resolveConcreteDirection("target_to_source", "ex")).toBe(
      "target_to_source",
    );
  });

  it("defaults undefined / unknown to receptive", () => {
    expect(resolveConcreteDirection(undefined, "ex")).toBe("target_to_source");
    expect(resolveConcreteDirection(null, "ex")).toBe("target_to_source");
    expect(resolveConcreteDirection("sideways", "ex")).toBe("target_to_source");
  });

  it("resolves both/random deterministically per exercise id", () => {
    const a1 = resolveConcreteDirection("random", "ex-alpha");
    const a2 = resolveConcreteDirection("random", "ex-alpha");
    expect(a1).toBe(a2); // stable for the same id
    const both = resolveConcreteDirection("both", "ex-alpha");
    expect(both).toBe(a1); // both + random share the hash pick
    // Some id resolves to productive (coverage of the other branch).
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const dirs = new Set(ids.map((id) => resolveConcreteDirection("random", id)));
    expect(dirs.size).toBe(2);
  });
});

describe("resolveDirectionDisplay", () => {
  it("receptive shows target, recognises source", () => {
    const d = resolveDirectionDisplay("Bonjour", "Hello", "target_to_source");
    expect(d).toEqual({
      prompt: "Bonjour",
      answer: "Hello",
      promptLang: "target",
      answerLang: "source",
    });
  });

  it("productive shows source, produces target", () => {
    const d = resolveDirectionDisplay("Bonjour", "Hello", "source_to_target");
    expect(d).toEqual({
      prompt: "Hello",
      answer: "Bonjour",
      promptLang: "source",
      answerLang: "target",
    });
  });
});

describe("instructionKey", () => {
  it("maps direction to the receptive/productive catalog key", () => {
    expect(instructionKey("matching", "target_to_source")).toBe(
      "lesson.exercise.instruction.matching.receptive",
    );
    expect(instructionKey("free_text", "source_to_target")).toBe(
      "lesson.exercise.instruction.free_text.productive",
    );
  });
});
