/**
 * Content-set restore for the Dexie backup (#1806 — extracted from
 * backup.ts).
 *
 * Restores the install-global content cache carried in a backup
 * (#130): a set already present locally is skipped; a missing set is
 * written to ``contentSets`` + ``contentSetFiles``. For API-origin
 * backups without Dexie ``meta`` the row is recovered from the
 * carried ``manifest.yaml`` (#134) so titles + language pairs survive
 * instead of collapsing to the raw ``set_id``.
 */

import {parse as parseYaml} from "yaml";

import {nowIso, type AdaptiveLearnerDB} from "../dexie/db";
import type {ContentSetRow, ContentSetFileRow} from "../dexie/db";
import type {ContentSetBackupEntry} from "../../types/domain";

/** Slugify a ``owner/name`` source the same way the content cache key
 *  does (matches the backend ``slugify_source`` + Dexie ``cacheKey``). */
function slugifyContentSource(source: string): string {
    return source.replace(/\//g, "--");
}

/**
 * Restore downloaded content sets into IndexedDB (#130). A set already
 * present locally is skipped; a missing set is written to ``contentSets``
 * + ``contentSetFiles``. When the entry carries Dexie ``meta`` (a
 * Dexie-origin backup) the row is restored verbatim; otherwise (an
 * API-origin backup) a minimal row is synthesised from the manifest so
 * the lesson viewer — which reads ``contentSetFiles`` — can open lessons.
 */
export async function restoreDexieContentSets(
    db: AdaptiveLearnerDB,
    entries: ContentSetBackupEntry[] | undefined,
): Promise<{restored: number; skipped: number; errors: string[]}> {
    const result = {restored: 0, skipped: 0, errors: [] as string[]};
    if (!Array.isArray(entries)) {
        return result;
    }
    for (const entry of entries) {
        const label = `${entry.source}/${entry.set_id}@v${entry.version}`;
        try {
            const setPk =
                typeof entry.meta?.id === "string" && entry.meta.id !== ""
                    ? (entry.meta.id as string)
                    : `${slugifyContentSource(entry.source)}/${entry.set_id}/${entry.version}`;
            if ((await db.contentSets.get(setPk)) != null) {
                result.skipped += 1;
                continue;
            }
            const row = buildContentSetRow(setPk, entry);
            const files: ContentSetFileRow[] = entry.files.map((file) => ({
                id: `${setPk}#${file.filename}`,
                set_pk: setPk,
                filename: file.filename,
                body: file.body,
                encoding: file.encoding,
            }));
            await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
                await db.contentSets.put(row);
                await db.contentSetFiles.bulkPut(files);
            });
            result.restored += 1;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`${label}: ${message}`);
        }
    }
    return result;
}

/** Minimal shape of a content-set entry inside a ``manifest.yaml``
 *  (a subset of the content-loader's ``ParsedSet``) — the fields a
 *  restore needs to rebuild a ``ContentSetRow``. */
interface ManifestSetMeta {
    id?: string;
    title?: string;
    title_native?: string | null;
    language?: string;
    target_language?: string;
    source_language?: string;
    level?: string;
    domain?: string;
    description?: string | null;
    lesson_count?: number;
    tags?: string[];
    cover_image?: string | null;
}

/** Extract a set's metadata from a ``manifest.yaml`` body (#134).
 *
 *  Handles BOTH the real downloaded shape and the restore-synthesised
 *  shape, where the title lives under ``sets[].title`` (matched by
 *  ``set_id``, else the first set), with a root ``name`` / ``title``
 *  as a last resort. The previous ``/^title:/m`` regex only matched a
 *  root-level ``title:`` — which the synthesised manifest never has
 *  (it carries ``name:`` at the root and ``title:`` nested under
 *  ``sets``), so the title silently fell back to the raw ``set_id``.
 *
 *  Returns ``null`` when the body is absent / unparseable so the
 *  caller falls back to the carried ``meta`` or the ``set_id``. */
