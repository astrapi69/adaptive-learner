/**
 * AIX-01 (EXP-036) — orchestration: theory steps -> AI -> validated cards.
 *
 * Ties the prompt builder and the defensive parser together behind a
 * provider SEAM, so the engine is storage-mode-agnostic: the Dexie
 * (browser-direct) path and the API (backend) path each inject their own
 * ``AiProvider``. That seam is also what makes the engine unit-testable
 * with a mock provider — no real network call.
 *
 * Library-grade: ``generateExercises`` imports no app state and no
 * provider code. ``browserDirectProvider`` is a thin, opt-in adapter over
 * the existing ``aiComplete`` (EXP-036 "reuse existing infrastructure,
 * no new AI-provider code") that the Dexie caller can use; the engine
 * itself never reaches for it.
 */

import { aiComplete } from "../../storage/ai-providers";
import type { AIProvider } from "../constants";
import {
  buildExerciseGenerationPrompt,
  type ExercisePromptOptions,
  type TheoryStep,
} from "./exercise-generation-prompt";
import {
  parseGeneratedExercises,
  type ExerciseGenerationParseResult,
} from "./exercise-generation-parser";

/** Options accepted when an {@link AiProvider} runs a completion. */
export interface AiCompleteOptions {
  /** Abort the underlying call (wired to a Cancel control upstream). */
  signal?: AbortSignal;
  /** Hard cap on the reply length. */
  maxTokens?: number;
}

/**
 * The AI seam the generator calls. A real implementation wraps a
 * provider (browser-direct or backend); tests pass a mock. Returns the
 * model's raw text reply.
 */
export interface AiProvider {
  complete(prompt: string, options?: AiCompleteOptions): Promise<string>;
}

/** Options for {@link generateExercises}. */
export interface GenerateExercisesOptions extends ExercisePromptOptions {
  /** Forwarded to the provider so a long generation can be cancelled. */
  signal?: AbortSignal;
}

/** Reply length cap for an exercise-generation call (~8 cards of JSON). */
const GENERATION_MAX_TOKENS = 2000;

/** Outcome of a generation run: the validated cards plus parse stats. */
export type ExerciseGenerationResult = ExerciseGenerationParseResult;

/**
 * Generate exercises from a lesson's theory steps.
 *
 * Builds the prompt, calls the injected provider, and runs the reply
 * through the defensive parser. Never throws on bad AI output — a
 * malformed reply surfaces as ``{ cards: [], skipped, errors }``. A
 * provider that itself throws (transport/auth) propagates, so the caller
 * can show a precise error.
 *
 * @param theorySteps - The lesson's theory steps (prose context).
 * @param provider - The AI seam (browser-direct, backend, or a mock).
 * @param options - Language / card-count / abort overrides.
 * @returns Validated cards plus skip count and parser errors.
 */
export async function generateExercises(
  theorySteps: TheoryStep[],
  provider: AiProvider,
  options: GenerateExercisesOptions = {},
): Promise<ExerciseGenerationResult> {
  if (theorySteps.length === 0) {
    return { cards: [], skipped: 0, errors: ["no theory steps to generate from"] };
  }
  const prompt = buildExerciseGenerationPrompt(theorySteps, {
    language: options.language,
    maxCards: options.maxCards,
  });
  const raw = await provider.complete(prompt, {
    signal: options.signal,
    maxTokens: GENERATION_MAX_TOKENS,
  });
  return parseGeneratedExercises(raw);
}

/**
 * Adapter: build an {@link AiProvider} that calls a provider
 * browser-direct via the existing ``aiComplete`` (Dexie mode). The
 * caller resolves provider/model/key from IndexedDB settings — exactly
 * like ``content-loader-dexie-ai.ts`` — and passes them here. No new
 * provider code; this only wires the seam.
 */
export function browserDirectProvider(config: {
  provider: AIProvider;
  model: string;
  apiKey: string;
}): AiProvider {
  return {
    complete: (prompt, runOptions) =>
      aiComplete({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        messages: [{ role: "user", content: prompt }],
        maxTokens: runOptions?.maxTokens,
        signal: runOptions?.signal,
      }),
  };
}
