/**
 * Preferred exercise-direction strategy (EXP-018 / Phase 62).
 *
 * Persists the learner's "Preferred exercise direction" choice in
 * localStorage and feeds it into the adaptive lesson generator's
 * ``direction_strategy``. Presentation/curriculum preference only —
 * it never changes the SRS mastery algorithm, just which direction
 * the adaptive generator drills.
 *
 *   - "auto" (default): per-element — receptive until recognition is
 *     solid, then productive (the pedagogically-correct progression).
 *   - "receptive_first": always receptive (beginners).
 *   - "productive_focus": always productive (advanced).
 *   - "balanced": alternate receptive / productive.
 */

import type {DirectionStrategy} from "../adaptive/lesson-generator";

const KEY = "adaptive-learner.direction_strategy";

const VALID: readonly DirectionStrategy[] = [
  "auto",
  "receptive_first",
  "productive_focus",
  "balanced",
];

export const DEFAULT_DIRECTION_STRATEGY: DirectionStrategy = "auto";

/** Dispatched on the window when the preference changes in THIS tab
 *  (the native ``storage`` event only fires in other tabs). */
export const DIRECTION_PREF_CHANGE_EVENT = "adaptive-learner:direction-pref";

/** The configured direction strategy, falling back to the default
 *  for an unset / unrecognised localStorage value. */
export function readDirectionStrategy(): DirectionStrategy {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && (VALID as string[]).includes(raw)) {
      return raw as DirectionStrategy;
    }
  } catch {
    /* no-op: storage unavailable */
  }
  return DEFAULT_DIRECTION_STRATEGY;
}

/** Persist the direction strategy and dispatch
 *  {@link DIRECTION_PREF_CHANGE_EVENT} so same-tab listeners refresh. */
export function writeDirectionStrategy(strategy: DirectionStrategy): void {
  try {
    localStorage.setItem(KEY, strategy);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DIRECTION_PREF_CHANGE_EVENT));
    }
  } catch {
    /* no-op: storage unavailable */
  }
}

export const DIRECTION_STRATEGY_OPTIONS: readonly DirectionStrategy[] = VALID;
