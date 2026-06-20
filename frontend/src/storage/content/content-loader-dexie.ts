/**
 * Client-side Content-Loader for Dexie / GitHub-Pages mode
 * (Phase 43 / EXP-002 / 2C-wire).
 *
 * Mirrors the backend's
 * ``adaptive_learner_content_loader.service.ContentLoaderService``
 * 1:1 in TypeScript:
 *
 * - Fetches manifests + lesson files directly from
 *   raw.githubusercontent.com (no backend in this storage
 *   mode).
 * - Caches downloaded sets in Dexie tables ``contentSets`` +
 *   ``contentSetFiles``.
 * - Reuses the same cache-key shape as the filesystem cache
 *   (``"{source-slug}/{set_id}/{version}"``) so both modes
 *   stay analogous.
 *
 * Default sources match the plugin's settings YAML (the
 * canonical pilot at ``astrapi69/adaptive-learner-content``).
 * A user-visible Settings panel for editing the source list
 * is deferred to a later phase; for v1.27.0 the GH-Pages
 * deployment reads from the bundled default.
 */

import { parse as parseYaml } from "yaml";

import type {
  ContentLesson,
  ContentLessonList,
  ContentSetBook,
  ContentSetEntry,
  ContentSetSource,
  ContentSetsList,
  SaveUserSetInput,
} from "../types";
import { USER_GENERATED_SOURCE } from "../types";
import { isDevMode } from "../../hooks/settings/useDevMode";
import { getDb } from "../dexie/db";
import type { ContentSetRow, ContentSetFileRow } from "../dexie/db";
import { resolveRepoToken } from "../../lib/content/repo-token";
import {
  fetchGitHubFileBytesOptional,
  fetchGitHubFileText,
  fetchWithRetry,
} from "../../lib/content/github-fetch";

const RAW_BASE = "https://raw.githubusercontent.com";
const BUNDLED_PREFIX = "bundled:";

/**
 * Default content sources, tried in order:
 *
 * 1. **Bundled pilots** (Phase 51D / v1.34.0) — fr-a1 + es-a1
 *    shipped as static assets under ``frontend/public/content/``
 *    via the ``copy-bundled-content.mjs`` build hook. Work
 *    offline + on GH Pages with zero external repo. First-time
 *    visitors see lessons immediately.
 * 2. **Upstream content repo** — the canonical pilot at
 *    ``astrapi69/adaptive-learner-content @ main``. Tried after
 *    the bundled sources so the bundle is fastest by default,
 *    but the upstream picks up any newer or community-added
 *    sets the bundle hasn't shipped yet.
 *
 * Sources are consulted in order; the first source that
 * publishes a manifest for a given set_id wins. A bundled
 * source that doesn't exist (dev mode without the build step)
 * fails gracefully and the next source is tried.
 */
const DEFAULT_SOURCES: ContentSetSource[] = [
  // Phase 60 / v1.44.0 — the bundled content is a single tree
  // mirroring the external repo (root manifest + source-language
  // ``sets/{src}/{tgt-level}/`` hierarchy), copied verbatim to
  // ``public/content/adaptive-learner-content/`` by
  // ``copy-bundled-content.mjs``. One bundled source, same tree
  // as GitHub, so same-id sets dedupe cleanly (GitHub wins on a
  // tie; the bundle survives offline).
  { source: `${BUNDLED_PREFIX}adaptive-learner-content`, branch: "" },
  { source: "astrapi69/adaptive-learner-content", branch: "main" },
];

export function slugifySource(source: string): string {
  return source.replace(/[/:]/g, "--");
}

/** Canonical official source (everything else from a user repo). */
const OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content";

/** Plugin whose settings hold the connected user repo (avoids a circular
 *  import on ``content-repos``, which depends on the storage barrel). */
const CONTENT_LOADER_PLUGIN = "content-loader";

