/**
 * EXP-033 / AIV-02 — batched validation orchestration (pure).
 *
 * Given a flat list of cards + a completion function, this runs the cards
 * through the provider in batches of {@link VALIDATION_BATCH_SIZE},
 * reporting per-batch progress and aggregating the per-card results. It is
 * provider-agnostic: the caller injects ``complete`` (Dexie passes a
 * browser-direct ``aiComplete``-backed closure), so the orchestration is
 * unit-testable with a fake completer and never touches the network here.
 *
 * Cost guards (EXP-033 §3.3): at most {@link MAX_CARDS_PER_RUN} cards per
 * run. The 1-per-minute rate limit is enforced at the call site (it needs
 * persistent state), not here.
 */

import {
  buildValidationPrompt,
  parseValidationResponse,
  splitIntoBatches,
  type ValidationCard,
  type ValidationResult,
} from "./content-validator";

/** Hard cap on cards per run (EXP-033 §3.3 — 500 cards = 50 calls). */
export const MAX_CARDS_PER_RUN = 500;

/** Thrown when a run would exceed {@link MAX_CARDS_PER_RUN}. */
export class TooManyCardsError extends Error {
  constructor(
    public readonly cardCount: number,
    public readonly limit: number = MAX_CARDS_PER_RUN,
  ) {
    super(`Too many cards for one run: ${cardCount} > ${limit}`);
    this.name = "TooManyCardsError";
  }
}

/** Progress event emitted before each batch is sent. */
export interface ValidationProgress {
  current: number;
  total: number;
}

/** What the injected completer returns for one batch. */
export interface BatchCompletion {
  text: string;
  /** Provider response id (OpenAI ``chatcmpl-…`` / Anthropic ``msg_…``),
   *  collected for the AIV-09 signature. Optional — undefined is fine. */
  responseId?: string;
}

export interface RunCardValidationOptions {
  cards: ValidationCard[];
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  /** Sends ONE batch prompt to the provider and returns its reply. */
  complete: (prompt: string, signal?: AbortSignal) => Promise<BatchCompletion>;
  /** Called once per batch, just before it is sent. */
  onProgress?: (progress: ValidationProgress) => void;
  signal?: AbortSignal;
}

export interface RunCardValidationResult {
  /** One entry per card the model flagged or confirmed. Cards the model
   *  omitted are absent (treated as OK by the caller). */
  results: ValidationResult[];
  /** Provider response ids gathered across batches (for the signature). */
  responseIds: string[];
  /** Number of cards submitted (after the cap check). */
  checkedCards: number;
  /** Number of cards with at least one issue. */
  issueCount: number;
}

/**
 * Run the cards through the provider in batches.
 *
 * @throws TooManyCardsError when ``cards.length`` exceeds the per-run cap.
 * @throws the completer's error (e.g. ``ApiError``) — the caller surfaces it.
 */
export async function runCardValidation(
  opts: RunCardValidationOptions,
): Promise<RunCardValidationResult> {
  if (opts.cards.length > MAX_CARDS_PER_RUN) {
    throw new TooManyCardsError(opts.cards.length);
  }
  const batches = splitIntoBatches(opts.cards);
  const results: ValidationResult[] = [];
  const responseIds: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    opts.onProgress?.({ current: i + 1, total: batches.length });
    const prompt = buildValidationPrompt(
      batches[i],
      opts.sourceLanguage,
      opts.targetLanguage,
      opts.level,
    );
    const completion = await opts.complete(prompt, opts.signal);
    const parsed = parseValidationResponse(completion.text);
    results.push(...parsed);
    if (completion.responseId) responseIds.push(completion.responseId);
  }
  const issueCount = results.filter((r) => !r.ok).length;
  return {
    results,
    responseIds,
    checkedCards: opts.cards.length,
    issueCount,
  };
}
