/**
 * learning/summarySectionsPref — local, mode-agnostic preference for the
 * lesson-completion summary sections: which sections are shown AND in which
 * order (#1426, generalises the visibility-only #1411 which itself generalised
 * the single-key #1376).
 *
 * The preference is ONE ordered structure — an array of ``{id, enabled}`` in
 * render order — persisted as a single localStorage key holding JSON. Default:
 * every section ON, in today's fixed top-to-bottom order, so nothing changes
 * for anyone who does not touch the setting.
 *
 * The essential completion navigation (mark-as-complete + the secondary
 * next / repeat / exit actions) is deliberately NOT part of this structure —
 * it is always rendered, and pinned, so the panel can never become a dead end.
 *
 * Robust by construction: {@link sanitizeSummarySections} drops unknown IDs,
 * removes duplicates, coerces non-boolean ``enabled`` to ON, and appends any
 * missing known section at the end (default ON), so a stored value written by
 * a future/older build (or hand-edited) can never yield an empty or broken
 * panel — it always resolves to a full, valid ordered config.
 *
 * Migration (no silent reset — cf. the #1334 language-reset lesson):
 *   1. The #1411 visibility-only object
 *      (``adaptive-learner.lesson.summary_sections`` = ``Record<id, boolean>``)
 *      is read once when the ordered key has not been written yet, so every
 *      stored ON/OFF choice is carried into the ordered structure unchanged,
 *      with the order starting at the default.
 *   2. The #1376 single-key correction-round preference
 *      (``adaptive-learner.lesson.correction_round_enabled``) still seeds the
 *      ``correction`` flag when neither newer key exists.
 *
 * Stored in localStorage (same pattern as ``contentTabOrderPref`` /
 * ``hintPref``), with a change event so open surfaces react live. Works in
 * both storage modes (pure frontend, no backend round-trip).
 */

/** The configurable summary sections (the KNOWN set) in default render order. */
export const SUMMARY_SECTION_KEYS = [
  /** The save-to-favorites hint row. */
  "favorite",
  /** Stars, message, score bar, time/hint stats, retry comparison and the
   *  exam / timed mode result panels. */
  "result",
  /** The "+N XP" reward badge. */
  "xp",
  /** The "Share result" button. */
  "share",
  /** The collapsible per-exercise "View all answers" detail. */
  "answers",
  /** The result-export action row (copy / Markdown / JSON / Anki). */
  "export",
  /** The SRS correction round (#1376). #2570 - moved ahead of ``next_steps``:
   *  fixing today's mistakes belongs before the cards that offer what to do
   *  next, not trailing after them. */
  "correction",
  /** The smart "What would you like to do next?" suggestion cards. */
  "next_steps",
] as const;

export type SummarySectionKey = (typeof SUMMARY_SECTION_KEYS)[number];

/** One section: its stable id plus whether it is shown. Position in the array
 *  is the render order. */
export interface SummarySection {
  id: SummarySectionKey;
  enabled: boolean;
}

/** The whole ordered preference: one entry per section, in render order. */
export type SummarySectionsConfig = SummarySection[];

/** The default render order (today's fixed top-to-bottom section sequence). */
export const DEFAULT_SUMMARY_SECTION_ORDER: readonly SummarySectionKey[] =
  SUMMARY_SECTION_KEYS;

const KEY_ORDER = "adaptive-learner.lesson.summary_sections_order";

/** The #1411 visibility-only predecessor (``Record<id, boolean>``). */
const LEGACY_SECTIONS_KEY = "adaptive-learner.lesson.summary_sections";

/** The #1376 single-key predecessor of the ``correction`` flag. */
const LEGACY_CORRECTION_KEY = "adaptive-learner.lesson.correction_round_enabled";

export const SUMMARY_SECTIONS_CHANGE_EVENT =
  "adaptive-learner:summary-sections-pref";

const KNOWN: ReadonlySet<SummarySectionKey> = new Set(SUMMARY_SECTION_KEYS);

function isKnown(value: unknown): value is SummarySectionKey {
  return typeof value === "string" && KNOWN.has(value as SummarySectionKey);
}

/** Every section on, in the default order — the fallback for new users and
 *  unreadable state. */
export function defaultSummarySections(): SummarySectionsConfig {
  return DEFAULT_SUMMARY_SECTION_ORDER.map((id) => ({ id, enabled: true }));
}

