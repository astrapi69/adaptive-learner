/**
 * EXP-026 / UGC-04 — fold user-generated sets into the published content
 * tree. Extracted from Content.tsx (#541) as a pure helper so the page
 * component's cyclomatic complexity stays under the gate; this is the
 * branchy placement logic, isolated and unit-testable.
 *
 * A user set's stored ``domain`` is overloaded with its ORIGIN
 * ("analysis" / "adaptive" / "imported"), so the real content domain is
 * derived for placement: a language pair when source != target,
 * otherwise knowledge. A set is only folded once its lessons have loaded
 * (so it never flickers out of "My Lessons" mid-load); matched sets leave
 * the My Lessons fallback (decision E4), unmatched ones stay.
 */

import type { ContentSetEntry } from "../../storage/types";
import type { UserFoldInput } from "./content-tree";
import { baseLanguage } from "./language-utils";
import { resolveTreePlacement } from "./tree-placement";

export interface UserFoldResult {
  /** Sets matched to a published node, ready to fold into the tree. */
  matchedFold: UserFoldInput[];
  /** Sets with no match — they stay in the "My Lessons" fallback. */
  unmatchedUserSets: ContentSetEntry[];
  /** ``source#id`` -> set, for the folded-lesson action callbacks. */
  userSetsByKey: Record<string, ContentSetEntry>;
}

/** Derive the content domain for placement from the language pair. */
function contentDomainOf(set: ContentSetEntry): string {
  return baseLanguage(set.source_language) !== baseLanguage(set.target_language)
    ? "language"
    : "knowledge";
}

/**
 * Split the user-generated sets into the ones that fold into a published
 * tree node and the ones that stay in "My Lessons".
 *
 * @example
 *   const {matchedFold, unmatchedUserSets} = computeUserFold(
 *     userSets, visibleSets, userLessonsBySet,
 *   );
 */
export function computeUserFold(
  userSets: ContentSetEntry[],
  visibleSets: ContentSetEntry[],
  userLessonsBySet: Record<string, UserFoldInput["lessons"]>,
): UserFoldResult {
  const userSetsByKey: Record<string, ContentSetEntry> = Object.fromEntries(
    userSets.map((s) => [`${s.source}#${s.id}`, s]),
  );

  const matchedFold: UserFoldInput[] = [];
  const unmatchedUserSets: ContentSetEntry[] = [];

  for (const set of userSets) {
    const lessons = userLessonsBySet[`${set.source}#${set.id}`];
    const contentDomain = contentDomainOf(set);
    const variationOf = lessons?.find((l) => l.variation_of)?.variation_of ?? null;
    const matched =
      lessons !== undefined &&
      resolveTreePlacement(
        {
          source_language: set.source_language,
          target_language: set.target_language,
          level: set.level,
          domain: contentDomain,
          title: set.title,
          variationOf,
        },
        visibleSets,
      ).matched;
    if (matched) {
      matchedFold.push({ set: { ...set, domain: contentDomain }, lessons: lessons ?? [] });
    } else {
      unmatchedUserSets.push(set);
    }
  }

  return { matchedFold, unmatchedUserSets, userSetsByKey };
}
