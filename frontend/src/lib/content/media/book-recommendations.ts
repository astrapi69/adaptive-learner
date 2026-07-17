/**
 * Per-domain book recommendations (#141, federated per #1712).
 *
 * A maintainer-curated ``books.yaml`` maps a content DOMAIN (e.g.
 * ``psychology``, ``ai``) to a small list of recommended books. The file
 * historically lived at the root of the official content repository; the
 * domain federation (adaptive-learner-content#146/#149) moved each domain
 * section into its own repo (``alc-psychology``, ``alc-ai``, …) and deleted
 * the official-root file entirely — fetching it there was a guaranteed
 * console 404 on every /content mount (#1712).
 *
 * The catalogue is therefore sourced from the federated registry
 * (``recommended-repos.json``): ONLY entries flagged ``books: true`` are
 * asked for their ``books.yaml`` (at the pinned registry ref), so a repo
 * without the file is never requested and the console stays clean — the
 * same don't-request-known-absent pattern the registry itself used before
 * it was published (#547). Fetching rides the GitHub-raw path (no server),
 * so it works in BOTH storage modes (API + Dexie / GitHub-Pages).
 *
 * Failure is non-fatal: an unreachable registry or repo resolves to the
 * cached catalogue (or ``{}``) so the Content Browser simply shows no book
 * section (rule: a function not available is not offered). A
 * stale-while-revalidate ``localStorage`` cache keeps the last good
 * catalogue available offline and refreshes it on the next load.
 *
 * Recommendations only — no affiliate links, direct Amazon URLs only.
 */

import { parse as parseYaml } from "yaml";

import {
  fetchRecommendedRepos,
  recommendedRef,
  recommendedSource,
  type RecommendedRepo,
} from "../repos/recommended-repos";

const CACHE_KEY = "adaptive-learner.book-recommendations";

/** One recommended book. ``title`` + ``author`` + ``url`` are required;
 *  everything else is optional metadata the card shows when present. */
export interface Book {
  title: string;
  subtitle?: string | null;
  author: string;
  url: string;
  isbn?: string | null;
  asin?: string | null;
  language?: string | null;
  pages?: number | null;
  year?: number | null;
  description?: string | null;
  tags?: string[];
}

/** ``domain -> books``. Empty when nothing is published / reachable. */
export type BookRecommendations = Record<string, Book[]>;

function isBook(value: unknown): value is Book {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.title === "string" &&
    typeof b.author === "string" &&
    typeof b.url === "string" &&
    /^https?:\/\//i.test(b.url)
  );
}

/** Project a parsed ``books.yaml`` document into the domain map, keeping
 *  only well-formed entries with a valid http(s) ``url``. */
function projectDocument(doc: unknown): BookRecommendations {
  const domains =
    doc && typeof doc === "object"
      ? (doc as { domains?: unknown }).domains
      : undefined;
  if (!domains || typeof domains !== "object") return {};
  const out: BookRecommendations = {};
  for (const [domain, block] of Object.entries(
    domains as Record<string, unknown>,
  )) {
    const books = (block as { books?: unknown })?.books;
    if (!Array.isArray(books)) continue;
    const valid = books.filter(isBook);
    if (valid.length > 0) out[domain] = valid;
  }
  return out;
}

function readCache(): BookRecommendations {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as BookRecommendations)
      : {};
  } catch {
    return {};
  }
}

function writeCache(value: BookRecommendations): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable / full — the live fetch still works.
  }
}

/** The raw ``books.yaml`` URL of a flagged registry entry, or null. */
function booksUrl(rec: RecommendedRepo): string | null {
  const source = recommendedSource(rec);
  if (!source) return null;
  return `https://raw.githubusercontent.com/${source}/${recommendedRef(rec)}/books.yaml`;
}

/**
 * Fetch the per-domain book recommendations from every registry entry
 * flagged ``books: true``, merging their domain sections. Never throws.
 *
 * Repos without the flag are never requested (#1712 — no console-404
 * noise for a file that is known to be absent). Stale-while-revalidate:
 * the cached catalogue (if any) is the fallback when the registry is
 * unreachable, no entry is flagged, or every flagged fetch fails; a
 * successful round refreshes it. Returns ``{}`` when nothing is cached
 * and nothing could be fetched.
 */
export async function fetchBookRecommendations(): Promise<BookRecommendations> {
  try {
    const catalogue = await fetchRecommendedRepos();
    const flagged = catalogue.filter((rec) => rec.books === true);
    if (flagged.length === 0) return readCache();
    const merged: BookRecommendations = {};
    let anyFetched = false;
    for (const rec of flagged) {
      const url = booksUrl(rec);
      if (!url) continue;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const projected = projectDocument(parseYaml(await response.text()));
        anyFetched = true;
        for (const [domain, books] of Object.entries(projected)) {
          merged[domain] = [...(merged[domain] ?? []), ...books];
        }
      } catch {
        // One unreachable repo never breaks the round; skip it.
      }
    }
    if (!anyFetched) return readCache();
    writeCache(merged);
    return merged;
  } catch {
    return readCache();
  }
}

/** Books recommended for one domain, or ``[]``. */
export function booksForDomain(
  recommendations: BookRecommendations,
  domain: string | null | undefined,
): Book[] {
  if (!domain) return [];
  return recommendations[domain] ?? [];
}
