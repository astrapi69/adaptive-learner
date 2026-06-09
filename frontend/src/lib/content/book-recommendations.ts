/**
 * Per-domain book recommendations (#141).
 *
 * A maintainer-curated ``books.yaml`` at the root of the official content
 * repository maps a content DOMAIN (e.g. ``psychology``, ``programming``)
 * to a small list of recommended books. Like the recommended-repos
 * catalogue (EXP-023 Phase C), fetching it needs no server — it rides the
 * same GitHub-raw path as the content itself, so it works in BOTH storage
 * modes (API + Dexie / GitHub-Pages).
 *
 * Failure is non-fatal: a missing / malformed file resolves to ``{}`` so
 * the Content Browser simply shows no book section (rule: a function not
 * available is not offered). A stale-while-revalidate ``localStorage``
 * cache keeps the last good catalogue available offline and refreshes it
 * in the background on the next load.
 *
 * Recommendations only — no affiliate links, direct Amazon URLs only.
 */

import { parse as parseYaml } from "yaml";

const OFFICIAL_OWNER_REPO = "astrapi69/adaptive-learner-content";
const BOOKS_URL = `https://raw.githubusercontent.com/${OFFICIAL_OWNER_REPO}/main/books.yaml`;
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

/**
 * Fetch the per-domain book recommendations. Never throws.
 *
 * Stale-while-revalidate: a cached catalogue (if any) is the fallback
 * when the network is unavailable, and a successful fetch refreshes it.
 * Returns ``{}`` when nothing is cached and the fetch fails.
 */
export async function fetchBookRecommendations(): Promise<BookRecommendations> {
  try {
    const response = await fetch(BOOKS_URL);
    if (!response.ok) return readCache();
    const doc = parseYaml(await response.text());
    const projected = projectDocument(doc);
    writeCache(projected);
    return projected;
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