/**
 * Coerce an arbitrary stored value into a complete, valid ordered config:
 * keep known IDs in their stored order (deduped), preserve each entry's
 * boolean ``enabled`` (non-boolean → ON), then append any known section that
 * was missing, in the default order, ON. A non-array / empty / all-unknown
 * value yields the full default config (all ON, default order).
 */
export function sanitizeSummarySections(raw: unknown): SummarySectionsConfig {
  const seen = new Set<SummarySectionKey>();
  const result: SummarySectionsConfig = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const id = (entry as { id?: unknown }).id;
      if (!isKnown(id) || seen.has(id)) continue;
      const enabledRaw = (entry as { enabled?: unknown }).enabled;
      seen.add(id);
      result.push({ id, enabled: typeof enabledRaw === "boolean" ? enabledRaw : true });
    }
  }
  for (const id of DEFAULT_SUMMARY_SECTION_ORDER) {
    if (!seen.has(id)) result.push({ id, enabled: true });
  }
  return result;
}

/** Read the #1411 visibility-only object (+ #1376 correction) as an
 *  id→enabled map, used only when the ordered key has never been written. */
function readLegacyEnabledMap(): Record<SummarySectionKey, boolean> | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_SECTIONS_KEY);
  } catch {
    /* no-op */
  }
  if (raw === null) {
    let correction: boolean | null = null;
    try {
      const legacy = localStorage.getItem(LEGACY_CORRECTION_KEY);
      if (legacy === "true") correction = true;
      else if (legacy === "false") correction = false;
    } catch {
      /* no-op */
    }
    if (correction === null) return null;
    const map = {} as Record<SummarySectionKey, boolean>;
    for (const id of SUMMARY_SECTION_KEYS) map[id] = true;
    map.correction = correction;
    return map;
  }
  const map = {} as Record<SummarySectionKey, boolean>;
  for (const id of SUMMARY_SECTION_KEYS) map[id] = true;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const id of SUMMARY_SECTION_KEYS) {
        const value = (parsed as Record<string, unknown>)[id];
        if (typeof value === "boolean") map[id] = value;
      }
    }
  } catch {
    /* garbage → all ON */
  }
  return map;
}

/**
 * Read the ordered summary-sections preference (always a full, valid config).
 * When the ordered key has never been written, migrate the #1411 visibility
 * object (or, failing that, the #1376 correction key) into the default order
 * so every stored ON/OFF choice survives with no silent reset.
 */
export function readSummarySections(): SummarySectionsConfig {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY_ORDER);
  } catch {
    /* no-op */
  }
  if (raw !== null) {
    try {
      return sanitizeSummarySections(JSON.parse(raw));
    } catch {
      return defaultSummarySections();
    }
  }
  const legacy = readLegacyEnabledMap();
  if (legacy === null) return defaultSummarySections();
  return DEFAULT_SUMMARY_SECTION_ORDER.map((id) => ({
    id,
    enabled: legacy[id],
  }));
}

/** Persist the whole ordered config (sanitized first) and notify open
 *  surfaces. */
export function writeSummarySections(config: SummarySectionsConfig): void {
  const clean = sanitizeSummarySections(config);
  try {
    localStorage.setItem(KEY_ORDER, JSON.stringify(clean));
  } catch {
    /* no-op */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUMMARY_SECTIONS_CHANGE_EVENT));
  }
}

/** Whether a section is enabled in the given config (missing → ON). */
export function isSummarySectionEnabled(
  config: SummarySectionsConfig,
  id: SummarySectionKey,
): boolean {
  const entry = config.find((section) => section.id === id);
  return entry ? entry.enabled : true;
}

/** Flip one section's ``enabled`` flag on the persisted ordered config
 *  (read-modify-write of the single settings object, so the order and the
 *  other flags are preserved). */
export function setSummarySectionEnabled(
  id: SummarySectionKey,
  enabled: boolean,
): void {
  const config = readSummarySections();
  const entry = config.find((section) => section.id === id);
  if (entry) entry.enabled = enabled;
  writeSummarySections(config);
}

/**
 * Pure helper: return a new ordered config with the section at ``id`` moved by
 * ``direction`` (-1 up, +1 down). Out-of-range moves return the input
 * unchanged. Visibility is carried with the moved entry, so a disabled section
 * keeps its ON/OFF state while changing position.
 */
export function moveSummarySection(
  config: SummarySectionsConfig,
  id: SummarySectionKey,
  direction: -1 | 1,
): SummarySectionsConfig {
  const index = config.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= config.length) return config;
  const next = [...config];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
