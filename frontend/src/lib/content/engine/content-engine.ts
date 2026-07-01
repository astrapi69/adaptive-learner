/**
 * Content-Engine (EXP-042) — the source→canonical boundary, frontend half.
 *
 * The **canonical internal format** is the single-JSON lesson object
 * ({@link ContentLesson}, schema_version 1.4, EXP-039). A **source adapter**
 * turns raw source data into that canonical object; today exactly one adapter
 * exists (single-JSON). A future multi-file adapter (lesson.yaml + theory.md +
 * cards.yaml + exercises.yaml) plugs in at this same boundary without touching
 * fetch, Dexie, or the UI.
 *
 * This module is **library-grade**: it imports only content *types*, never the
 * GitHub fetcher, the Dexie DB, or React. That import boundary IS the
 * lib-extraction seam (Konsument → Engine, never Engine → Konsument): everything
 * here is what a standalone content-engine package would contain; network and
 * persistence stay in the caller (`storage/content/content-loader-dexie.ts`).
 *
 * The concept names mirror the backend `content_engine` module 1:1
 * (`content engine`, `single-json` source adapter, `canonical Lesson`) so a
 * later cross-language parity golden can pin both sides to the same form.
 */

import { parse as parseYaml } from "yaml";

import type {
  ContentLesson,
  ContentSetBook,
  ContentSetEntry,
  ContentSetSource,
  SetStatus,
} from "../../../storage/types";

/** Manifest ``sets[].book`` block (#769). */
export interface ParsedSetBook {
  title?: string;
  author?: string | null;
  url?: string | null;
  asin?: string | null;
}

/** Phase 54 / v1.37.0 — declared asset bundled with a set. */
export interface ParsedSetAsset {
  path: string;
  size_kb: number;
}

/** One ``sets[]`` entry as it appears in a raw parsed manifest. */
export interface ParsedSet {
  id: string;
  title: string;
  /** Optional title in the target language (native script). */
  title_native?: string;
  /** Legacy pre-v1.2 key — the target language. Accepted as an
   *  alias for ``target_language``. */
  language?: string;
  /** Phase 60 / v1.44.0 — the language the learner is LEARNING. */
  target_language?: string;
  /** Phase 60 / v1.44.0 — the language the learner already
   *  SPEAKS (card backs / notes / theory). Defaults to "en". */
  source_language?: string;
  level: string;
  version: string;
  lesson_count: number;
  domain?: string;
  description?: string | null;
  tags?: string[];
  cover_image?: string | null;
  /** Phase 54 / v1.37.0 — declared assets bundled with the set. */
  assets?: ParsedSetAsset[];
  /** Phase 60 / v1.44.0 — repo-relative dir for the set's files
   *  (source-language tree, e.g. ``sets/de/fr-a1``). Falls back
   *  to ``sets/{id}`` when omitted. */
  path?: string;
  /** #769 — optional set-level book block (title/author/url/asin). */
  book?: ParsedSetBook;
}

/** A parsed ``manifest.yaml`` document (repo-level or set-level). */
export interface ParsedManifest {
  schema_version?: string;
  name?: string;
  description?: string | null;
  sets?: ParsedSet[];
  metadata?: Record<string, unknown>;
}

/**
 * Set-level context a lesson inherits (its language pair + domain). A lesson
 * file does not carry these — the parent set is authoritative — so the
 * single-JSON adapter injects them when producing the canonical lesson. The
 * Dexie set row ({@link ContentSetRow}) structurally satisfies this shape.
 */
export interface LessonSetContext {
  language: string;
  target_language: string;
  source_language: string;
  domain: string;
}

/**
 * A source adapter: raw source text + set context → canonical {@link ContentLesson}.
 * Today the only implementation is {@link singleJsonLessonAdapter}; a multi-file
 * adapter (EXP-042 §6) would satisfy the same signature.
 */
export type LessonSourceAdapter = (
  rawText: string,
  context: LessonSetContext,
) => ContentLesson;

