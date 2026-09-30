/**
 * Stagnation-based method-switch rule (#3396).
 *
 * TypeScript port of ``plugins/adaptive-learner-plugin-session/
 * adaptive_learner_session/switching.py``, so browser mode recommends a switch
 * on the same data as API mode instead of never. Both sides assert against
 * ``tests/fixtures/method-switch-parity/``.
 *
 * Recommend a switch when the latest three understanding scores (oldest
 * first) are non-increasing AND their mean stress is above 3.0; the next
 * method is the heaviest profile weight not used recently, else the static
 * method order.
 *
 * @example
 * const rec = recommendMethodSwitch("p1", "deductive", ratingsOldestFirst);
 */

import { LEARNING_METHODS } from "../constants";

const STAGNATION_WINDOW = 3;
const STRESS_THRESHOLD = 3.0;

export interface SwitchRatingInput {
  understanding?: number;
  stress?: number;
}

export interface MethodSwitchRecommendation {
  project_id: string;
  from_method: string;
  to_method: string;
  reason: string;
  confidence: number;
}

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

function isStagnant(understanding: number[]): boolean {
  if (understanding.length < STAGNATION_WINDOW) return false;
  return Math.max(...understanding) - understanding[0] <= 0;
}

function nextMethod(
  current: string,
  profile: Record<string, unknown> | null | undefined,
  recentlyUsed: readonly string[],
): string | null {
  const skip = new Set([current, ...recentlyUsed]);
  if (profile) {
    const ranked = LEARNING_METHODS.filter((m) => typeof profile[m] === "number").sort(
      (a, b) => (profile[b] as number) - (profile[a] as number),
    );
    const pick = ranked.find((m) => !skip.has(m));
    if (pick) return pick;
  }
  return (
    LEARNING_METHODS.find((m) => !skip.has(m)) ??
    LEARNING_METHODS.find((m) => m !== current) ??
    null
  );
}

/**
 * The switch recommendation, or ``null`` for "keep going".
 *
 * @param ratings - the project's recent ratings, OLDEST first.
 */
export function recommendMethodSwitch(
  projectId: string,
  currentMethod: string,
  ratings: readonly SwitchRatingInput[],
  options: { profile?: Record<string, unknown> | null; recentlyUsedMethods?: string[] | null } = {},
): MethodSwitchRecommendation | null {
  const recentlyUsed = options.recentlyUsedMethods ?? [currentMethod];
  const window = ratings.slice(-STAGNATION_WINDOW);
  if (window.length < STAGNATION_WINDOW) return null;
  const understanding = window
    .filter((r) => typeof r.understanding === "number")
    .map((r) => r.understanding as number);
  const stress = window.filter((r) => typeof r.stress === "number").map((r) => r.stress as number);
  if (understanding.length < STAGNATION_WINDOW || stress.length < STAGNATION_WINDOW) return null;
  if (!isStagnant(understanding)) return null;
  const meanStress = mean(stress);
  if (meanStress <= STRESS_THRESHOLD) return null;
  const toMethod = nextMethod(currentMethod, options.profile, recentlyUsed);
  if (toMethod === null) return null;
  return {
    project_id: projectId,
    from_method: currentMethod,
    to_method: toMethod,
    reason:
      `Understanding flat over the last ${STAGNATION_WINDOW} sessions ` +
      `([${understanding.map((u) => Math.trunc(u)).join(", ")}]) while mean stress is ` +
      `${meanStress.toFixed(1)}/5. Trying ${toMethod} next.`,
    confidence: meanStress <= 4.0 ? 0.75 : 1.0,
  };
}
