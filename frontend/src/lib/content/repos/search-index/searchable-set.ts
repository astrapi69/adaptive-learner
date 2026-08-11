/**
 * The {@link SearchableSet} shape the Discover catalogue searches + filters
 * (EXP-034 / DIS-04). Split out of ``search-index-loader.ts`` (#2562) so
 * ``manifest-search-index.ts`` — the client-side fallback deriver that
 * PRODUCES this same shape from a repo's ``manifest.yaml`` — can depend on
 * the type without importing the network-fetch module, which would import
 * the deriver back (a cycle: fetch needs derive needs the fetch module's
 * type).
 */

import type { SetReviewStatus, SetVisibility } from "../../../../storage/types";

/** Optional book-companion metadata carried in the index. */
export interface SearchIndexBook {
  title: string;
  author?: string | null;
}

/**
 * One set as advertised by a repo's ``search-index.json`` (or derived from
 * its ``manifest.yaml`` — see ``manifest-search-index.ts``), enriched with
 * the repo it came from. This is the unit the discovery UI searches + filters.
 */
export interface SearchableSet {
  id: string;
  name: string;
  description: string;
  source_language: string;
  target_language: string;
  level: string;
  domain: string;
  lesson_count: number;
  card_count: number;
  tags: string[];
  ai_validated: boolean;
  /** Technical/curation trust level (0 unknown .. 3 officially recommended). */
  trust_level: number;
  book: SearchIndexBook | null;
  /** ISO-8601 last-update timestamp, or null when the index omits it. */
  updated_at: string | null;
  /** ``owner/repo`` source identifier the set came from. */
  repo_url: string;
  /** Display name for the repo (a curated title, else ``owner/repo``). */
  repo_name: string;
  /** #1707 — consumer-display visibility advertised by the index entry.
   *  ``"hidden"`` marks a conformance/reference fixture; such entries are
   *  dropped at parse time so they never enter the catalogue. Absent ⇒
   *  visible. */
  visibility?: SetVisibility;
  /** #2299 — review standing advertised by the index entry (engine schema
   *  1.9). ``"generated"`` is machine-generated with the review pending,
   *  ``"reviewed"`` is machine-generated and reviewed, ``"authored"`` is
   *  hand-written and needs none. Absent or out-of-enum ⇒ ``"authored"``,
   *  matching the engine + index-generator normalisation. */
  review_status: SetReviewStatus;
}
