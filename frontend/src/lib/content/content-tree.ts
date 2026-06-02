/**
 * Content-tree grouping (Phase 60 / v1.44.0).
 *
 * Turns a flat list of downloadable content sets into the
 * source-language -> target-language -> level hierarchy the
 * Content Browser renders:
 *
 *   Ich spreche: Deutsch              <- the learner's source language(s)
 *   |- Französisch lernen (FR)
 *   |  |- A1 (3 Lektionen)
 *   |- Spanisch lernen (ES)
 *   |     ...
 *   Andere Ausgangssprachen            <- every other source language
 *   |- English speakers
 *      ...
 *
 * Pure + deterministic so it is unit-testable without React. The
 * `activeSources` list (the learner's app language plus any extra
 * source languages they opted into) decides which groups land in
 * `primary` vs `other`.
 */

import type { ContentSetEntry } from "../../storage/types";

export interface LevelGroup {
  /** CEFR-ish level marker as authored ("A1", "beginner", ...). */
  level: string;
  sets: ContentSetEntry[];
}

export interface TargetGroup {
  /** Base BCP-47 subtag of the language being learned ("fr"). */
  targetLanguage: string;
  levels: LevelGroup[];
  setCount: number;
}

export interface SourceGroup {
  /** Base BCP-47 subtag of the learner's language ("de"). */
  sourceLanguage: string;
  targets: TargetGroup[];
  setCount: number;
}

/** A non-language domain bucket (schema v1.3): all sets that teach
 *  knowledge content (psychology, programming, ...) rather than a
 *  language pair. Rendered under a separate "Wissen" / "Knowledge"
 *  heading, outside the source -> target -> level language tree. */
export interface DomainGroup {
  /** Normalised domain tag ("psychology", "programming", ...). */
  domain: string;
  /** Sets in this domain, sorted by title. */
  sets: ContentSetEntry[];
  setCount: number;
}

export interface ContentTree {
  /** Source-language groups the learner speaks (app language +
   *  opted-in extras), in `activeSources` order. */
  primary: SourceGroup[];
  /** Every other source language, alphabetical — rendered under a
   *  collapsed "other source languages" section. */
  other: SourceGroup[];
  /** Non-language (domain) sets, grouped by domain, alphabetical.
   *  Empty when the library is language-only. */
  knowledge: DomainGroup[];
}

/** Base subtag of a BCP-47 code: "de-AT" -> "de", "FR" -> "fr". */
export function baseLanguage(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

/** Normalised content domain; "language" when unset. Mirrors the
 *  content-validator + the content repo's validate_content.py. */
export function domainOf(entry: ContentSetEntry): string {
  return (entry.domain || "language").trim().toLowerCase();
}

/** CEFR ordering for level sort; unknown levels sort last,
 *  alphabetically, after the known CEFR ladder. */
const CEFR_ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];
function levelRank(level: string): number {
  const idx = CEFR_ORDER.indexOf(level.toLowerCase());
  return idx === -1 ? CEFR_ORDER.length : idx;
}

function compareLevels(a: string, b: string): number {
  const ra = levelRank(a);
  const rb = levelRank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

function groupLevels(sets: ContentSetEntry[]): LevelGroup[] {
  const byLevel = new Map<string, ContentSetEntry[]>();
  for (const entry of sets) {
    const list = byLevel.get(entry.level) ?? [];
    list.push(entry);
    byLevel.set(entry.level, list);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => compareLevels(a, b))
    .map(([level, levelSets]) => ({
      level,
      sets: [...levelSets].sort((x, y) => x.title.localeCompare(y.title)),
    }));
}

function groupTargets(sets: ContentSetEntry[]): TargetGroup[] {
  const byTarget = new Map<string, ContentSetEntry[]>();
  for (const entry of sets) {
    const key = baseLanguage(entry.target_language);
    const list = byTarget.get(key) ?? [];
    list.push(entry);
    byTarget.set(key, list);
  }
  return [...byTarget.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([targetLanguage, targetSets]) => ({
      targetLanguage,
      levels: groupLevels(targetSets),
      setCount: targetSets.length,
    }));
}

/**
 * Build the source -> target -> level tree from a flat set list.
 *
 * @param sets downloadable sets (My Lessons / user-generated sets
 *   are filtered out by the caller before this point).
 * @param activeSources base language codes the learner speaks,
 *   primary first (app language, then opted-in extras). Sets whose
 *   `source_language` base matches one of these land in `primary`
 *   (ordered by this list); everything else lands in `other`.
 */
export function buildContentTree(
  sets: ContentSetEntry[],
  activeSources: string[],
): ContentTree {
  const active = activeSources.map(baseLanguage);
  const activeSet = new Set(active);

  // Split language sets (the source -> target -> level tree) from
  // non-language domain sets (the flat "Wissen" section).
  const languageSets: ContentSetEntry[] = [];
  const knowledgeSets: ContentSetEntry[] = [];
  for (const entry of sets) {
    if (domainOf(entry) === "language") languageSets.push(entry);
    else knowledgeSets.push(entry);
  }

  const bySource = new Map<string, ContentSetEntry[]>();
  for (const entry of languageSets) {
    const key = baseLanguage(entry.source_language);
    const list = bySource.get(key) ?? [];
    list.push(entry);
    bySource.set(key, list);
  }

  const toGroup = (sourceLanguage: string): SourceGroup => {
    const sourceSets = bySource.get(sourceLanguage) ?? [];
    return {
      sourceLanguage,
      targets: groupTargets(sourceSets),
      setCount: sourceSets.length,
    };
  };

  // Primary groups follow the activeSources order, but only for
  // source languages that actually have sets.
  const primary: SourceGroup[] = [];
  const seen = new Set<string>();
  for (const src of active) {
    if (bySource.has(src) && !seen.has(src)) {
      primary.push(toGroup(src));
      seen.add(src);
    }
  }

  const other: SourceGroup[] = [...bySource.keys()]
    .filter((src) => !activeSet.has(src))
    .sort((a, b) => a.localeCompare(b))
    .map(toGroup);

  // Non-language domain sets, grouped by domain (alphabetical).
  const byDomain = new Map<string, ContentSetEntry[]>();
  for (const entry of knowledgeSets) {
    const key = domainOf(entry);
    const list = byDomain.get(key) ?? [];
    list.push(entry);
    byDomain.set(key, list);
  }
  const knowledge: DomainGroup[] = [...byDomain.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, domainSets]) => ({
      domain,
      sets: [...domainSets].sort((x, y) => x.title.localeCompare(y.title)),
      setCount: domainSets.length,
    }));

  return { primary, other, knowledge };
}