/** Parse + validate a raw ``manifest.yaml`` payload into a {@link ParsedManifest}.
 *  Deserialization only — the canonical projection is {@link asContentSetEntry}. */
export function parseManifest(text: string): ParsedManifest | null {
  return (parseYaml(text) ?? null) as ParsedManifest | null;
}

/** Project a raw manifest book block into a {@link ContentSetBook}, or
 *  ``null`` when it has no title (#769). */
export function asContentSetBook(book: ParsedSetBook | undefined): ContentSetBook | null {
  if (!book || typeof book.title !== "string" || !book.title.trim()) return null;
  return {
    title: book.title,
    author: typeof book.author === "string" ? book.author : null,
    url: typeof book.url === "string" ? book.url : null,
    asin: typeof book.asin === "string" ? book.asin : null,
  };
}

/** Repo-relative base dir for a set's manifest / lessons /
 *  assets. Mirrors the backend ``ContentSet.base_path``. */
export function setBasePath(parsed: { id: string; path?: string }): string {
  return parsed.path ?? `sets/${parsed.id}`;
}

/** Resolve the language pair from a parsed manifest set,
 *  honouring the pre-v1.2 ``language`` alias and the "en"
 *  default for ``source_language`` (mirrors the backend
 *  ContentSet model). */
export function resolveLanguagePair(parsed: {
  language?: string;
  target_language?: string;
  source_language?: string;
}): { target: string; source: string } {
  return {
    target: parsed.target_language ?? parsed.language ?? "",
    source: parsed.source_language ?? "en",
  };
}

/** Project a raw parsed manifest set into a canonical {@link ContentSetEntry}. */
export function asContentSetEntry(
  src: ContentSetSource,
  parsed: ParsedSet,
  cachedVersion: string | null,
  downloadedAt: string | null = null,
  status: SetStatus = "active",
): ContentSetEntry {
  const updateAvailable =
    cachedVersion !== null && cachedVersion !== parsed.version;
  const { target, source } = resolveLanguagePair(parsed);
  return {
    source: src.source,
    branch: src.branch,
    id: parsed.id,
    title: parsed.title,
    title_native: parsed.title_native ?? null,
    language: target,
    target_language: target,
    source_language: source,
    level: parsed.level,
    domain: parsed.domain ?? "language",
    version: parsed.version,
    lesson_count: parsed.lesson_count,
    description: parsed.description ?? null,
    tags: parsed.tags ?? [],
    cover_image: parsed.cover_image ?? null,
    cached_version: cachedVersion,
    update_available: updateAvailable,
    downloaded_at: downloadedAt,
    status,
    book: asContentSetBook(parsed.book),
  };
}

/**
 * The single-JSON source adapter: raw lesson JSON text + set context →
 * canonical {@link ContentLesson}.
 *
 * A lesson file does not carry the language pair / domain — the parent set is
 * authoritative — so those are injected from ``context`` when absent (a lesson
 * that declares its own, e.g. an exported standalone, keeps it). This is the
 * only place the raw-JSON → canonical transform happens in Dexie mode.
 */
export const singleJsonLessonAdapter: LessonSourceAdapter = (rawText, context) => {
  const parsed = JSON.parse(rawText) as ContentLesson;
  return {
    ...parsed,
    target_language:
      parsed.target_language ?? context.target_language ?? context.language,
    source_language: parsed.source_language ?? context.source_language,
    domain: parsed.domain ?? context.domain,
  };
};

/**
 * Parse raw source data into a canonical {@link ContentLesson} via a source
 * adapter (default: {@link singleJsonLessonAdapter}). This is the FE
 * content-engine entry point consumed by the Dexie loader; a future multi-file
 * adapter is passed here instead, with no change to the caller's fetch/storage.
 */
export function parseLesson(
  rawText: string,
  context: LessonSetContext,
  adapter: LessonSourceAdapter = singleJsonLessonAdapter,
): ContentLesson {
  return adapter(rawText, context);
}
