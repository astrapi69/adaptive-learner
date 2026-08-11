/**
 * Client-side fallback: derive Discover-searchable sets directly from a
 * connected user repo's ``manifest.yaml`` when it has no ``search-index.json``
 * (#2562). "Meine Inhalte" already reads this same file live (no local
 * download required — see ``content-repo-validate.ts``); this mirrors that
 * manifest shape into the {@link SearchableSet} the Discover catalogue
 * consumes, so a repo the user connects works in Discover even when its
 * owner never ran the engine's ``generate_search_index.py``.
 *
 * Deliberately scoped to connected USER repos only — the curated
 * ``recommended-repos.json`` registry keeps its strict validated-snapshot
 * contract (see ``REGISTER-A-REPO.md``) and never falls back to a live
 * manifest read; the caller (``search-index-loader.ts``) only invokes this
 * for repos explicitly flagged ``allowManifestFallback``.
 *
 * Fields the manifest cannot supply are defaulted — the same asymmetry
 * ``repo-export.ts``'s ``buildSearchIndexJson`` documents in the opposite
 * (export) direction: ``card_count`` would need fetching every lesson file
 * (0, a documented limitation, not a bug), ``ai_validated`` (false, no
 * generator signal), ``trust_level`` (the repo's own registry floor only, no
 * per-set signal), ``updated_at`` (null).
 *
 * Pure: no network, no storage. The caller supplies the already-fetched
 * manifest text.
 */

import { asContentSetBook, parseManifest, type ParsedSet } from "../../engine";
import type { SetReviewStatus, SetVisibility } from "../../../../storage/types";
import type { SearchableSet } from "./searchable-set";

const REVIEW_STATUS_VALUES: readonly SetReviewStatus[] = [
  "authored",
  "generated",
  "reviewed",
];

/** Same absent/unknown-means-``authored`` normalisation as the engine and
 *  the ``search-index.json`` reader — both ends of the chain must read a
 *  missing/invalid value the same way. */
function asReviewStatus(value: unknown): SetReviewStatus {
  return REVIEW_STATUS_VALUES.includes(value as SetReviewStatus)
    ? (value as SetReviewStatus)
    : "authored";
}

/**
 * Project one raw ``manifest.yaml`` set entry into a {@link SearchableSet}.
 *
 * Returns ``null`` for an entry missing its required ``id``, or one marked
 * ``visibility: "hidden"`` — same drop rule ``search-index-loader.ts``
 * applies to a ``search-index.json`` entry, so a manifest-derived and an
 * index-published set behave identically in the Discover catalogue.
 */
export function deriveSearchableSet(
  set: ParsedSet,
  repoSource: string,
  repoName: string,
  trustFloor: number,
): SearchableSet | null {
  const id = set.id?.trim();
  if (!id) return null;
  const visibility: SetVisibility =
    set.visibility === "hidden" ? "hidden" : "visible";
  if (visibility === "hidden") return null;
  return {
    id,
    name: set.title || id,
    description: set.description ?? "",
    source_language: set.source_language ?? "",
    target_language: set.target_language ?? set.language ?? "",
    level: set.level ?? "",
    domain: set.domain || "language",
    lesson_count: set.lesson_count ?? 0,
    card_count: 0,
    tags: set.tags ?? [],
    ai_validated: false,
    trust_level: trustFloor,
    book: asContentSetBook(set.book),
    updated_at: null,
    repo_url: repoSource,
    repo_name: repoName,
    visibility,
    review_status: asReviewStatus(set.review_status),
  };
}

/**
 * Parse a raw ``manifest.yaml`` payload into {@link SearchableSet}s for one
 * repo. Never throws — an unparseable manifest, or one with no ``sets``,
 * resolves to ``[]``.
 */
export function deriveSearchIndexFromManifest(
  manifestText: string,
  repoSource: string,
  repoName: string,
  trustFloor = 0,
): SearchableSet[] {
  // parseManifest wraps the YAML library's parse, which THROWS on malformed
  // syntax (it does not return null for that case) - only a well-formed
  // document with no ``sets`` resolves to the empty-array branch below.
  let manifest;
  try {
    manifest = parseManifest(manifestText);
  } catch {
    return [];
  }
  const sets = manifest?.sets ?? [];
  return sets
    .map((set) => deriveSearchableSet(set, repoSource, repoName, trustFloor))
    .filter((s): s is SearchableSet => s !== null);
}