/**
 * The connected user repos as sources, read from the ``content-loader``
 * plugin settings (``user_repos`` array; Phase A single ``user_repo`` is
 * migrated). Returns them in list order (precedence: later wins).
 * EXP-023 Phase B.
 */
async function userContentSources(): Promise<ContentSetSource[]> {
  try {
    const row = await getDb().pluginSettings.get(CONTENT_LOADER_PLUGIN);
    const bag = row?.settings as Record<string, unknown> | undefined;
    const list = Array.isArray(bag?.user_repos)
      ? (bag.user_repos as unknown[])
      : bag?.user_repo
        ? [bag.user_repo]
        : [];
    const out: ContentSetSource[] = [];
    for (const item of list) {
      const repo = item as {
        owner?: string;
        repo?: string;
        branch?: string;
        connected?: boolean;
      };
      if (repo?.owner && repo?.repo && repo.connected) {
        out.push({
          source: `${repo.owner}/${repo.repo}`,
          branch: repo.branch || "main",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The sources the loader should consult: the official defaults plus every
 * connected user repo (additive, official first; user repos in list order
 * so a later repo wins a collision). EXP-023 Phase A/B.
 */
export async function activeSourcesDexie(): Promise<ContentSetSource[]> {
  return [...DEFAULT_SOURCES, ...(await userContentSources())];
}

/**
 * Resolve a content source + relative path to a fetchable URL.
 *
 * - **GitHub sources**: ``{owner}/{repo} @ {branch}`` →
 *   ``https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}``
 * - **Bundled sources**: ``bundled:{key}`` → ``{BASE_URL}content/{key}/{path}``
 *   resolved via the Vite static-asset pipeline. ``BASE_URL`` is
 *   ``/`` by default and ``/adaptive-learner/`` for the GH-Pages
 *   build (driven by the ``VITE_BASE`` env var). Branch is
 *   ignored for bundled sources.
 */
function rawUrl(source: string, branch: string, path: string): string {
  const safePath = path.replace(/^\/+/, "");
  if (source.startsWith(BUNDLED_PREFIX)) {
    const key = source.slice(BUNDLED_PREFIX.length);
    const basePath = import.meta.env.BASE_URL ?? "/";
    const normalisedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    return `${normalisedBase}content/${key}/${safePath}`;
  }
  return `${RAW_BASE}/${source}/${branch}/${safePath}`;
}

function cacheKey(source: string, setId: string, version: string): string {
  return `${slugifySource(source)}/${setId}/${version}`;
}

function fileKey(setPk: string, filename: string): string {
  return `${setPk}#${filename}`;
}

/** Per-source token: per-repo / shared for GitHub sources, none for the
 *  bundled (same-origin static) source. EXP-023 Phase B. */
function tokenForSource(source: string): string {
  return source.startsWith(BUNDLED_PREFIX) ? "" : resolveRepoToken(source);
}

/**
 * Fetch a content file's text. Bundled sources are same-origin static assets
 * (no token, no CORS concern); GitHub sources go through the CORS-safe
 * ``github-fetch`` helper (#645) which picks raw-vs-API by auth and retries
 * only transient 5xx failures.
 */
async function fetchText(
  source: string,
  branch: string,
  path: string,
  token = "",
): Promise<string> {
  if (source.startsWith(BUNDLED_PREFIX)) {
    const response = await fetchWithRetry(rawUrl(source, branch, path));
    if (!response.ok) {
      const err: Error & { status?: number } = new Error(
        `Upstream HTTP ${response.status} for ${path}`,
      );
      err.status = response.status;
      throw err;
    }
    return response.text();
  }
  return fetchGitHubFileText(source, branch, path, token);
}

/** Phase 54 / v1.37.0 — fetch raw bytes for an asset.
 *  Returns null on 404 so the download orchestrator can skip
 *  missing assets instead of failing the whole set download. */
async function fetchBytesOptional(
  source: string,
  branch: string,
  path: string,
  token = "",
): Promise<ArrayBuffer | null> {
  if (source.startsWith(BUNDLED_PREFIX)) {
    const response = await fetchWithRetry(rawUrl(source, branch, path));
    if (response.status === 404) return null;
    if (!response.ok) {
      const err: Error & { status?: number } = new Error(
        `Upstream HTTP ${response.status} for ${path}`,
      );
      err.status = response.status;
      throw err;
    }
    return response.arrayBuffer();
  }
  return fetchGitHubFileBytesOptional(source, branch, path, token);
}

/** Convert ArrayBuffer → base64 in chunks to avoid the call-stack
 *  overflow ``btoa(String.fromCharCode(...new Uint8Array(buf)))``
 *  hits on large blobs in some engines. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** Convert base64 → Uint8Array (the inverse of the above). */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Guess MIME type from an asset path's extension. The Dexie
 *  store keeps the bytes only; the resolver hook needs the
 *  MIME to instantiate the Blob with a sensible default.
 *  Phase 54B / v1.37.0. */
export function mimeTypeForAssetPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

interface ParsedSetAsset {
  path: string;
  size_kb: number;
}

interface ParsedSet {
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

/** Manifest \`sets[].book\` block (#769). */
interface ParsedSetBook {
  title?: string;
  author?: string | null;
  url?: string | null;
  asin?: string | null;
}

/** Project a raw manifest book block into a {@link ContentSetBook}, or
 *  ``null`` when it has no title (#769). */
function asContentSetBook(book: ParsedSetBook | undefined): ContentSetBook | null {
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
function setBasePath(parsed: { id: string; path?: string }): string {
  return parsed.path ?? `sets/${parsed.id}`;
}

/** Resolve the language pair from a parsed manifest set,
 *  honouring the pre-v1.2 ``language`` alias and the "en"
 *  default for ``source_language`` (mirrors the backend
 *  ContentSet model). */
function resolveLanguagePair(parsed: {
  language?: string;
  target_language?: string;
  source_language?: string;
}): { target: string; source: string } {
  return {
    target: parsed.target_language ?? parsed.language ?? "",
    source: parsed.source_language ?? "en",
  };
}

interface ParsedManifest {
  schema_version?: string;
  name?: string;
  description?: string | null;
  sets?: ParsedSet[];
  metadata?: Record<string, unknown>;
}

function asContentSetEntry(
  src: ContentSetSource,
  parsed: ParsedSet,
  cachedVersion: string | null,
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
    book: asContentSetBook(parsed.book),
  };
}

/** Numeric semver compare. Returns >0 if a>b, <0 if a<b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = String(a ?? "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function isBundledSource(source: string): boolean {
  return source.startsWith(BUNDLED_PREFIX);
}

/**
 * Dedupe content sets that the same ``id`` advertises from more
 * than one source (a bundled pilot + the external repo). Keeps the
 * higher version; on a version tie prefers the external (GitHub)
 * copy, which is likelier to be current. When the external source
 * is unreachable only the bundled entry is present, so bundled wins
 * by default and the offline fallback stays intact. The winning
 * entry carries its own ``source``, so the UI badge reflects where
 * the surfaced version came from.
 */
export function dedupeContentEntries(
  entries: ContentSetEntry[],
): ContentSetEntry[] {
  const isOfficial = (source: string): boolean =>
    source === OFFICIAL_SOURCE || isBundledSource(source);
  const winners = new Map<string, ContentSetEntry>();
  for (const entry of entries) {
    const current = winners.get(entry.id);
    if (!current) {
      winners.set(entry.id, entry);
      continue;
    }
    // EXP-023 Phase A/B — a user repo always wins a same-id collision
    // with the official content. Between two user repos, the one later
    // in the source order (= later in the user's repo list, higher
    // precedence) wins.
    const currentOfficial = isOfficial(current.source);
    const entryOfficial = isOfficial(entry.source);
    if (currentOfficial !== entryOfficial) {
      if (currentOfficial) winners.set(entry.id, entry);
      continue;
    }
    if (!entryOfficial) {
      winners.set(entry.id, entry);
      continue;
    }
    const cmp = compareVersions(entry.version, current.version);
    if (cmp > 0) {
      winners.set(entry.id, entry);
    } else if (
      cmp === 0 &&
      isBundledSource(current.source) &&
      !isBundledSource(entry.source)
    ) {
      winners.set(entry.id, entry);
    }
  }
  return [...winners.values()];
}

async function rowToCachedEntry(row: ContentSetRow): Promise<ContentSetEntry> {
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.tags || "[]");
    if (Array.isArray(parsed)) {
      tags = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* malformed JSON in the tags column — fall through */
  }
  const target = row.target_language ?? row.language;
  const source = row.source_language ?? "en";
  return {
    source: row.source,
    branch: row.branch,
    id: row.set_id,
    title: row.title,
    title_native: row.title_native ?? null,
    language: target,
    target_language: target,
    source_language: source,
    level: row.level,
    domain: row.domain,
    version: row.version,
    lesson_count: row.lesson_count,
    description: row.description,
    tags,
    cover_image: row.cover_image,
    cached_version: row.version,
    update_available: false,
    book: row.book ?? null,
  };
}

async function latestCachedRow(
  source: string,
  setId: string,
): Promise<ContentSetRow | null> {
  const db = getDb();
  const rows = await db.contentSets
    .where("set_id")
    .equals(setId)
    .filter((r) => r.source === source)
    .toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => (a.version < b.version ? -1 : 1));
  return rows[rows.length - 1];
}

export async function listSetsDexie(
  sources: ContentSetSource[] = DEFAULT_SOURCES,
): Promise<ContentSetsList> {
  const entries: ContentSetEntry[] = [];
  for (const src of sources) {
    const token = tokenForSource(src.source);
    let manifest: ParsedManifest | null;
    try {
      const text = await fetchText(
        src.source,
        src.branch,
        "manifest.yaml",
        token,
      );
      manifest = (parseYaml(text) ?? null) as ParsedManifest | null;
    } catch (err) {
      // Upstream offline / 404 / network failure: fall
      // back to whatever this source has cached so the
      // Set Browser stays usable on a flaky connection.
      const db = getDb();
      const cached = await db.contentSets
        .where("source")
        .equals(src.source)
        .toArray();
      for (const row of cached) {
        entries.push(await rowToCachedEntry(row));
      }
      // Expected for the not-yet-published upstream content repo
      // (the bundled pilots already loaded above). Only surface
      // the diagnostic in Developer Mode so production users don't
      // see repeated warnings for a graceful, by-design fallback.
      if (isDevMode()) {
        console.warn(
          `content-loader: upstream ${src.source}@${src.branch} unreachable, surfacing cached only`,
          err,
        );
      }
      continue;
    }
    if (!manifest || !Array.isArray(manifest.sets)) continue;
    for (const parsed of manifest.sets) {
      const cached = await latestCachedRow(src.source, parsed.id);
      entries.push(
        asContentSetEntry(src, parsed, cached ? cached.version : null),
      );
    }
  }
  // Collapse same-id sets advertised by more than one source
  // (bundled pilot + external repo) to a single row before the
  // user-generated lessons (which carry unique ids) are appended.
  const deduped = dedupeContentEntries(entries);
  // Phase 59B — user-generated sets ("My Lessons") aren't an
  // upstream source; surface them from IndexedDB directly.
  const db = getDb();
  const userRows = await db.contentSets
    .where("source")
    .equals(USER_GENERATED_SOURCE)
    .toArray();
  for (const row of userRows) {
    deduped.push(await rowToCachedEntry(row));
  }
  return { sets: deduped, sources };
}

export async function downloadSetDexie(
  source: string,
  setId: string,
  sources: ContentSetSource[] = DEFAULT_SOURCES,
  onProgress?: (progress: { current: number; total: number }) => void,
): Promise<ContentSetEntry> {
  const src = sources.find((s) => s.source === source) ?? {
    source,
    branch: "main",
  };
  const token = tokenForSource(src.source);

  // Repo manifest → find the target set entry.
  const repoText = await fetchText(
    src.source,
    src.branch,
    "manifest.yaml",
    token,
  );
  const repoManifest = parseYaml(repoText) as ParsedManifest;
  const target = (repoManifest.sets ?? []).find((s) => s.id === setId);
  if (!target) {
    const err: Error & { status?: number } = new Error(
      `Set ${setId} not advertised by ${source}`,
    );
    err.status = 404;
    throw err;
  }

  // Reconcile: idempotent re-download.
  const cached = await latestCachedRow(source, setId);
  if (cached && cached.version === target.version) {
    return asContentSetEntry(src, target, cached.version);
  }

  // Set manifest → lesson filename list. Honours the
  // source-language tree via the set's ``path`` field.
  const basePath = setBasePath(target);
  const setManifestText = await fetchText(
    src.source,
    src.branch,
    `${basePath}/manifest.yaml`,
    token,
  );
  const setManifest = parseYaml(setManifestText) as ParsedManifest;
  let lessonFilenames: string[];
  const metaLessons = setManifest.metadata?.lessons;
  if (
    Array.isArray(metaLessons) &&
    metaLessons.every((x) => typeof x === "string")
  ) {
    lessonFilenames = metaLessons as string[];
  } else {
    // Fallback: conventional NN.json indices from 1..count.
    lessonFilenames = [];
    for (let i = 1; i <= target.lesson_count; i++) {
      lessonFilenames.push(`${String(i).padStart(2, "0")}.json`);
    }
  }

  // Fetch every lesson, reporting per-lesson progress (DIS-06) so the UI
  // can render "lesson N of M" while a single set downloads.
  const lessonBodies: Record<string, string> = {};
  const lessonTotal = lessonFilenames.length;
  onProgress?.({ current: 0, total: lessonTotal });
  let lessonsDone = 0;
  for (const filename of lessonFilenames) {
    lessonBodies[filename] = await fetchText(
      src.source,
      src.branch,
      `${basePath}/lessons/${filename}`,
      token,
    );
    lessonsDone += 1;
    onProgress?.({ current: lessonsDone, total: lessonTotal });
  }

  // Phase 54 / v1.37.0 — fetch declared assets alongside
  // the lessons. Assets that 404 upstream are dropped
  // silently so a stale manifest entry doesn't fail the
  // whole set download; the frontend falls back to a
  // placeholder SVG / text-only display for missing
  // images. Asset bytes get base64-encoded so they fit in
  // the existing ``contentSetFiles.body`` text column —
  // no Dexie schema bump needed.
  const assetBodies: Record<string, string> = {};
  for (const asset of target.assets ?? []) {
    const buf = await fetchBytesOptional(
      src.source,
      src.branch,
      `${basePath}/assets/${asset.path}`,
      token,
    );
    if (buf === null) continue;
    assetBodies[asset.path] = arrayBufferToBase64(buf);
  }

  // Persist atomically — Dexie transaction over both tables.
  const db = getDb();
  const setPk = cacheKey(source, setId, target.version);
  const pair = resolveLanguagePair(target);
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    const row: ContentSetRow = {
      id: setPk,
      source,
      branch: src.branch,
      set_id: setId,
      version: target.version,
      title: target.title,
      title_native: target.title_native ?? null,
      language: pair.target,
      target_language: pair.target,
      source_language: pair.source,
      level: target.level,
      domain: target.domain ?? "language",
      lesson_count: target.lesson_count,
      description: target.description ?? null,
      tags: JSON.stringify(target.tags ?? []),
      cover_image: target.cover_image ?? null,
      downloaded_at: new Date().toISOString(),
      manifest_yaml: setManifestText,
      book: asContentSetBook(target.book),
    };
    await db.contentSets.put(row);

    const files: ContentSetFileRow[] = [];
    for (const [filename, body] of Object.entries(lessonBodies)) {
      files.push({
        id: fileKey(setPk, `lessons/${filename}`),
        set_pk: setPk,
        filename: `lessons/${filename}`,
        body,
        encoding: "text",
      });
    }
    // Phase 54 — store binary asset bodies as base64
    // under ``assets/{rel_path}`` filenames so the
    // getAsset lookup is a single keyed read. The
    // ``encoding: "base64"`` flag tells the reader
    // (getAssetDexie below) to decode + wrap in a Blob.
    for (const [relPath, b64] of Object.entries(assetBodies)) {
      files.push({
        id: fileKey(setPk, `assets/${relPath}`),
        set_pk: setPk,
        filename: `assets/${relPath}`,
        body: b64,
        encoding: "base64",
      });
    }
    files.push({
      id: fileKey(setPk, "manifest.yaml"),
      set_pk: setPk,
      filename: "manifest.yaml",
      body: setManifestText,
      encoding: "text",
    });
    await db.contentSetFiles.bulkPut(files);

    const staleRows = await db.contentSets
      .where("set_id")
      .equals(setId)
      .filter((r) => r.source === source && r.id !== setPk)
      .toArray();
    for (const staleRow of staleRows) {
      await db.contentSetFiles
        .where("set_pk")
        .equals(staleRow.id)
        .delete();
      await db.contentSets.delete(staleRow.id);
    }
  });

  return asContentSetEntry(src, target, target.version);
}

export async function listLessonsDexie(
  source: string,
  setId: string,
): Promise<ContentLessonList> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) {
    const err: Error & { status?: number } = new Error(
      `Set ${source}/${setId} is not cached.`,
    );
    err.status = 404;
    throw err;
  }
  const db = getDb();
  const files = await db.contentSetFiles
    .where("set_pk")
    .equals(cached.id)
    .toArray();
  const lessons = files
    .map((f) => f.filename)
    .filter((name) => name.startsWith("lessons/"))
    .map((name) => name.slice("lessons/".length))
    .sort();
  return {
    set_id: setId,
    source,
    version: cached.version,
    lessons,
  };
}

export async function getLessonDexie(
  source: string,
  setId: string,
  filename: string,
): Promise<ContentLesson> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) {
    const err: Error & { status?: number } = new Error(
      `Set ${source}/${setId} is not cached.`,
    );
    err.status = 404;
    throw err;
  }
  const db = getDb();
  const file = await db.contentSetFiles.get(
    fileKey(cached.id, `lessons/${filename}`),
  );
  if (!file) {
    const err: Error & { status?: number } = new Error(
      `Lesson ${filename} not found in ${source}/${setId}`,
    );
    err.status = 404;
    throw err;
  }
  const parsed = JSON.parse(file.body) as ContentLesson;
  // Lessons don't carry the language pair / domain — the parent set is
  // authoritative (see ContentLesson docs). Inject them from the cached
  // set row so consumers that gate on them work; notably the per-theory
  // read-aloud button (canRead requires lesson.target_language), which
  // was silently absent in Dexie mode without this. A lesson that
  // declares its own (e.g. an exported standalone) keeps it.
  return {
    ...parsed,
    target_language:
      parsed.target_language ?? cached.target_language ?? cached.language,
    source_language: parsed.source_language ?? cached.source_language,
    domain: parsed.domain ?? cached.domain,
  };
}

