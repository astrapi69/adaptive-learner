/**
 * Duplicate-lesson detection for community sharing (Phase 61).
 *
 * Before a user shares, we warn if a set with a very similar title
 * already exists in the SAME language pair + level — so the
 * community doesn't accumulate near-duplicate "French A1 greetings"
 * sets. Pure + testable; the Content page feeds it the already-
 * loaded set list (no extra fetch).
 */

import type {
  ContentLesson,
  ContentLessonExercise,
  ContentLessonStep,
  ContentSetEntry,
} from "../../../storage/types";

function baseLang(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    // German transliteration so "Begr\u00fc\u00dfung" == "Begruessung".
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip remaining combining diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Levenshtein edit distance, capped (returns >= cap+1 once it is
 *  certain the distance exceeds the cap, to stay cheap). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export interface DuplicateQuery {
  /** Set id of the lesson being shared (excluded from its own match). */
  id: string;
  title: string;
  source_language: string;
  target_language: string;
  level: string;
}

/**
 * Return the existing sets that look like duplicates of the set
 * being shared: same source + target language and level, and a
 * title that matches case-/diacritic-insensitively OR within a
 * Levenshtein distance < 3. User-generated sets (the sharer's own
 * "My Lessons") are never treated as duplicates.
 */
export function findSimilarSets(
  query: DuplicateQuery,
  candidates: ContentSetEntry[],
): ContentSetEntry[] {
  const qTitle = normaliseTitle(query.title);
  const qSource = baseLang(query.source_language);
  const qTarget = baseLang(query.target_language);
  const qLevel = (query.level || "").trim().toLowerCase();
  if (!qTitle) return [];
  return candidates.filter((c) => {
    if (c.id === query.id) return false;
    if (c.source === "user-generated") return false;
    if (baseLang(c.source_language) !== qSource) return false;
    if (baseLang(c.target_language) !== qTarget) return false;
    if ((c.level || "").trim().toLowerCase() !== qLevel) return false;
    const cTitle = normaliseTitle(c.title);
    if (!cTitle) return false;
    return cTitle === qTitle || levenshtein(cTitle, qTitle) < 3;
  });
}

// ---------------------------------------------------------------------------
// Lesson-level duplicate / variation detection (Phase 64B).
//
// findSimilarSets (above) warns about near-duplicate SETS by title. This
// layer compares a single lesson being shared against the individual
// lessons already in the target set, by CARD overlap + EXERCISE overlap, so
// the user can choose to share it as a VARIATION or extract only the
// genuinely-new exercises as a supplement. Pure; originals are never
// mutated (comparison uses normalised copies, never edits).
// ---------------------------------------------------------------------------

/** A query lesson whose cards are >= 90% present in a candidate is a
 *  near-duplicate; >= 70% is "similar". */
export const NEAR_DUPLICATE_CARD_OVERLAP = 0.9;
export const SIMILAR_CARD_OVERLAP = 0.7;

export type DuplicateTier = "none" | "similar" | "near_duplicate";

/** Canonical comparison key for a card: normalised front + back, so
 *  "Bonjour"/"Hello" matches "bonjour"/"hello" and "Begrüßung" matches
 *  "Begruessung". The card object is never mutated. */
export function cardKey(card: { front: string; back: string }): string {
  return `${normaliseTitle(card.front)}|${normaliseTitle(card.back)}`;
}

function exerciseSteps(lesson: ContentLesson): ContentLessonExercise[] {
  return lesson.steps
    .filter((step) => step.type === "exercise" && step.exercise)
    .map((step) => step.exercise as ContentLessonExercise);
}

function cardKeyMap(lesson: ContentLesson): Map<string, string> {
  const map = new Map<string, string>();
  for (const card of lesson.cards) map.set(card.id, cardKey(card));
  return map;
}

/** Cross-lesson exercise signature: its type + the sorted set of card
 *  KEYS it targets (resolving the lesson-local card_ids through the
 *  lesson's own cards). Comparable between independently-authored
 *  lessons, whose raw card_ids never match. */
function exerciseSignature(
  exercise: ContentLessonExercise,
  cardKeyById: Map<string, string>,
): string {
  const keys = (exercise.card_ids || [])
    .map((id) => cardKeyById.get(id))
    .filter((key): key is string => Boolean(key))
    .sort();
  return `${exercise.type}#${keys.join("|")}`;
}

export interface LessonComparison {
  candidateId: string;
  candidateTitle: string;
  /** 0..1: share of the query lesson's cards present in the candidate. */
  cardOverlap: number;
  matchedCards: number;
  totalQueryCards: number;
  /** 0..1: share of the query lesson's exercises with a structural twin
   *  (same type + same targeted card keys) in the candidate. */
  exerciseOverlap: number;
  matchedExercises: number;
  totalQueryExercises: number;
  /** Levenshtein distance of the normalised titles (0 = identical). */
  titleDistance: number;
}

/** Compare the query lesson against one candidate. Pure. */
export function compareLessons(
  query: ContentLesson,
  candidate: ContentLesson,
): LessonComparison {
  const candidateCardKeys = new Set(candidate.cards.map(cardKey));
  const queryCardKeys = query.cards.map(cardKey);
  const matchedCards = queryCardKeys.filter((key) =>
    candidateCardKeys.has(key),
  ).length;
  const totalQueryCards = queryCardKeys.length;

  const candidateKeyById = cardKeyMap(candidate);
  const candidateSigs = new Set(
    exerciseSteps(candidate).map((ex) =>
      exerciseSignature(ex, candidateKeyById),
    ),
  );
  const queryKeyById = cardKeyMap(query);
  const querySigs = exerciseSteps(query).map((ex) =>
    exerciseSignature(ex, queryKeyById),
  );
  const matchedExercises = querySigs.filter((sig) =>
    candidateSigs.has(sig),
  ).length;
  const totalQueryExercises = querySigs.length;

  return {
    candidateId: candidate.id,
    candidateTitle: candidate.title,
    cardOverlap: totalQueryCards ? matchedCards / totalQueryCards : 0,
    matchedCards,
    totalQueryCards,
    exerciseOverlap: totalQueryExercises
      ? matchedExercises / totalQueryExercises
      : 0,
    matchedExercises,
    totalQueryExercises,
    titleDistance: levenshtein(
      normaliseTitle(query.title),
      normaliseTitle(candidate.title),
    ),
  };
}

export interface DuplicateResult {
  tier: DuplicateTier;
  /** Best-matching candidate (highest card overlap); null when the
   *  tier is "none" or there are no candidates. */
  match: LessonComparison | null;
  /** Every comparison, sorted by card overlap desc — feeds the
   *  "show differences" view. */
  comparisons: LessonComparison[];
}

export interface DetectDuplicateOptions {
  nearThreshold?: number;
  similarThreshold?: number;
}

/**
 * Classify a lesson against the lessons already in its target set.
 * Advisory only — the caller may always share regardless. NEAR-
 * DUPLICATE at >= 90% card overlap, SIMILAR at >= 70%, else NONE.
 */
export function detectDuplicate(
  query: ContentLesson,
  candidates: readonly ContentLesson[],
  options: DetectDuplicateOptions = {},
): DuplicateResult {
  const near = options.nearThreshold ?? NEAR_DUPLICATE_CARD_OVERLAP;
  const similar = options.similarThreshold ?? SIMILAR_CARD_OVERLAP;
  const comparisons = candidates
    .filter((candidate) => candidate.id !== query.id)
    .map((candidate) => compareLessons(query, candidate))
    .sort(
      (a, b) =>
        b.cardOverlap - a.cardOverlap ||
        b.exerciseOverlap - a.exerciseOverlap,
    );
  const best = comparisons[0] ?? null;
  let tier: DuplicateTier = "none";
  if (best) {
    if (best.cardOverlap >= near) tier = "near_duplicate";
    else if (best.cardOverlap >= similar) tier = "similar";
  }
  return { tier, match: tier === "none" ? null : best, comparisons };
}

/** Return a NEW lesson tagged as a variation of ``originalId``. The
 *  input lesson is not mutated. */
export function markAsVariation(
  lesson: ContentLesson,
  originalId: string,
  note?: string,
): ContentLesson {
  return {
    ...lesson,
    variation_of: originalId,
    variation_note: note?.trim() ? note.trim() : null,
  };
}

/**
 * Build a supplement lesson holding ONLY the exercises in ``query`` that
 * do not already exist in ``original`` (same type + same targeted card
 * keys = "already exists"), plus the cards those new exercises reference.
 * Tagged as a variation of the original. Returns null when there is
 * nothing new to contribute. Neither input is mutated.
 */
export function extractSupplement(
  query: ContentLesson,
  original: ContentLesson,
  note?: string,
): ContentLesson | null {
  const originalKeyById = cardKeyMap(original);
  const originalSigs = new Set(
    exerciseSteps(original).map((ex) =>
      exerciseSignature(ex, originalKeyById),
    ),
  );
  const queryKeyById = cardKeyMap(query);
  const newExerciseSteps: ContentLessonStep[] = query.steps.filter(
    (step) =>
      step.type === "exercise" &&
      step.exercise != null &&
      !originalSigs.has(exerciseSignature(step.exercise, queryKeyById)),
  );
  if (newExerciseSteps.length === 0) return null;

  const neededCardIds = new Set<string>();
  for (const step of newExerciseSteps) {
    for (const id of step.exercise?.card_ids || []) neededCardIds.add(id);
  }
  const cards = query.cards.filter((card) => neededCardIds.has(card.id));
  const totalQueryExercises = Math.max(1, exerciseSteps(query).length);

  return {
    id: `${query.id}-supplement`,
    title: query.title,
    description: query.description ?? null,
    target_language: query.target_language ?? null,
    source_language: query.source_language ?? null,
    estimated_minutes: Math.max(
      1,
      Math.round(
        (query.estimated_minutes || 0) *
          (newExerciseSteps.length / totalQueryExercises),
      ),
    ),
    cards,
    steps: newExerciseSteps,
    variation_of: original.id,
    variation_note: note?.trim() ? note.trim() : null,
  };
}
