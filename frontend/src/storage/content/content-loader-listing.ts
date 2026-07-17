/**
 * Content-Loader listing + reconciliation (#1780 — extracted from
 * content-loader-dexie.ts).
 *
 * Owns the Set-Browser read path: cached-row projection, the
 * per-source latest-version lookup, cross-source dedupe, and
 * ``listSetsDexie`` (manifest sweep + cached fallback + the #1731
 * cached-only sweep).
 */

import { asContentSetEntry, parseManifest } from "../../lib/content/engine";
import type { ParsedManifest } from "../../lib/content/engine";

import type {
  ContentSetEntry,
  ContentSetSource,
  ContentSetsList,
} from "../types";
import { isDevMode } from "../../hooks/settings/useDevMode";
import { getDb } from "../dexie/db";
import type { ContentSetRow } from "../dexie/db";
import {
  DEFAULT_SOURCES,
  OFFICIAL_SOURCE,
  fetchText,
  isBundledSource,
  tokenForSource,
} from "./content-loader-sources";

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

export async function rowToCachedEntry(
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
    downloaded_at: row.downloaded_at ?? null,
    status: row.status ?? "active",
    book: row.book ?? null,
  };
}

export async function latestCachedRow(
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
      manifest = parseManifest(text);
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
        asContentSetEntry(
          src,
          parsed,
          cached ? cached.version : null,
          cached ? (cached.downloaded_at ?? null) : null,
          cached?.status ?? "active",
        ),
      );
    }
  }
  // Collapse same-id sets advertised by more than one source
  // (bundled pilot + external repo) to a single row before the
  // cached-only sets are appended.
  const deduped = dedupeContentEntries(entries);
  // #1731 — a downloaded set lives in the cache and must ALWAYS appear in
  // "Meine Inhalte", even when its source is not a configured one (e.g. a
  // download via Entdecken from a registry repo the user never connected).
  // Mirror of the backend's ``_all_cached_entries`` sweep, which fixed
  // exactly this in API mode; it also covers the Phase 59B user-generated
  // sets ("My Lessons"), whose rows are cached the same way. Latest version
  // wins per (source, set_id); ids already listed by a configured source
  // are skipped, matching ``dedupeContentEntries``'s id-level collapse.
  const db = getDb();
  const seenIds = new Set(deduped.map((entry) => entry.id));
  const latestBySet = new Map<string, ContentSetRow>();
  for (const row of await db.contentSets.toArray()) {
    if (seenIds.has(row.set_id)) continue;
    const key = `${row.source}#${row.set_id}`;
    const prev = latestBySet.get(key);
    if (!prev || prev.version < row.version) latestBySet.set(key, row);
  }
  for (const row of latestBySet.values()) {
    deduped.push(await rowToCachedEntry(row));
  }
  return { sets: deduped, sources };
}
