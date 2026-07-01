/**
 * Content-Engine (EXP-042) — the source→canonical boundary (frontend).
 *
 * Barrel re-export. The engine owns the canonical parse/transform of raw
 * content into the canonical internal format ({@link ContentLesson} /
 * {@link ContentSetEntry}); fetch + Dexie + UI stay in the caller.
 */
export type {
  LessonSetContext,
  LessonSourceAdapter,
  ParsedManifest,
  ParsedSet,
  ParsedSetAsset,
  ParsedSetBook,
} from "./content-engine";
export {
  asContentSetBook,
  asContentSetEntry,
  parseLesson,
  parseManifest,
  resolveLanguagePair,
  setBasePath,
  singleJsonLessonAdapter,
} from "./content-engine";
