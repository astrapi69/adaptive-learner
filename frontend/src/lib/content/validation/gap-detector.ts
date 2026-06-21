/**
 * Smart gap suggestions for the content tree (Phase 64E).
 *
 * Turns passive browsers into contributors by surfacing, in an
 * ENCOURAGING way ("Can you help?", never "you must"), where the
 * community library is thin:
 *
 *  - **next_level**: a language pair has some levels but not the next
 *    one ("French A1 for German speakers exists — A2 doesn't yet").
 *  - **missing_pair**: a target language taught for one source language
 *    is missing for another active source ("Spanish A1 exists for
 *    English speakers; German speakers have none — start it!").
 *
 * Computed purely from the set list (no lesson loading), so it's cheap
 * + testable. Topic-level gaps ("this set has no weather lesson") need
 * lesson content and are intentionally out of scope here.
 */

import type { ContentSetEntry } from "../../../storage/types";

/** CEFR ladder, lowercase, low → high. */
export const CEFR_LADDER = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;

export type GapKind = "next_level" | "missing_pair";

export interface ContentGap {
  kind: GapKind;
  /** Base source-language code (the speaker's language). */
  source: string;
  /** Base target-language code (the language to learn). */
  target: string;
  /** Suggested CEFR level (uppercase, e.g. "A2"). */
  level: string;
}

function base(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

/**
 * Detect content gaps from the published set list. User-generated
 * drafts are ignored. Results are de-duplicated and ordered
 * next_level first (the most actionable: extend a course you already
 * have) then missing_pair.
 */
export function detectGaps(sets: readonly ContentSetEntry[]): ContentGap[] {
  const published = sets.filter((s) => s.source !== "user-generated");

  // pair "source>target" -> set of CEFR levels present (lowercase)
  const pairLevels = new Map<string, Set<string>>();
  // target -> lowest ladder index present anywhere (for missing_pair)
  const targetLowest = new Map<string, number>();
  const sourcesWithContent = new Set<string>();
  const targets = new Set<string>();

  for (const set of published) {
    const src = base(set.source_language);
    const tgt = base(set.target_language);
    const lv = (set.level || "").trim().toLowerCase();
    const idx = CEFR_LADDER.indexOf(lv as (typeof CEFR_LADDER)[number]);
    if (!src || !tgt || idx < 0) continue;
    sourcesWithContent.add(src);
    targets.add(tgt);
    const pairKey = `${src}>${tgt}`;
    if (!pairLevels.has(pairKey)) pairLevels.set(pairKey, new Set());
    pairLevels.get(pairKey)!.add(lv);
    const prev = targetLowest.get(tgt);
    if (prev === undefined || idx < prev) targetLowest.set(tgt, idx);
  }

  const nextLevel: ContentGap[] = [];
  const missingPair: ContentGap[] = [];
  const seen = new Set<string>();
  const add = (bucket: ContentGap[], gap: ContentGap) => {
    const key = `${gap.kind}:${gap.source}:${gap.target}:${gap.level}`;
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push(gap);
  };

  // next_level: the ladder step above the highest level a pair has.
  for (const [pairKey, levels] of pairLevels) {
    const [src, tgt] = pairKey.split(">");
    let highest = -1;
    for (const lv of levels) {
      const idx = CEFR_LADDER.indexOf(lv as (typeof CEFR_LADDER)[number]);
      if (idx > highest) highest = idx;
    }
    if (highest >= 0 && highest < CEFR_LADDER.length - 1) {
      const next = CEFR_LADDER[highest + 1];
      if (!levels.has(next)) {
        add(nextLevel, {
          kind: "next_level",
          source: src,
          target: tgt,
          level: next.toUpperCase(),
        });
      }
    }
  }

  // missing_pair: a target taught for some source but absent for
  // another active source — suggest starting it at that target's
  // lowest existing level.
  for (const tgt of targets) {
    const lowestIdx = targetLowest.get(tgt) ?? 0;
    const level = CEFR_LADDER[lowestIdx].toUpperCase();
    for (const src of sourcesWithContent) {
      if (src === tgt) continue; // can't learn your own language here
      if (!pairLevels.has(`${src}>${tgt}`)) {
        add(missingPair, { kind: "missing_pair", source: src, target: tgt, level });
      }
    }
  }

  return [...nextLevel, ...missingPair];
}
