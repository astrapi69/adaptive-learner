/**
 * Content-Engine (EXP-042) — the source→canonical boundary, consumed from
 * the published ``learn-content-engine`` npm package (#1401).
 *
 * The engine was extracted VERBATIM from this module's former local
 * implementation (``content-engine.ts``, deleted with #1401); since the
 * mirror decoupling (#1393–#1398) the package is the single home of the
 * format logic: manifest parse (``parseManifest``), set projection
 * (``asContentSetEntry`` / ``asContentSetBook`` / ``setBasePath``), the
 * pre-v1.2 legacy alias + language pair (``resolveLanguagePair``), and the
 * lesson parse with set-context inheritance (``parseLesson`` /
 * ``singleJsonLessonAdapter``). Fetch + Dexie + UI stay in the caller.
 *
 * This barrel is the ONLY module that touches the engine package. It keeps
 * the App-authoritative generated content types (Pydantic SoT →
 * ``make sync-schema``; see ``storage/types``) on every signature: the
 * engine's own types are byte-parity-gated to the same schema
 * (``engine-schema-parity.test.ts`` + ``check_engine_schema_parity.py``),
 * so the casts below are shape-identical today — and when the app schema
 * moves FIRST (the intended chain order: app → engine release → pin bump),
 * app code keeps compiling against the app types instead of deadlocking on
 * the engine release.
 *
 * The engine's ``validateLesson``/``validateManifest`` are deliberately NOT
 * re-exported: the app's generation/import-time validation
 * (``validateGeneratedLesson`` + ``validateLessonShape``) has its own rule
 * set and wording, and keeping the validators out of this barrel keeps the
 * engine's ajv entry out of the runtime bundle.
 *
 * @example
 * const manifest = parseManifest(rawYaml);
 * const entry = asContentSetEntry(src, manifest!.sets![0], null);
 * const lesson = parseLesson(rawJson, { language: "fr",
 *   target_language: "fr", source_language: "de", domain: "language" });
 */

import {
  asContentSetBook as engineAsContentSetBook,
  asContentSetEntry as engineAsContentSetEntry,
  parseLesson as engineParseLesson,
  parseManifest as engineParseManifest,
  resolveLanguagePair,
  setBasePath,
  singleJsonLessonAdapter as engineSingleJsonLessonAdapter,
} from "learn-content-engine";
import type {
  ContentSetSource as EngineContentSetSource,
  LessonSetContext,
  LessonSourceAdapter as EngineLessonSourceAdapter,
  ParsedManifest,
  ParsedSet,
  ParsedSetAsset,
  ParsedSetBook,
  SetStatus as EngineSetStatus,
} from "learn-content-engine";

import type {
  ContentLesson,
  ContentSetBook,
  ContentSetEntry,
  ContentSetSource,
  SetStatus,
} from "../../../storage/types";

export type {
  LessonSetContext,
  ParsedManifest,
  ParsedSet,
  ParsedSetAsset,
  ParsedSetBook,
};

/** A source adapter: raw source text + set context → canonical
 *  {@link ContentLesson} (app-typed; see the module note on types). */
export type LessonSourceAdapter = (
  rawText: string,
  context: LessonSetContext,
) => ContentLesson;

/** Parse a raw ``manifest.yaml`` payload into a {@link ParsedManifest}.
 *  Deserialization only — the canonical projection is
 *  {@link asContentSetEntry}. */
export function parseManifest(text: string): ParsedManifest | null {
  return engineParseManifest(text);
}

/** Project a raw manifest book block into a {@link ContentSetBook}, or
 *  ``null`` when it has no title. */
export function asContentSetBook(
  book: ParsedSetBook | undefined,
): ContentSetBook | null {
  return engineAsContentSetBook(book) as ContentSetBook | null;
}

export { resolveLanguagePair, setBasePath };

/** Project a raw parsed manifest set into a canonical
 *  {@link ContentSetEntry}. */
export function asContentSetEntry(
  src: ContentSetSource,
  parsed: ParsedSet,
  cachedVersion: string | null,
  downloadedAt?: string | null,
  status?: SetStatus,
): ContentSetEntry {
  return engineAsContentSetEntry(
    src as EngineContentSetSource,
    parsed,
    cachedVersion,
    downloadedAt,
    status as EngineSetStatus | undefined,
  ) as ContentSetEntry;
}

/** The single-JSON source adapter: raw lesson JSON text + set context →
 *  canonical {@link ContentLesson}. The set context (language pair +
 *  domain) is injected when the lesson does not carry its own. */
export const singleJsonLessonAdapter: LessonSourceAdapter = (
  rawText,
  context,
) => engineSingleJsonLessonAdapter(rawText, context) as ContentLesson;

/** Parse raw source data into a canonical {@link ContentLesson} via a
 *  source adapter (default: {@link singleJsonLessonAdapter}). */
export function parseLesson(
  rawText: string,
  context: LessonSetContext,
  adapter?: LessonSourceAdapter,
): ContentLesson {
  return engineParseLesson(
    rawText,
    context,
    adapter as EngineLessonSourceAdapter | undefined,
  ) as ContentLesson;
}
