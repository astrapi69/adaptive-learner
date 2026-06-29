import { describe, it, expect, vi } from "vitest";

import {
  runCardValidation,
  TooManyCardsError,
  MAX_CARDS_PER_RUN,
  type BatchCompletion,
} from "./validation-runner";
import type { ValidationCard } from "./content-validator";

function makeCards(n: number): ValidationCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    front: `front-${i}`,
    back: `back-${i}`,
  }));
}

/** A completer that replies "all OK" for every card in the prompt. */
function okCompleter() {
  return vi.fn(async (prompt: string): Promise<BatchCompletion> => {
    const ids = [...prompt.matchAll(/"card_id":\s*"([^"]+)"/g)]
      .map((m) => m[1])
      .filter((id) => id.startsWith("card-"));
    const results = ids.map((id) => ({ card_id: id, ok: true, issues: [] }));
    return { text: JSON.stringify(results), responseId: `chatcmpl-${ids[0]}` };
  });
}

describe("runCardValidation", () => {
  it("splits into batches and aggregates results across them", async () => {
    const complete = okCompleter();
    const out = await runCardValidation({
      cards: makeCards(25),
      sourceLanguage: "de",
      targetLanguage: "es",
      level: "A1",
      complete,
    });
    expect(complete).toHaveBeenCalledTimes(3); // 10 + 10 + 5
    expect(out.results).toHaveLength(25);
    expect(out.checkedCards).toBe(25);
    expect(out.issueCount).toBe(0);
    expect(out.responseIds).toHaveLength(3);
  });

  it("reports per-batch progress", async () => {
    const onProgress = vi.fn();
    await runCardValidation({
      cards: makeCards(12),
      sourceLanguage: "de",
      targetLanguage: "es",
      level: "A1",
      complete: okCompleter(),
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 2 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 2 });
  });

  it("counts cards with issues", async () => {
    const complete = vi.fn(async (): Promise<BatchCompletion> => ({
      text: JSON.stringify([
        { card_id: "card-0", ok: true, issues: [] },
        {
          card_id: "card-1",
          ok: false,
          issues: [{ field: "front", problem: "p", suggestion: "s" }],
        },
      ]),
    }));
    const out = await runCardValidation({
      cards: makeCards(2),
      sourceLanguage: "de",
      targetLanguage: "es",
      level: "A1",
      complete,
    });
    expect(out.issueCount).toBe(1);
  });

  it("rejects a run over the per-run card cap", async () => {
    await expect(
      runCardValidation({
        cards: makeCards(MAX_CARDS_PER_RUN + 1),
        sourceLanguage: "de",
        targetLanguage: "es",
        level: "A1",
        complete: okCompleter(),
      }),
    ).rejects.toBeInstanceOf(TooManyCardsError);
  });

  it("aborts when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runCardValidation({
        cards: makeCards(5),
        sourceLanguage: "de",
        targetLanguage: "es",
        level: "A1",
        complete: okCompleter(),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
