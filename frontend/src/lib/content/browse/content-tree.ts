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

import type { ContentSetEntry } from "../../../storage/types";
import { baseLanguage, domainOf } from "../language/language-utils";
import { resolveTreePlacement } from "../placement/tree-placement";
import { compareByDownloadPriority } from "./download-priority";

/**
 * Order two downloaded content sets "freshest download first" via the
 * shared {@link compareByDownloadPriority} comparator (#1241, DRY with the
 * personal Learning Path #1211). The Content browser only lists downloaded
 * sets and tracks no per-set progress here, so every set maps to the
 * untouched-downloaded tier: most-recent ``downloaded_at`` first, then a
 * stable title sort. In API mode ``downloaded_at`` is absent, so the
 * comparator falls back to title only (no crash, no regression).
 */
function compareSetsByDownloadPriority(
  a: ContentSetEntry,
  b: ContentSetEntry,
): number {
  return compareByDownloadPriority(
    { downloaded: true, lastActivity: null, downloadedAt: a.downloaded_at ?? null, title: a.title },
    { downloaded: true, lastActivity: null, downloadedAt: b.downloaded_at ?? null, title: b.title },
  );
}

// Re-exported for existing consumers that import these from
// content-tree; the definitions live in language-utils (#540, to break
// the content-tree <-> tree-placement import cycle).
export { baseLanguage, domainOf };

/**
 * A user-generated lesson folded into a published tree node
 * (EXP-026 / UGC-02). Carries just enough to render a row + badge +
 * the shared set-level actions, without changing any IDs.
 */
export interface FoldedUserLesson {
  /** Lesson id (stable internal id). */
  lessonId: string;
  /** Cached lesson filename for navigation (e.g. ``mine-l1.json``). */
  filename: string;
  title: string;
  /** Source marker of the owning user-generated set ("user-generated"). */
  setSource: string;
  /** Id of the owning user-generated set. */
  setId: string;
  /** Badge state: an original ``own`` lesson, or an ``edit`` (a fork of
   *  an official/community lesson, i.e. it carries ``variation_of``). */
  origin: "own" | "edit";
}

/** One user-generated set plus its lessons, to fold into the tree. */
export interface UserFoldInput {
  set: ContentSetEntry;
  lessons: {
    id: string;
    /** Cached filename (from ``listLessons``) used to open the lesson. */
    filename: string;
    title: string;
    variation_of?: string | null;
  }[];
}

export interface LevelGroup {
  /** CEFR-ish level marker as authored ("A1", "beginner", ...). */
  level: string;
  sets: ContentSetEntry[];
  /** User-generated lessons folded into this level (EXP-026); empty
   *  unless ``buildContentTree`` was given matching ``userFold`` input. */
  userLessons: FoldedUserLesson[];
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
  /** Sets in this domain, ordered freshest-download-first, then title (#1241). */
  sets: ContentSetEntry[];
  setCount: number;
  /** User-generated lessons folded into this domain (EXP-026). */
  userLessons: FoldedUserLesson[];
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
      sets: [...levelSets].sort(compareSetsByDownloadPriority),
      userLessons: [] as FoldedUserLesson[],
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
 * @param userFold optional user-generated sets (+ their lessons) to
 *   fold into matching published nodes (EXP-026 / UGC-02). Defaults to
 *   none, so existing callers are unaffected. Unmatched sets are
 *   skipped (the page shows them in the "My Lessons" fallback).
 */
export function buildContentTree(
  sets: ContentSetEntry[],
  activeSources: string[],
  userFold: UserFoldInput[] = [],
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
      sets: [...domainSets].sort(compareSetsByDownloadPriority),
      setCount: domainSets.length,
      userLessons: [] as FoldedUserLesson[],
    }));

  foldUserLessons({ primary, other, knowledge }, sets, userFold);

  return { primary, other, knowledge };
}

/**
 * Fold each user-generated set's lessons into the matching published
 * node (EXP-026 / UGC-02). Pure mutation of the freshly-built tree;
 * sets with no/ambiguous placement are skipped (the page keeps them in
 * the "My Lessons" fallback). ``setCount`` is untouched, so folded
 * lessons never inflate the published-set counts.
 */
function foldUserLessons(
  tree: ContentTree,
  publishedSets: ContentSetEntry[],
  userFold: UserFoldInput[],
): void {
  for (const { set, lessons } of userFold) {
    const representativeVariation =
      lessons.find((l) => l.variation_of)?.variation_of ?? null;
    const placement = resolveTreePlacement(
      {
        source_language: set.source_language,
        target_language: set.target_language,
        level: set.level,
        domain: set.domain,
        title: set.title,
        variationOf: representativeVariation,
      },
      publishedSets,
    );
    if (!placement.matched) continue;

    const folded: FoldedUserLesson[] = lessons.map((lesson) => ({
      lessonId: lesson.id,
      filename: lesson.filename,
      title: lesson.title,
      setSource: set.source,
      setId: set.id,
      origin: lesson.variation_of ? "edit" : "own",
    }));

    const target = placement.set;
    if (domainOf(target) === "language") {
      const level = findLevelGroup(tree, target);
      if (level) level.userLessons.push(...folded);
    } else {
      const domain = [...tree.knowledge].find(
        (g) => g.domain === domainOf(target),
      );
      if (domain) domain.userLessons.push(...folded);
    }
  }
}

/** Locate the LevelGroup that holds ``target`` (a matched published
 *  language set) across the primary + other source groups. */
function findLevelGroup(
  tree: ContentTree,
  target: ContentSetEntry,
): LevelGroup | undefined {
  const source = baseLanguage(target.source_language);
  const targetLang = baseLanguage(target.target_language);
  for (const group of [...tree.primary, ...tree.other]) {
    if (group.sourceLanguage !== source) continue;
    const targetGroup = group.targets.find(
      (tg) => tg.targetLanguage === targetLang,
    );
    if (!targetGroup) continue;
    return targetGroup.levels.find((lg) => lg.level === target.level);
  }
  return undefined;
}
