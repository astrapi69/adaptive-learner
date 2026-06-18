/**
 * Per-domain supplementary media resources (EXP-029 / MED-01, MED-02, MED-05).
 *
 * A maintainer-curated ``media.yaml`` at the root of the official content
 * repository maps a content DOMAIN (``language`` / ``ai`` / ``psychology`` …)
 * to a small list of supplementary media — videos, podcasts, articles,
 * books, courses, websites. Like {@link ./book-recommendations}, fetching
 * needs no server: it rides the same GitHub-raw path as the content itself,
 * so it works in BOTH storage modes (API + Dexie / GitHub-Pages).
 *
 * Failure is non-fatal: a missing / malformed file resolves to ``[]`` so the
 * UI simply shows no media section (rule: a feature not available is not
 * offered). A stale-while-revalidate ``localStorage`` cache keeps the last
 * good catalogue available offline and refreshes it in the background.
 *
 * Curation filter (EXP-029 §3): the gate is RECIPROCITY, not price. Free
 * media (youtube / podcast / article / book) are always allowed; ``course``
 * and ``website`` require a proven, documented partnership and are dropped
 * unless ``partnership: true`` — the parser fails closed so an entry without
 * proven reciprocity never appears even if someone writes it into the YAML.
 * Affiliate links are rejected outright (recommendations, not advertising).
 */

import { parse as parseYaml } from "yaml";

const OFFICIAL_OWNER_REPO = "astrapi69/adaptive-learner-content";
const MEDIA_URL = `https://raw.githubusercontent.com/${OFFICIAL_OWNER_REPO}/main/media.yaml`;
const CACHE_KEY = "adaptive-learner.media-resources";

/** A supplementary-media type. ``course`` and ``website`` require a proven
 *  partnership (see {@link PARTNERSHIP_REQUIRED}); the rest are always
 *  allowed when free. */
export type MediaType =
  | "youtube"
  | "podcast"
  | "article"
  | "book"
  | "course"
  | "website";

const MEDIA_TYPES: ReadonlySet<string> = new Set<MediaType>([
  "youtube",
  "podcast",
  "article",
  "book",
  "course",
  "website",
]);

/** Types that only appear with documented reciprocity (EXP-029 §3). An entry
 *  of one of these types without ``partnership: true`` is dropped. */
const PARTNERSHIP_REQUIRED: ReadonlySet<MediaType> = new Set<MediaType>([
  "course",
  "website",
]);

/**
 * One supplementary-media resource attached to a domain (and, for
 * lesson-level entries, inheriting the set's domain). ``type`` + ``title`` +
 * ``url`` + ``domain`` are required; everything else is optional metadata a
 * card surfaces when present.
 */
export interface MediaResource {
  type: MediaType;
  title: string;
  /** http(s), validated; affiliate links are rejected. */
  url: string;
  /** The content domain this resource belongs to (empty for an unscoped
   *  lesson-level resource whose set domain is unknown). */
  domain: string;
  /** BCP-47-ish code of the resource language (``de`` / ``en`` …). */
  language?: string | null;
  /** ``beginner`` | ``intermediate`` | ``advanced``, where meaningful. */
  level?: string | null;
  /** Human-readable duration (e.g. ``"19min"``) for video / podcast. */
  duration?: string | null;
  description?: string | null;
  author?: string | null;
  /** ``true`` = free, ``false`` = paid (drives the Gratis/Kurs badge);
   *  ``null`` when unspecified. */
  free?: boolean | null;
  /** ``true`` = reciprocity proven (required for ``course`` / ``website``). */
  partnership?: boolean;
  tags?: string[];
  /** Optional sort weight (#769). Lower sorts first; ``null`` means "use the
   *  default" ({@link DEFAULT_MEDIA_PRIORITY}). An auto-inserted set book is
   *  given priority ``0`` so it leads the "Vertiefe das Thema" section. */
  priority?: number | null;
}

/** Default sort weight for a media item without an explicit ``priority``
 *  (#769). Videos/podcasts/articles land here; an auto-book uses ``0``. */
export const DEFAULT_MEDIA_PRIORITY = 10;

/** The effective sort weight of a resource: its ``priority`` when set,
 *  else {@link DEFAULT_MEDIA_PRIORITY}. */
export function effectiveMediaPriority(resource: MediaResource): number {
  return typeof resource.priority === "number"
    ? resource.priority
    : DEFAULT_MEDIA_PRIORITY;
}

/** A set's manifest-level book block (#769). Only the fields the media card
 *  needs; ``url`` OR ``asin`` must be present to yield a clickable link. */
export interface SetBook {
  title: string;
  author?: string | null;
  /** Direct (non-affiliate) http(s) link to the book, when given. */
  url?: string | null;
  /** Amazon ASIN; used to build a link when ``url`` is absent. */
  asin?: string | null;
}

/** Build the Amazon product URL for an ASIN (locale-neutral .com; ASINs
 *  resolve on every marketplace). */
function amazonUrlForAsin(asin: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
}

/**
 * Project a set's manifest \`book\` block into a priority-0 ``book``
 * {@link MediaResource} so it leads the lesson's media list (#769), or
 * ``null`` when the book has neither a ``url`` nor an ``asin`` (no link to
 * offer) or no title.
 *
 * @param book the set-level book block.
 * @param domain the set's content domain (stamped on the resource).
 */
