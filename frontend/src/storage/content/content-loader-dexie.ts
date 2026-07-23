/**
 * Client-side Content-Loader for Dexie / GitHub-Pages mode
 * (Phase 43 / EXP-002 / 2C-wire).
 *
 * Mirrors the backend's
 * ``adaptive_learner_content_loader.service.ContentLoaderService``
 * 1:1 in TypeScript: fetches manifests + lesson files directly from
 * raw.githubusercontent.com (no backend in this storage mode) and
 * caches downloaded sets in Dexie tables ``contentSets`` +
 * ``contentSetFiles``, reusing the filesystem cache-key shape
 * (``"{source-slug}/{set_id}/{version}"``) so both modes stay
 * analogous.
 *
 * Split by concern (#1780) - this module is the stable import hub
 * for the loader's public surface; the implementations live in:
 *
 * - ``content-loader-sources.ts`` - source list, URL/cache keys,
 *   token resolution, fetch + encoding helpers
 * - ``content-loader-listing.ts`` - cached-row projection, dedupe,
 *   ``listSetsDexie``
 * - ``content-loader-download.ts`` - ``downloadSetDexie``
 * - ``content-loader-read.ts`` - lesson list / lesson / asset reads
 * - ``content-loader-user-sets.ts`` - "My Lessons" persistence +
 *   set lifecycle (status, delete, bulk ops)
 * - ``content-loader-dexie-ai.ts`` - AI validation cache (#704,
 *   the first extraction)
 */

export {
  activeSourcesDexie,
  mimeTypeForAssetPath,
  slugifySource,
} from "./content-loader-sources";
export {
  dedupeContentEntries,
  listSetsDexie,
} from "./content-loader-listing";
export { downloadSetDexie } from "./content-loader-download";
export {
  getAssetDexie,
  getLessonDexie,
  listLessonsDexie,
} from "./content-loader-read";
export {
  deleteSetDexie,
  deleteSetsDexie,
  saveUserSetDexie,
  setSetStatusDexie,
  setSetsStatusDexie,
  type SetRef,
} from "./content-loader-user-sets";
