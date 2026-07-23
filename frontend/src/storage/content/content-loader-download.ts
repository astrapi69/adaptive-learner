/**
 * Content-Loader download orchestration (#1780 — extracted from
 * content-loader-dexie.ts).
 *
 * Owns ``downloadSetDexie``: repo manifest → set manifest → lesson +
 * asset fetch (with per-lesson progress, DIS-06) → one atomic Dexie
 * transaction that persists the set row + files and prunes stale
 * versions.
 */

import {
  asContentSetBook,
  asContentSetEntry,
  parseManifest,
  resolveLanguagePair,
  setBasePath,
} from "../../lib/content/engine";
import type { ParsedManifest } from "../../lib/content/engine";

import type { ContentSetEntry, ContentSetSource } from "../types";
import { getDb } from "../dexie/db";
import type { ContentSetRow, ContentSetFileRow } from "../dexie/db";
import {
  DEFAULT_SOURCES,
  arrayBufferToBase64,
  cacheKey,
  fetchBytesOptional,
  fetchText,
  fileKey,
  tokenForSource,
} from "./content-loader-sources";
import { latestCachedRow } from "./content-loader-listing";

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
  const repoManifest = parseManifest(repoText) as ParsedManifest;
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
    return asContentSetEntry(
      src,
      target,
      cached.version,
      cached.downloaded_at ?? null,
      cached.status ?? "active",
    );
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
  const setManifest = parseManifest(setManifestText) as ParsedManifest;
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
  const downloadedAt = new Date().toISOString();
  await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
    // #1300 — preserve the user's lifecycle status across a re-download /
    // version update; a fresh set defaults to "active".
    const prior = await db.contentSets
      .where("set_id")
      .equals(setId)
      .filter((r) => r.source === source)
      .first();
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
      downloaded_at: downloadedAt,
      status: prior?.status ?? "active",
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
    // (getAssetDexie) to decode + wrap in a Blob.
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

  return asContentSetEntry(src, target, target.version, downloadedAt);
}
