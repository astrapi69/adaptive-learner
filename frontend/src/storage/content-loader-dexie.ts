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

import {parse as parseYaml} from "yaml";

import type {
    ContentLesson,
    ContentLessonList,
    ContentSetEntry,
    ContentSetSource,
    ContentSetsList,
} from "./types";
import {getDb} from "./db";
import type {ContentSetRow, ContentSetFileRow} from "./db";

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
    {source: `${BUNDLED_PREFIX}fr-a1`, branch: ""},
    {source: `${BUNDLED_PREFIX}es-a1`, branch: ""},
    {source: "astrapi69/adaptive-learner-content", branch: "main"},
];

function slugifySource(source: string): string {
    return source.replace(/[/:]/g, "--");
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

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        const err: Error & {status?: number} = new Error(
            `Upstream HTTP ${response.status} for ${url}`,
        );
        err.status = response.status;
        throw err;
    }
    return response.text();
}

interface ParsedSet {
    id: string;
    title: string;
    language: string;
    level: string;
    version: string;
    lesson_count: number;
    domain?: string;
    description?: string | null;
    tags?: string[];
    cover_image?: string | null;
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
    return {
        source: src.source,
        branch: src.branch,
        id: parsed.id,
        title: parsed.title,
        language: parsed.language,
        level: parsed.level,
        domain: parsed.domain ?? "language",
        version: parsed.version,
        lesson_count: parsed.lesson_count,
        description: parsed.description ?? null,
        tags: parsed.tags ?? [],
        cover_image: parsed.cover_image ?? null,
        cached_version: cachedVersion,
        update_available: updateAvailable,
    };
}

async function rowToCachedEntry(
    row: ContentSetRow,
): Promise<ContentSetEntry> {
    let tags: string[] = [];
    try {
        const parsed: unknown = JSON.parse(row.tags || "[]");
        if (Array.isArray(parsed)) {
            tags = parsed.filter((x): x is string => typeof x === "string");
        }
    } catch {
        /* malformed JSON in the tags column — fall through */
    }
    return {
        source: row.source,
        branch: row.branch,
        id: row.set_id,
        title: row.title,
        language: row.language,
        level: row.level,
        domain: row.domain,
        version: row.version,
        lesson_count: row.lesson_count,
        description: row.description,
        tags,
        cover_image: row.cover_image,
        cached_version: row.version,
        update_available: false,
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
        let manifest: ParsedManifest | null = null;
        try {
            const text = await fetchText(
                rawUrl(src.source, src.branch, "manifest.yaml"),
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
            // eslint-disable-next-line no-console
            console.warn(
                `content-loader: upstream ${src.source}@${src.branch} unreachable, surfacing cached only`,
                err,
            );
            continue;
        }
        if (!manifest || !Array.isArray(manifest.sets)) continue;
        for (const parsed of manifest.sets) {
            const cached = await latestCachedRow(src.source, parsed.id);
            entries.push(
                asContentSetEntry(
                    src,
                    parsed,
                    cached ? cached.version : null,
                ),
            );
        }
    }
    return {sets: entries, sources};
}

export async function downloadSetDexie(
    source: string,
    setId: string,
    sources: ContentSetSource[] = DEFAULT_SOURCES,
): Promise<ContentSetEntry> {
    const src =
        sources.find((s) => s.source === source) ?? {source, branch: "main"};

    // Repo manifest → find the target set entry.
    const repoText = await fetchText(
        rawUrl(src.source, src.branch, "manifest.yaml"),
    );
    const repoManifest = parseYaml(repoText) as ParsedManifest;
    const target = (repoManifest.sets ?? []).find((s) => s.id === setId);
    if (!target) {
        const err: Error & {status?: number} = new Error(
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

    // Set manifest → lesson filename list.
    const setManifestText = await fetchText(
        rawUrl(src.source, src.branch, `sets/${setId}/manifest.yaml`),
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

    // Fetch every lesson.
    const lessonBodies: Record<string, string> = {};
    for (const filename of lessonFilenames) {
        lessonBodies[filename] = await fetchText(
            rawUrl(
                src.source,
                src.branch,
                `sets/${setId}/lessons/${filename}`,
            ),
        );
    }

    // Persist atomically — Dexie transaction over both tables.
    const db = getDb();
    const setPk = cacheKey(source, setId, target.version);
    await db.transaction(
        "rw",
        db.contentSets,
        db.contentSetFiles,
        async () => {
            const row: ContentSetRow = {
                id: setPk,
                source,
                branch: src.branch,
                set_id: setId,
                version: target.version,
                title: target.title,
                language: target.language,
                level: target.level,
                domain: target.domain ?? "language",
                lesson_count: target.lesson_count,
                description: target.description ?? null,
                tags: JSON.stringify(target.tags ?? []),
                cover_image: target.cover_image ?? null,
                downloaded_at: new Date().toISOString(),
                manifest_yaml: setManifestText,
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
            files.push({
                id: fileKey(setPk, "manifest.yaml"),
                set_pk: setPk,
                filename: "manifest.yaml",
                body: setManifestText,
                encoding: "text",
            });
            await db.contentSetFiles.bulkPut(files);
        },
    );

    return asContentSetEntry(src, target, target.version);
}

export async function listLessonsDexie(
    source: string,
    setId: string,
): Promise<ContentLessonList> {
    const cached = await latestCachedRow(source, setId);
    if (!cached) {
        const err: Error & {status?: number} = new Error(
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
        const err: Error & {status?: number} = new Error(
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
        const err: Error & {status?: number} = new Error(
            `Lesson ${filename} not found in ${source}/${setId}`,
        );
        err.status = 404;
        throw err;
    }
    const parsed: unknown = JSON.parse(file.body);
    return parsed as ContentLesson;
}