function parseManifestSetMeta(
    body: string | undefined,
    setId: string,
): ManifestSetMeta | null {
    if (!body) return null;
    try {
        const doc = parseYaml(body) as {
            name?: string;
            title?: string;
            sets?: ManifestSetMeta[];
        } | null;
        if (!doc) return null;
        if (Array.isArray(doc.sets) && doc.sets.length > 0) {
            const match =
                doc.sets.find((set) => set.id === setId) ?? doc.sets[0];
            return {
                ...match,
                // Inherit the root name/title only when the nested set
                // omits its own (defensive — synthesised sets carry it).
                title: match.title ?? doc.title ?? doc.name,
            };
        }
        const flatTitle = doc.title ?? doc.name;
        return flatTitle ? {title: flatTitle} : null;
    } catch {
        return null;
    }
}

/** Language fields for a restored ``ContentSetRow``, resolved from the
 *  carried Dexie ``meta`` first, then the parsed manifest, then a
 *  minimal default. ``language`` and ``target_language`` cross-fill so
 *  a row missing one but carrying the other stays usable. */
function resolveContentSetLanguages(
    meta: Partial<ContentSetRow>,
    fromManifest: ManifestSetMeta,
): Pick<ContentSetRow, "language" | "target_language" | "source_language"> {
    return {
        language:
            meta.language ??
            meta.target_language ??
            fromManifest.target_language ??
            fromManifest.language ??
            "",
        target_language:
            meta.target_language ??
            meta.language ??
            fromManifest.target_language ??
            fromManifest.language ??
            "",
        source_language:
            meta.source_language ?? fromManifest.source_language ?? "en",
    };
}

/** Descriptive text fields for a restored ``ContentSetRow``, resolved
 *  from the carried ``meta`` first, then the parsed manifest, then a
 *  minimal default. */
function resolveContentSetText(
    entry: ContentSetBackupEntry,
    meta: Partial<ContentSetRow>,
    fromManifest: ManifestSetMeta,
): Pick<
    ContentSetRow,
    "branch" | "title" | "title_native" | "level" | "domain" | "description" | "cover_image"
> {
    return {
        branch: entry.branch ?? meta.branch ?? "main",
        title: meta.title ?? fromManifest.title ?? entry.set_id,
        title_native: meta.title_native ?? fromManifest.title_native ?? null,
        level: meta.level ?? fromManifest.level ?? "",
        domain: meta.domain ?? fromManifest.domain ?? "language",
        description: meta.description ?? fromManifest.description ?? null,
        cover_image: meta.cover_image ?? fromManifest.cover_image ?? null,
    };
}

/** Build a ``ContentSetRow`` for restore: prefer the carried Dexie
 *  ``meta``, else recover the metadata from the manifest, else fall
 *  back to minimal defaults (lessons still open since the viewer reads
 *  the files, not the row). */
function buildContentSetRow(setPk: string, entry: ContentSetBackupEntry): ContentSetRow {
    const manifest = entry.files.find((file) => file.filename === "manifest.yaml");
    const fromManifest: ManifestSetMeta =
        parseManifestSetMeta(manifest?.body, entry.set_id) ?? {};
    const meta = (entry.meta ?? {}) as Partial<ContentSetRow>;
    const lessonCount = entry.files.filter((file) =>
        file.filename.startsWith("lessons/"),
    ).length;
    const manifestTags = Array.isArray(fromManifest.tags)
        ? JSON.stringify(fromManifest.tags)
        : undefined;
    return {
        id: setPk,
        source: entry.source,
        set_id: entry.set_id,
        version: entry.version,
        ...resolveContentSetText(entry, meta, fromManifest),
        ...resolveContentSetLanguages(meta, fromManifest),
        lesson_count: meta.lesson_count ?? fromManifest.lesson_count ?? lessonCount,
        tags: meta.tags ?? manifestTags ?? "[]",
        downloaded_at: meta.downloaded_at ?? nowIso(),
        manifest_yaml: meta.manifest_yaml ?? manifest?.body ?? "",
    };
}
