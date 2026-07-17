/**
 * Content-Loader source + fetch layer (#1780 — extracted from
 * content-loader-dexie.ts).
 *
 * Owns everything BEFORE the Dexie cache: the source list (bundled
 * defaults + connected user repos), source→URL resolution, cache-key
 * shapes, per-source token resolution, the text/bytes fetch helpers,
 * and the base64/MIME encoding utilities the asset pipeline needs.
 */

import type { ContentSetSource } from "../types";
import { getDb } from "../dexie/db";
import { resolveRepoToken } from "../../lib/content/repos/repo-token";
import {
  fetchGitHubFileBytesOptional,
  fetchGitHubFileText,
  fetchWithRetry,
} from "../../lib/content/repos/github-fetch";

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
export const DEFAULT_SOURCES: ContentSetSource[] = [
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
export const OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content";

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

export function cacheKey(
  source: string,
  setId: string,
  version: string,
): string {
  return `${slugifySource(source)}/${setId}/${version}`;
}

export function fileKey(setPk: string, filename: string): string {
  return `${setPk}#${filename}`;
}

export function isBundledSource(source: string): boolean {
  return source.startsWith(BUNDLED_PREFIX);
}

/** Per-source token: per-repo / shared for GitHub sources, none for the
 *  bundled (same-origin static) source. EXP-023 Phase B. */
export function tokenForSource(source: string): string {
  return source.startsWith(BUNDLED_PREFIX) ? "" : resolveRepoToken(source);
}

/**
 * Fetch a content file's text. Bundled sources are same-origin static assets
 * (no token, no CORS concern); GitHub sources go through the CORS-safe
 * ``github-fetch`` helper (#645) which picks raw-vs-API by auth and retries
 * only transient 5xx failures.
 */
export async function fetchText(
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
export async function fetchBytesOptional(
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
export function arrayBufferToBase64(buf: ArrayBuffer): string {
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
export function base64ToBytes(b64: string): Uint8Array {
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
