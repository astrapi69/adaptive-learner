/**
 * EXP-046 item 4 / #2655 — derivation recording on fork.
 *
 * Every "save as a copy" path (``ImportLessonModal``,
 * ``CreateLesson.saveCopy``, ``useEditAsCopy``) forks a set — foreign or
 * the learner's own — into a new user-generated copy. This module is the
 * single place that decides what provenance the fork carries forward, so
 * the three call sites cannot drift.
 *
 * Scope decision (EXP-046 Teil 3.2/3.4): a fork is not a re-authoring
 * event. The local editor has no account-backed identity, and their own
 * credit is a separate, share-time opt-in (``ShareWizardStep1``,
 * ``readContributorName``) — untouched here. So the existing set-level
 * ``attribution`` simply carries forward (bounded to the schema's 8-entry
 * ``derived_from`` chain); when the source has none, a single-entry
 * attribution is synthesized from the first lesson's ``contributed_by``
 * credit (the "basiert auf" / "based on" case). The name travels as
 * unverified text only (EXP-046 Teil 3.3) — never rendered as verified.
 */

import type { ContentLesson, SetAttribution, SetDerivedFromItem } from "../../../storage/types";

/** ``attribution.derived_from`` bound (schema/content-set.schema.json,
 *  engine#90 / schema 1.9: ``maxItems: 8``). */
const MAX_DERIVED_FROM_ITEMS = 8;

/** Stamp ``variation_of`` on one forked lesson, pointing at
 *  ``originalLessonId`` (the id the lesson had in its source set —
 *  distinct from this lesson's own id when the fork path assigns a
 *  fresh one, e.g. ``CreateLesson.saveCopy``). Returns a new lesson
 *  object; the input is left untouched. */
export function withVariationOf(
  lesson: ContentLesson,
  originalLessonId: string,
): ContentLesson {
  return { ...lesson, variation_of: originalLessonId };
}

/** Stamp ``variation_of`` on every forked lesson, pointing at the
 *  lesson's own id. Use this when the fork path does NOT remap lesson
 *  ids (``ImportLessonModal``, ``useEditAsCopy`` — #1740 / #2654), so
 *  the unchanged id IS the original lesson's id within its (now former)
 *  parent set — exactly what the schema field documents ("holds the
 *  original lesson's id"). Returns new lesson objects; the input array
 *  is left untouched. */
export function stampVariationOf(lessons: ContentLesson[]): ContentLesson[] {
  return lessons.map((lesson) => withVariationOf(lesson, lesson.id));
}

/** Bound a derivation chain to the schema's 8-entry cap. Per the schema
 *  description, the origin (first entry) always stays; when over the
 *  cap, the oldest MIDDLE entry is what drops (chain remains oldest
 *  first). A chain already within bounds is returned unchanged. */
function boundDerivedFromChain(chain: SetDerivedFromItem[]): SetDerivedFromItem[] {
  if (chain.length <= MAX_DERIVED_FROM_ITEMS) return chain;
  const kept = chain.slice(chain.length - (MAX_DERIVED_FROM_ITEMS - 1));
  return [chain[0], ...kept];
}

/**
 * Build the forked set's ``attribution`` block from what the source
 * set/lessons already carry.
 *
 * @param sourceAttribution - the source set's own ``attribution``
 *   (``entry.attribution``), if any.
 * @param sourceLessons - the source set's lessons, read for a
 *   ``contributed_by`` credit when the set itself carries no
 *   attribution yet.
 * @returns the attribution to persist on the fork, or ``null`` when
 *   there is nothing to credit.
 */
export function buildForkAttribution(
  sourceAttribution: SetAttribution | null | undefined,
  sourceLessons: ContentLesson[],
): SetAttribution | null {
  if (sourceAttribution) {
    const derivedFrom = sourceAttribution.derived_from;
    return {
      author: sourceAttribution.author,
      ...(derivedFrom ? { derived_from: boundDerivedFromChain(derivedFrom) } : {}),
    };
  }
  const contributedBy = sourceLessons
    .map((lesson) => lesson.contributed_by?.trim())
    .find((name): name is string => !!name);
  return contributedBy ? { author: contributedBy } : null;
}

/** Translate function shape, matching ``useI18n().t``. */
type Translate = (key: string, fallback?: string) => string;

/**
 * EXP-046 Teil 3.2/3.3 — the compact "basiert auf {author}" credit line
 * for a forked set's attribution, or ``null`` when there is nothing to
 * credit. The name is plain, unverified text (never rendered as a
 * verified/checked claim): when the derivation chain holds more than
 * the immediate origin, the line collapses to "... and others" rather
 * than listing every step.
 */
export function forkCreditLine(
  attribution: SetAttribution | null | undefined,
  t: Translate,
): string | null {
  if (!attribution) return null;
  const chain = attribution.derived_from ?? [];
  if (chain.length === 0) {
    return t("content.fork.based_on", "Based on {author}").replace(
      "{author}",
      attribution.author,
    );
  }
  return t("content.fork.based_on_and_others", "Based on {author} and others").replace(
    "{author}",
    chain[0].author,
  );
}
