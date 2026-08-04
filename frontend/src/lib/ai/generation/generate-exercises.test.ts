import { describe, expect, it, vi } from "vitest";

import { generateExercises, type AiProvider } from "./generate-exercises";
import type { TheoryStep } from "./exercise-generation-prompt";

const STEPS: TheoryStep[] = [
  { id: "s1", title: "Module", body: "Wähle das Modul: file, copy, service." },
  { id: "s2", title: "Hosts", body: "'all' spricht alle Hosts an." },
];

const GOOD_REPLY = JSON.stringify({
  cards: [
    {
      type: "matching",
      question: "Match.",
      pairs: [
        { left: "file", right: "files" },
        { left: "copy", right: "copy" },
        { left: "service", right: "services" },
      ],
    },
    { type: "cloze", question: "hosts: ___", answer: "all", distractors: ["one"] },
    { type: "free_text", question: "Why?", accepts: ["because"] },
  ],
});

/** A mock provider that records calls and returns a canned reply. The
 *  underlying ``vi.fn`` is returned alongside so tests can inspect
 *  ``.mock.calls`` (the {@link AiProvider} type erases the mock shape). */
function mockProvider(reply: string) {
  const complete = vi.fn(async (_prompt: string, _opts?: unknown) => reply);
  const provider: AiProvider = { complete };
  const lastPrompt = () => complete.mock.calls.at(-1)?.[0] ?? null;
  const lastOpts = () => complete.mock.calls.at(-1)?.[1] as
    | { maxTokens?: number; signal?: AbortSignal }
    | undefined;
  return { provider, complete, lastPrompt, lastOpts };
}

describe("generateExercises", () => {
  it("runs the full pipeline against a mock provider", async () => {
    const m = mockProvider(GOOD_REPLY);
    const result = await generateExercises(STEPS, m.provider);

    expect(m.complete).toHaveBeenCalledOnce();
    expect(m.lastPrompt()).toContain("file, copy, service");
    expect(result.cards.map((c) => c.type)).toEqual(["matching", "cloze", "free_text"]);
    expect(result.skipped).toBe(0);
  });

  it("forwards language + maxCards into the prompt and maxTokens to the provider", async () => {
    const m = mockProvider(GOOD_REPLY);
    await generateExercises(STEPS, m.provider, { language: "de", maxCards: 4 });
    expect(m.lastPrompt()).toContain("(de)");
    expect(m.lastPrompt()).toMatch(/at most 4/);
    expect(m.lastOpts()?.maxTokens).toBeGreaterThan(0);
  });

  it("short-circuits with an error when there are no theory steps", async () => {
    const m = mockProvider(GOOD_REPLY);
    const result = await generateExercises([], m.provider);
    expect(m.complete).not.toHaveBeenCalled();
    expect(result.cards).toEqual([]);
    expect(result.errors[0]).toMatch(/no theory steps/);
  });

  it("degrades gracefully when the provider returns garbage", async () => {
    const m = mockProvider("sorry, I can't do that");
    const result = await generateExercises(STEPS, m.provider);
    expect(result.cards).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("propagates a provider transport error", async () => {
    const provider: AiProvider = {
      complete: vi.fn(async () => {
        throw new Error("401 Unauthorized");
      }),
    };
    await expect(generateExercises(STEPS, provider)).rejects.toThrow("401 Unauthorized");
  });

  it("passes an AbortSignal through to the provider", async () => {
    const m = mockProvider(GOOD_REPLY);
    const controller = new AbortController();
    await generateExercises(STEPS, m.provider, { signal: controller.signal });
    expect(m.lastOpts()?.signal).toBe(controller.signal);
  });
});

describe("generateExercises — text extensions (#2355)", () => {
  const REPLY_WITH_EXTENSIONS = JSON.stringify({
    cards: [
      { type: "cloze", question: "hosts: ___", answer: "all", distractors: ["one"] },
      {
        type: "ext:al-categorization",
        question: "Sort the terms.",
        categories: [
          { name: "Modules", items: ["copy", "service"] },
          { name: "Concepts", items: ["idempotence"] },
        ],
      },
      {
        type: "ext:al-reading-comprehension",
        question: "Read and answer.",
        passage: "Ansible is agentless and runs tasks over SSH.",
        questions: [
          { prompt: "How does it connect?", type: "free_text", accept: ["over SSH"] },
        ],
      },
      {
        type: "ext:al-reading-comprehension",
        question: "A second passage — should be dropped by the budget.",
        passage: "Another passage that is long enough to read.",
        questions: [
          { prompt: "Q?", type: "free_text", accept: ["a"] },
        ],
      },
    ],
  });

  it("passes extension cards through the pipeline and applies the budget cap", async () => {
    const m = mockProvider(REPLY_WITH_EXTENSIONS);
    const result = await generateExercises(STEPS, m.provider);
    const types = result.cards.map((c) => c.type);
    expect(types).toContain("ext:al-categorization");
    // Budget: at most one reading-comprehension survives.
    expect(types.filter((t) => t === "ext:al-reading-comprehension")).toHaveLength(1);
    expect(types).toContain("cloze");
  });
});
