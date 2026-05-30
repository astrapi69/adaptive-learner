/**
 * DirectionStrategyControl (EXP-018 / Phase 62).
 *
 * Settings > Learning control for the learner's preferred exercise
 * direction. Feeds the adaptive lesson generator's
 * ``direction_strategy``:
 *   - Automatic  → per-element receptive-then-productive progression
 *   - Recognise first → always receptive (beginners)
 *   - Produce    → always productive (advanced)
 *   - Balanced   → alternate
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import type {DirectionStrategy} from "../lib/adaptive/lesson-generator";
import {
  DIRECTION_PREF_CHANGE_EVENT,
  DIRECTION_STRATEGY_OPTIONS,
  readDirectionStrategy,
  writeDirectionStrategy,
} from "../lib/learning/directionPref";

const LABELS: Record<DirectionStrategy, {key: string; fallback: string}> = {
  auto: {key: "settings.direction.auto", fallback: "Automatic"},
  receptive_first: {
    key: "settings.direction.receptive_first",
    fallback: "Recognise first",
  },
  productive_focus: {
    key: "settings.direction.productive_focus",
    fallback: "Produce",
  },
  balanced: {key: "settings.direction.balanced", fallback: "Balanced"},
};

export default function DirectionStrategyControl() {
  const {t} = useI18n();
  const [strategy, setStrategy] = useState<DirectionStrategy>(() =>
    readDirectionStrategy(),
  );

  useEffect(() => {
    const refresh = () => setStrategy(readDirectionStrategy());
    window.addEventListener("storage", refresh);
    window.addEventListener(DIRECTION_PREF_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(DIRECTION_PREF_CHANGE_EVENT, refresh);
    };
  }, []);

  const onChange = (value: string) => {
    const next = value as DirectionStrategy;
    setStrategy(next);
    writeDirectionStrategy(next);
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-direction-strategy"
    >
      <h2 className="settings-section-title">
        {t("settings.direction.title", "Preferred exercise direction")}
      </h2>
      <p className="form-hint">
        {t(
          "settings.direction.hint",
          "How adaptive lessons balance recognising (target → your language) vs producing (your language → target). Producing is harder; Automatic introduces it once recognition is solid.",
        )}
      </p>
      <label className="form-row">
        <span className="form-label">
          {t("settings.direction.label", "Direction")}
        </span>
        <select
          data-testid="settings-direction-strategy"
          value={strategy}
          onChange={(e) => onChange(e.target.value)}
        >
          {DIRECTION_STRATEGY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(LABELS[opt].key, LABELS[opt].fallback)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
