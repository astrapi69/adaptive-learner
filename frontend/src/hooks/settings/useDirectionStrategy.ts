/**
 * useDirectionStrategy (EXP-018 / Phase 62).
 *
 * Live-reading hook for the learner's preferred exercise-direction
 * strategy. Re-reads on same-tab changes (the
 * ``DIRECTION_PREF_CHANGE_EVENT``) and cross-tab changes (the native
 * ``storage`` event). The adaptive-lesson hook reads this so the
 * Settings control takes effect without a reload.
 */

import {useEffect, useState} from "react";

import type {DirectionStrategy} from "../../lib/adaptive/lesson-generator";
import {
  DIRECTION_PREF_CHANGE_EVENT,
  readDirectionStrategy,
} from "../../lib/learning/directionPref";

export function useDirectionStrategy(): DirectionStrategy {
  const [strategy, setStrategy] = useState<DirectionStrategy>(() =>
    readDirectionStrategy(),
  );

  useEffect(() => {
    const refresh = () => setStrategy(readDirectionStrategy());
    window.addEventListener(DIRECTION_PREF_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(DIRECTION_PREF_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return strategy;
}