/** Phase 54 / v1.37.0 — read a cached asset by relative path
 *  (e.g. ``img/sunrise.png``). Returns null when the set isn't
 *  cached or the asset wasn't bundled with the download (the
 *  resolver hook then falls back to a placeholder SVG /
 *  text-only display).
 *
 *  Assets are stored base64-encoded in ``contentSetFiles.body``
 *  alongside the lessons; this function decodes them and wraps
 *  the bytes in a Blob with the MIME type inferred from the
 *  path extension. The caller (asset resolver) is responsible
 *  for ``URL.createObjectURL`` + ``URL.revokeObjectURL``. */
export async function getAssetDexie(
  source: string,
  setId: string,
  assetPath: string,
): Promise<Blob | null> {
  const cached = await latestCachedRow(source, setId);
  if (!cached) return null;
  const db = getDb();
  const file = await db.contentSetFiles.get(
    fileKey(cached.id, `assets/${assetPath}`),
  );
  if (!file) return null;
  if (file.encoding !== "base64") {
    // Defensive: the download orchestrator always writes
    // assets with ``encoding: "base64"``; an unknown
    // encoding means the row was written by a future
    // version we don't understand. Falling back to null is
    // safer than guessing.
    return null;
  }
  const bytes = base64ToBytes(file.body);
  // Cast through ArrayBuffer because the Blob constructor's
  // BlobPart type wants an ArrayBuffer-backed view, not a
  // generic ArrayBufferLike (SharedArrayBuffer would not
  // round-trip through atob anyway).
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: mimeTypeForAssetPath(assetPath),
  });
}

