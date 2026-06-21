/**
 * Author book-companion metadata (EXP-025 / AUTH-02, #142).
 *
 * A content repo that accompanies a published book declares an optional
 * ``book`` block at the root of its ``manifest.yaml`` (one book per repo,
 * decision E1; schema enforced by the content-repo validator, AUTH-01).
 * This module fetches that block for a connected repo so the Content
 * Browser can show a discreet "book companion" header with a "Zum Buch"
 * link (decision E5).
 *
 * Like {@link ./book-recommendations}, fetching needs no server — it
 * rides the same GitHub-raw path as the content itself, so it works in
 * BOTH storage modes (API + Dexie / GitHub-Pages). Failure is non-fatal:
 * a missing / malformed block resolves to ``null`` (a feature not
 * available is not offered), with a stale-while-revalidate localStorage
 * cache for offline use.
 *
 * Direct, non-affiliate URLs only (house convention #141).
 */

import { parse as parseYaml } from "yaml";

const CACHE_PREFIX = "adaptive-learner.book-companion:";

/** The book a content repo accompanies. ``title`` / ``author`` / ``url``
 *  are required; the rest is optional metadata the card surfaces. */
export interface BookMetadata {
  title: string;
  author: string;
  /** Direct (non-affiliate) http(s) link to the book. */
  url: string;
  subtitle?: string | null;
  isbn?: string | null;
  asin?: string | null;
  language?: string | null;
  pages?: number | null;
  year?: number | null;
  description?: string | null;
  edition?: string | null;
  /** Absolute URL of the cover image, resolved from the repo-relative
   *  ``cover`` field; null when none was declared. */
  coverUrl?: string | null;
}

/** A source is a connectable repo only when it is not the build-time
 *  bundled content (which has no GitHub-raw manifest to read). */
export function isFetchableSource(source: string): boolean {
  return !source.startsWith("bundled:");
}

function rawBase(source: string, branch: string): string {
  return `https://raw.githubusercontent.com/${source}/${branch || "main"}`;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Project a parsed manifest's ``book`` block into {@link BookMetadata},
 *  or null when the required fields are missing / malformed. */
export function projectBook(
  doc: unknown,
  source: string,
  branch: string,
): BookMetadata | null {
  const book =
    doc && typeof doc === "object"
      ? (doc as { book?: unknown }).book
      : undefined;
  if (!book || typeof book !== "object") return null;
  const b = book as Record<string, unknown>;
  const title = asString(b.title);
  const author = asString(b.author);
  const url = asString(b.url);
  if (!title || !author || !url || !/^https?:\/\//i.test(url)) return null;
  const cover = asString(b.cover);
  return {
    title,
    author,
    url,
    subtitle: asString(b.subtitle),
    isbn: asString(b.isbn),
    asin: asString(b.asin),
    language: asString(b.language),
    pages: asInt(b.pages),
    year: asInt(b.year),
    description: asString(b.description),
    edition: asString(b.edition),
    coverUrl: cover ? `${rawBase(source, branch)}/${cover}` : null,
  };
}

function readCache(source: string): BookMetadata | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + source);
    return raw ? (JSON.parse(raw) as BookMetadata) : null;
  } catch {
    return null;
  }
}

function writeCache(source: string, value: BookMetadata | null): void {
  try {
    if (value) localStorage.setItem(CACHE_PREFIX + source, JSON.stringify(value));
    else localStorage.removeItem(CACHE_PREFIX + source);
  } catch {
    /* localStorage unavailable — the live fetch still works */
  }
}

/**
 * Fetch the book a connected repo accompanies. Never throws.
 *
 * Stale-while-revalidate: a cached entry is the fallback when the
 * network is unavailable; a successful fetch refreshes it. Returns
 * ``null`` for the bundled source, or when nothing is cached and the
 * fetch fails / the repo declares no book.
 *
 * @param source repo source id ("owner/repo"); bundled sources are
 *   skipped.
 * @param branch the repo branch (defaults to ``main``).
 */
export async function fetchBookCompanion(
  source: string,
  branch: string,
): Promise<BookMetadata | null> {
  if (!isFetchableSource(source)) return null;
  try {
    const response = await fetch(`${rawBase(source, branch)}/manifest.yaml`);
    if (!response.ok) return readCache(source);
    const doc = parseYaml(await response.text());
    const projected = projectBook(doc, source, branch);
    writeCache(source, projected);
    return projected;
  } catch {
    return readCache(source);
  }
}
