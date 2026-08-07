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

import { aiComplete } from "../../../storage/ai/ai-providers";
import type { AIProvider } from "../../constants";
import {
  buildExerciseGenerationPrompt,
  type ExercisePromptOptions,
  type TheoryStep,
} from "./exercise-generation-prompt";
import {
  parseGeneratedExercises,
  type ExerciseGenerationParseResult,
  type GeneratedCard,
  type ValidCard,
} from "./exercise-generation-parser";
import {
  validateExerciseQuality,
  type QualityWarning,
} from "./exercise-quality-gate";
import { balanceExercises } from "./exercise-distribution";
import { capExtensionCards, isExtensionCard } from "./extension-cards";

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

/**
 * Outcome of a generation run. ``cards`` are the parser-valid cards that
 * ALSO passed the AIX-03 content quality gate; ``skipped`` is the parser's
 * structural skip count; ``rejected`` are the cards the quality gate
 * dropped; ``warnings`` are the gate's non-fatal flags.
 */
export interface ExerciseGenerationResult extends ExerciseGenerationParseResult {
  /** AIX-03 — cards dropped by the content quality gate. */
  rejected: GeneratedCard[];
  /** AIX-03 — non-fatal quality warnings on the passed set. */
  warnings: QualityWarning[];
}

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
    return {
      cards: [],
      skipped: 0,
      errors: ["no theory steps to generate from"],
      rejected: [],
      warnings: [],
    };
  }
  const prompt = buildExerciseGenerationPrompt(theorySteps, {
    language: options.language,
    maxCards: options.maxCards,
    feedback: options.feedback,
    avoidQuestions: options.avoidQuestions,
    hasAssets: options.hasAssets,
    types: options.types,
  });
  const raw = await provider.complete(prompt, {
    signal: options.signal,
    maxTokens: GENERATION_MAX_TOKENS,
  });
  // AI -> Parser (AIX-01) -> Quality Gate (AIX-03) -> Distribution (AIX-04) -> Result.
  const parsed = parseGeneratedExercises(raw);
  const gate = validateExerciseQuality(parsed.cards);
  // #2510 — enforce the user's type selection: a model that ignores the prompt
  // allow-list still cannot surface a deselected type. Absent selection -> keep
  // every passed card (today's behaviour).
  const selected =
    options.types && options.types.length > 0 ? new Set(options.types) : null;
  const passed = selected
    ? gate.passed.filter((card) => selected.has(card.type))
    : gate.passed;
  // #2355 — core cards ride the percentage distribution; extension cards get
  // their own budget and are appended after the balanced core set.
  const coreCards = passed.filter((card): card is ValidCard => !isExtensionCard(card));
  const extCards = capExtensionCards(passed.filter(isExtensionCard)).cards;
  return {
    cards: [...balanceExercises(coreCards), ...extCards],
    skipped: parsed.skipped,
    errors: parsed.errors,
    rejected: gate.rejected,
    warnings: gate.warnings,
  };
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