// ---------------------------------------------------------------------------
// Phase 59B / v1.42.0 — user-generated sets (My Lessons)
// ---------------------------------------------------------------------------

/** User-generated sets carry a single, fixed version: re-saving an
 *  edited lesson overwrites in place rather than accumulating
 *  versions (the cache-version machinery is for upstream updates).
 *  Matches the backend's ``USER_SET_VERSION``. */
const USER_SET_VERSION = "1.0.0";

/** Persist a user-generated set into the same Dexie tables as
 *  downloaded sets. Overwrites any prior set with the same
 *  ``set_id`` under the user-generated source. */
export async function saveUserSetDexie(
  input: SaveUserSetInput,
  now: string,
): Promise<ContentSetEntry> {
  const db = getDb();
  const setPk = cacheKey(USER_GENERATED_SOURCE, input.set_id, USER_SET_VERSION);
  const targetLanguage = input.target_language ?? input.language;
  const sourceLanguage = input.source_language ?? "en";
  const row: ContentSetRow = {
    id: setPk,
    source: USER_GENERATED_SOURCE,
    branch: "",
    set_id: input.set_id,
    version: USER_SET_VERSION,
    title: input.title,
    title_native: input.title_native ?? null,
    language: targetLanguage,
    target_language: targetLanguage,
    source_language: sourceLanguage,
    level: input.level,
    domain: input.origin,
    lesson_count: input.lessons.length,
    description: input.description ?? null,
    tags: "[]",
    cover_image: null,
    downloaded_at: now,
    manifest_yaml: "",
  };
  const files: ContentSetFileRow[] = input.lessons.map((lesson) => ({
    id: fileKey(setPk, `lessons/${lesson.id}.json`),
    set_pk: setPk,
    filename: `lessons/${lesson.id}.json`,
    body: JSON.stringify(lesson),
    encoding: "text",
  }));
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    await _purgeSetRows(USER_GENERATED_SOURCE, input.set_id);
    await db.contentSets.put(row);
    await db.contentSetFiles.bulkPut(files);
  });
  return rowToCachedEntry(row);
}

/** Delete every cached row (set + files) for a source/set_id pair. */
export async function deleteSetDexie(
  source: string,
  setId: string,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    await _purgeSetRows(source, setId);
  });
}

/** Internal: remove the set rows + their files. Must run inside an
 *  existing ``rw`` transaction on both tables. */
async function _purgeSetRows(source: string, setId: string): Promise<void> {
  const db = getDb();
  const rows = await db.contentSets
    .where("set_id")
    .equals(setId)
    .filter((r) => r.source === source)
    .toArray();
  for (const existing of rows) {
    await db.contentSetFiles.where("set_pk").equals(existing.id).delete();
    await db.contentSets.delete(existing.id);
  }
}
