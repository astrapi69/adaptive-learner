/**
 * learning/correctionRoundPref — local, mode-agnostic preference for whether
 * the SRS correction round is shown in the lesson-completion summary (#1376).
 *
 * The correction round lets the learner fix their mistakes right on the summary
 * screen. It is useful but can feel intrusive in the completion flow, so it is
 * made optional. Default ON — existing behaviour is unchanged for everyone who
 * does not touch the setting; turning it OFF only hides it from the summary
 * (the same errors stay reachable through the regular "Fehler wiederholen" /
 * SRS review path).
 *
 * Stored in localStorage (same pattern as ``hintPref`` / ``feedbackPref``), with
 * a change event so open surfaces react live. Works in both storage modes.
 */

const KEY_ENABLED = "adaptive-learner.lesson.correction_round_enabled";

export const DEFAULT_CORRECTION_ROUND_ENABLED = true;

export const CORRECTION_ROUND_PREF_CHANGE_EVENT =
  "adaptive-learner:correction-round-pref";

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CORRECTION_ROUND_PREF_CHANGE_EVENT));
  }
}

/** Whether the correction round is shown in the lesson summary (default on). */
export function readCorrectionRoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY_ENABLED);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* no-op */
  }
  return DEFAULT_CORRECTION_ROUND_ENABLED;
}

/** Persist whether the correction round is shown and notify open surfaces. */
export function setCorrectionRoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
  } catch {
    /* no-op */
  }
  notifyChange();
}
