/**
 * learning/summarySectionsPref — local, mode-agnostic preference for which
 * sections the lesson-completion summary shows (#1411, generalises #1376).
 *
 * Every configurable section of the summary panel has one boolean flag,
 * persisted together as ONE settings object (a single localStorage key holding
 * JSON — sections are updated together, not as N scattered keys). Default:
 * everything ON, so existing behaviour is unchanged for anyone who does not
 * touch the setting.
 *
 * The essential completion navigation (mark-as-complete + the secondary
 * next / repeat / exit actions) is deliberately NOT part of this object —
 * it is always rendered so the panel can never become a dead end.
 *
 * Migration: the #1376 single-key correction-round preference
 * (``adaptive-learner.lesson.correction_round_enabled``) is honoured on read
 * when the new object has not been written yet, so a stored OFF choice
 * survives the move into this sub-area without a silent reset.
 *
 * Stored in localStorage (same pattern as ``hintPref`` / ``feedbackPref``),
 * with a change event so open surfaces react live. Works in both storage
 * modes (pure frontend, no backend round-trip).
 */

/** The configurable summary sections, in panel render order. */
export const SUMMARY_SECTION_KEYS = [
  /** Stars, message, score bar, time/hint stats, retry comparison and the
   *  exam / timed mode result panels. */
  "result",
  /** The "+N XP" reward badge. */
  "xp",
  /** The save-to-favorites hint row. */
  "favorite",
  /** The "Share result" button. */
  "share",
  /** The collapsible per-exercise "View all answers" detail. */
  "answers",
  /** The result-export action row (copy / Markdown / JSON / Anki). */
  "export",
  /** The smart "What would you like to do next?" suggestion cards. */
  "next_steps",
  /** The SRS correction round (last element, #1376). */
  "correction",
] as const;

export type SummarySectionKey = (typeof SUMMARY_SECTION_KEYS)[number];

/** One flag per configurable summary section. */
export type SummarySectionsPref = Record<SummarySectionKey, boolean>;

const KEY_SECTIONS = "adaptive-learner.lesson.summary_sections";

/** The #1376 single-key predecessor of the ``correction`` flag. */
const LEGACY_CORRECTION_KEY = "adaptive-learner.lesson.correction_round_enabled";

export const SUMMARY_SECTIONS_CHANGE_EVENT =
  "adaptive-learner:summary-sections-pref";

/** Every section on — the default for new users and unreadable state. */
export function defaultSummarySections(): SummarySectionsPref {
  const all = {} as SummarySectionsPref;
  for (const key of SUMMARY_SECTION_KEYS) all[key] = true;
  return all;
}

function readLegacyCorrectionEnabled(): boolean | null {
  try {
    const raw = localStorage.getItem(LEGACY_CORRECTION_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* no-op */
  }
  return null;
}

/**
 * Read the summary-sections preference. Unknown keys are dropped, missing or
 * non-boolean flags fall back to ON, garbage falls back to all-ON. When the
 * object has never been written, the stored #1376 correction-round choice
 * (if any) seeds the ``correction`` flag.
 */
export function readSummarySections(): SummarySectionsPref {
  const sections = defaultSummarySections();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY_SECTIONS);
  } catch {
    /* no-op */
  }
  if (raw === null) {
    const legacy = readLegacyCorrectionEnabled();
    if (legacy !== null) sections.correction = legacy;
    return sections;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const key of SUMMARY_SECTION_KEYS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === "boolean") sections[key] = value;
      }
    }
  } catch {
    /* garbage → defaults */
  }
  return sections;
}

/** Persist the whole sections object and notify open surfaces. */
export function writeSummarySections(sections: SummarySectionsPref): void {
  try {
    localStorage.setItem(KEY_SECTIONS, JSON.stringify(sections));
  } catch {
    /* no-op */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUMMARY_SECTIONS_CHANGE_EVENT));
  }
}

/** Flip one section flag on the persisted object (read-modify-write of the
 *  single settings object, so concurrent flags are preserved). */
export function setSummarySectionEnabled(
  key: SummarySectionKey,
  enabled: boolean,
): void {
  const sections = readSummarySections();
  sections[key] = enabled;
  writeSummarySections(sections);
}
