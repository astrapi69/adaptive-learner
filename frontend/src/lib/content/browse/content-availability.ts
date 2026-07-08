/**
 * content-availability — decide whether a piece of learner progress still
 * points at content that can actually be loaded (#1445).
 *
 * Learner progress lives in Dexie independently of the content: removing a
 * content repository drops it from ``activeSources`` / ``listSets`` but leaves
 * the ``lessonProgress`` and ``elementErrors`` rows in place. Those rows then
 * become "orphaned" — a "Weitermachen" card or an SRS review item that leads
 * nowhere. Every surface that turns progress into a startable lesson must hide
 * an orphaned entry (the row itself is NEVER deleted here — it is only made
 * invisible, so re-adding the repo brings the state back; #1445 Part A).
 *
 * The availability oracle is the loadable set list — ``listSets().sets`` —
 * which already contains ONLY the active sources (bundled + official + every
 * connected user repo) in both storage modes. So this module is pure: feed it
 * that list and ask.
 *
 * Two attribution levels, because the two data sources differ:
 *   - ``lessonProgress`` carries ``source`` + ``set_id`` → exact
 *     ({@link isProgressAvailable}).
 *   - ``elementErrors`` (SRS) carries only a bare ``set_id`` (no source) → a
 *     card is available when ANY loadable set carries that id
 *     ({@link ContentAvailability.hasSetId}). This is deliberately safe: it
 *     never hides/deletes a card whose content is still loadable from some
 *     source, at the cost of keeping a card visible when a DIFFERENT connected
 *     repo happens to share the same set id.
 *
 * The official/bundled sources can never be removed and the bundle ships
 * offline, so progress on them is ALWAYS available — even if a transient
 * upstream blip makes ``listSets`` momentarily surface the set under its
 * bundled source id instead of the GitHub one (dedup churn). {@link
 * isProgressAvailable} short-circuits on {@link isOfficialSource} so such a
 * blip never false-orphans official progress.
 */

import { isOfficialSource } from "../repos/source-identity";
import { USER_GENERATED_SOURCE } from "../../../storage/types/content/content";

/**
 * Sources that can never be "removed" and so never orphan their progress:
 * the official/bundled content (ships offline) and locally user-generated
 * lessons ({@link USER_GENERATED_SOURCE}). Progress on these is always
 * available even when a transient ``listSets`` blip omits the exact row.
 */
function isAlwaysAvailableSource(source: string): boolean {
  return isOfficialSource(source) || source === USER_GENERATED_SOURCE;
}

/** A loadable set, identified by its content ``source`` and set ``id``. */
export interface SetKey {
  source: string;
  id: string;
}

/** A progress-shaped row carrying its originating repo ``source``. */
export interface SourcedSetRow {
  source: string;
  set_id: string;
}

/** An SRS-shaped row carrying only a bare (source-less) ``set_id``. */
export interface SetIdRow {
  set_id: string;
}

/** Membership queries over the loadable-set list. */
export interface ContentAvailability {
  /** True when the exact ``(source, setId)`` set is loadable. */
  hasSet(source: string, setId: string): boolean;
  /** True when ANY loadable set carries this bare ``setId`` (for source-less
   *  SRS rows that cannot name their repo). */
  hasSetId(setId: string): boolean;
  /**
   * True when a progress row for ``(source, setId)`` is loadable. Official /
   * bundled sources are always available (never removable, bundled offline);
   * everything else must be an exact hit in the loadable-set list.
   */
  isProgressAvailable(source: string, setId: string): boolean;
}

/**
 * Build a {@link ContentAvailability} from the loadable-set list
 * (``listSets().sets``).
 *
 * @example
 * const a = buildContentAvailability(setsRes.sets);
 * a.isProgressAvailable("jane/repo", "fr-a1"); // false once jane/repo removed
 * a.hasSetId("fr-a1");                          // false unless still loadable
 */
export function buildContentAvailability(
  sets: readonly SetKey[],
): ContentAvailability {
  const pairs = new Set<string>();
  const ids = new Set<string>();
  for (const set of sets) {
    pairs.add(pairKey(set.source, set.id));
    ids.add(set.id);
  }
  return {
    hasSet: (source, setId) => pairs.has(pairKey(source, setId)),
    hasSetId: (setId) => ids.has(setId),
    isProgressAvailable: (source, setId) =>
      isAlwaysAvailableSource(source) || pairs.has(pairKey(source, setId)),
  };
}

function pairKey(source: string, setId: string): string {
  return `${source}#${setId}`;
}

/** Keep only progress rows whose ``(source, set_id)`` is still loadable. */
export function filterAvailableProgress<T extends SourcedSetRow>(
  rows: readonly T[],
  availability: ContentAvailability,
): T[] {
  return rows.filter((row) =>
    availability.isProgressAvailable(row.source, row.set_id),
  );
}

/** Split progress rows into the loadable ones and the orphaned ones. */
export function partitionProgress<T extends SourcedSetRow>(
  rows: readonly T[],
  availability: ContentAvailability,
): { available: T[]; orphaned: T[] } {
  const available: T[] = [];
  const orphaned: T[] = [];
  for (const row of rows) {
    (availability.isProgressAvailable(row.source, row.set_id)
      ? available
      : orphaned
    ).push(row);
  }
  return { available, orphaned };
}

/** Keep only SRS rows whose bare ``set_id`` is still loadable. */
export function filterAvailableSetId<T extends SetIdRow>(
  rows: readonly T[],
  availability: ContentAvailability,
): T[] {
  return rows.filter((row) => availability.hasSetId(row.set_id));
}

/** Split SRS rows into the loadable ones and the orphaned ones. */
export function partitionSetId<T extends SetIdRow>(
  rows: readonly T[],
  availability: ContentAvailability,
): { available: T[]; orphaned: T[] } {
  const available: T[] = [];
  const orphaned: T[] = [];
  for (const row of rows) {
    (availability.hasSetId(row.set_id) ? available : orphaned).push(row);
  }
  return { available, orphaned };
}
