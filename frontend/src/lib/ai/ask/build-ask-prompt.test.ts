/**
 * Tests for buildAskAiMessages (#1321).
 */

import { describe, expect, it } from "vitest";

import { buildAskAiMessages, type AskAiContext } from "./build-ask-prompt";

const theory: AskAiContext = {
  kind: "theory",
  blockText: "The passé composé uses avoir or être plus a participle.",
  targetLanguage: "fr",
  sourceLanguage: "de",
  uiLanguage: "de",
};

describe("buildAskAiMessages", () => {
  it("scopes a system message to the block and carries its text", () => {
    const msgs = buildAskAiMessages(theory, "Explain with an example");
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("theory block");
    expect(msgs[0].content).toContain("passé composé uses avoir");
    // The learner's languages + UI language are conveyed to the model.
    expect(msgs[0].content).toContain("fr");
    expect(msgs[0].content).toContain("de");
  });

  it("puts the learner's question as the trailing user message", () => {
    const msgs = buildAskAiMessages(theory, "  Explain with an example  ");
    const last = msgs[msgs.length - 1];
    expect(last).toEqual({ role: "user", content: "Explain with an example" });
  });

  it("labels an exercise block distinctly from theory", () => {
    const msgs = buildAskAiMessages(
      { kind: "exercise", blockText: "Match the words", uiLanguage: "en" },
      "Why is this wrong?",
    );
    expect(msgs[0].content).toContain("exercise");
    expect(msgs[0].content).not.toContain("theory block");
  });

  it("includes prior turns (follow-up) between system and the new question", () => {
    const history = [
      { role: "user" as const, content: "What is it?" },
      { role: "assistant" as const, content: "A past tense." },
    ];
    const msgs = buildAskAiMessages(theory, "Give another example", history);
    expect(msgs.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(msgs[2].content).toBe("A past tense.");
  });

  it("clamps an oversized block so the context stays data-sparse", () => {
    const huge = "x".repeat(9000);
    const msgs = buildAskAiMessages(
      { kind: "theory", blockText: huge, uiLanguage: "en" },
      "?",
    );
    // 4000-char cap + the ellipsis, well under the raw 9000.
    expect(msgs[0].content).toContain("…");
    expect(msgs[0].content.length).toBeLessThan(5000);
  });

  it("prefers the domain as the subject for non-language content", () => {
    const msgs = buildAskAiMessages(
      { kind: "theory", blockText: "def f(): pass", domain: "programming", uiLanguage: "en" },
      "?",
    );
    expect(msgs[0].content).toContain("programming");
  });
});