export function bookToMediaResource(
  book: SetBook | null | undefined,
  domain: string,
): MediaResource | null {
  if (!book) return null;
  const title = asString(book.title);
  if (!title) return null;
  const url = asString(book.url) ?? (book.asin ? amazonUrlForAsin(book.asin) : null);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return {
    type: "book",
    title,
    url,
    domain,
    author: asString(book.author),
    free: false,
    priority: 0,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Reject affiliate / referral URLs (recommendations, not advertising — house
 * convention from #141). Detects the common affiliate query parameters
 * (Amazon Associates ``tag``, generic ``affiliate``/``aff_id``/``partner_id``).
 * A non-parseable URL is treated as "not affiliate" — the http(s) check in
 * {@link projectMediaResource} already rejects it.
 */
export function isAffiliateUrl(url: string): boolean {
  const affiliateParams = new Set([
    "tag",
    "affiliate",
    "affiliate_id",
    "aff_id",
    "partner_id",
    "partnerid",
  ]);
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (affiliateParams.has(key.toLowerCase())) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Project one raw YAML entry into a {@link MediaResource}, or ``null`` when
 * it is invalid. Enforces: type in the union, http(s) ``url``, no affiliate
 * link, and the reciprocity gate for ``course`` / ``website``.
 *
 * @param value the raw entry from the parsed document.
 * @param domain the domain to stamp on the resource.
 */
export function projectMediaResource(
  value: unknown,
  domain: string,
): MediaResource | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const type = asString(entry.type);
  const title = asString(entry.title);
  const url = asString(entry.url);
  if (!type || !MEDIA_TYPES.has(type)) return null;
  if (!title || !url || !/^https?:\/\//i.test(url)) return null;
  if (isAffiliateUrl(url)) return null;

  const mediaType = type as MediaType;
  const partnership = entry.partnership === true;
  if (PARTNERSHIP_REQUIRED.has(mediaType) && !partnership) return null;

  const tags = Array.isArray(entry.tags)
    ? entry.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    type: mediaType,
    title,
    url,
    domain,
    language: asString(entry.language),
    level: asString(entry.level),
    duration: asString(entry.duration),
    description: asString(entry.description),
    author: asString(entry.author),
    free: typeof entry.free === "boolean" ? entry.free : null,
    partnership,
    priority: typeof entry.priority === "number" ? entry.priority : null,
    ...(tags && tags.length > 0 ? { tags } : {}),
  };
}

/** Iterate one domain's entry list (a bare array, or a ``{ media: [...] }``
 *  block in the books.yaml style) and collect the valid resources. */
function collectDomain(
  domain: string,
  block: unknown,
  out: MediaResource[],
): void {
  const list = Array.isArray(block)
    ? block
    : block && typeof block === "object"
      ? (block as { media?: unknown }).media
      : undefined;
  if (!Array.isArray(list)) return;
  for (const entry of list) {
    const resource = projectMediaResource(entry, domain);
    if (resource) out.push(resource);
  }
}

/**
 * Parse a ``media.yaml`` document text into a flat list of valid resources,
 * each stamped with its domain. Never throws — malformed YAML yields ``[]``.
 *
 * Supports both the flat top-level ``<domain>: [entries]`` shape (as
 * published) and a ``domains:`` wrapper (the books.yaml shape).
 */
export function parseMediaYaml(yamlText: string): MediaResource[] {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch {
    return [];
  }
  if (!doc || typeof doc !== "object") return [];
  const root = doc as Record<string, unknown>;
  const domains =
    root.domains && typeof root.domains === "object"
      ? (root.domains as Record<string, unknown>)
      : root;
  const out: MediaResource[] = [];
  for (const [domain, block] of Object.entries(domains)) {
    collectDomain(domain, block, out);
  }
  return out;
}

/**
 * Validate a lesson-level ``resources[]`` array (EXP-029 / MED-05) into
 * {@link MediaResource}s, inheriting the lesson/set ``domain``. The same gate
 * as {@link parseMediaYaml} applies. Returns ``[]`` for a missing / non-array
 * input so the caller never has to guard.
 */
export function parseLessonResources(
  raw: unknown,
  domain?: string | null,
): MediaResource[] {
  if (!Array.isArray(raw)) return [];
  const out: MediaResource[] = [];
  for (const entry of raw) {
    const resource = projectMediaResource(entry, domain ?? "");
    if (resource) out.push(resource);
  }
  return out;
}

/** The resources for one domain, or ``[]``. */
export function mediaForDomain(
  resources: MediaResource[],
  domain: string | null | undefined,
): MediaResource[] {
  if (!domain) return [];
  return resources.filter((resource) => resource.domain === domain);
}

function readCache(): MediaResource[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MediaResource[]) : [];
  } catch {
    return [];
  }
}

function writeCache(value: MediaResource[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable / full — the live fetch still works.
  }
}

/**
 * Fetch the per-domain media catalogue from the official content repo. Never
 * throws.
 *
 * Stale-while-revalidate: a cached catalogue (if any) is the fallback when
 * the network is unavailable, and a successful fetch refreshes it. Returns
 * ``[]`` when nothing is cached and the fetch fails.
 */
export async function fetchMediaResources(): Promise<MediaResource[]> {
  try {
    const response = await fetch(MEDIA_URL);
    if (!response.ok) return readCache();
    const resources = parseMediaYaml(await response.text());
    writeCache(resources);
    return resources;
  } catch {
    return readCache();
  }
}
