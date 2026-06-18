/**
 * `.alb` backup container (EXP-031 / BAK-02..04).
 *
 * An `.alb` (*Adaptive Learner Backup*) file is a standard ZIP (deflate)
 * holding:
 *
 *   manifest.json   — metadata, readable BEFORE unpacking the data
 *   data.json       — today's BackupPayload, minus inline-base64 avatars
 *   assets/…        — binary assets (the avatar as a real file, BAK-04)
 *
 * The wrapping is purely client-side, so BOTH storage modes use it: the
 * API/Dexie ``storage.backup.export`` still returns a JSON BackupPayload;
 * this module turns it into an `.alb` blob on the way out and back into a
 * BackupPayload on the way in. The restore code is unchanged — it always
 * receives a normal BackupPayload.
 *
 * Compression via {@link https://github.com/101arrowz/fflate fflate}
 * (~30 KB, zero deps, tree-shakeable). JSON is highly repetitive, so an
 * `.alb` is typically 80-90 % smaller than the raw JSON.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import type { BackupPayload } from "../../types/domain";

/** The container marker — same family as the JSON ``format`` marker. */
export const ALB_FORMAT = "adaptive-learner-backup" as const;
export const ALB_CONTAINER = "alb" as const;

export type BackupType = "full" | "selective";

/** The ``manifest.json`` shape — readable without unpacking ``data.json``. */
export interface AlbManifest {
  format: typeof ALB_FORMAT;
  container: typeof ALB_CONTAINER;
  app_version: string;
  /** The DATA schema version (BackupPayload.version), distinct from the
   *  app version, so a restore can warn on a schema gap. */
  schema_version: string;
  created_at: string;
  backup_type: BackupType;
  user_id: string;
  storage_mode: string;
  /** Paths of the binary assets carried in the ZIP (the manifest is the
   *  source of truth, not walking the archive). */
  assets: string[];
  stats: BackupPayload["stats"];
}

/** Prefix used in ``data.json`` to reference an externalised asset. */
const ASSET_REF_PREFIX = "alb-asset:";

/** ZIP local-file-header magic bytes: ``PK\x03\x04``. */
export function isZipBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Parse a ``data:<mime>;base64,<payload>`` URL. Returns null when the value
 *  is not a base64 data URL (a plain URL, empty, or non-string). */
function parseDataUrl(value: unknown): { mime: string; bytes: Uint8Array } | null {
  if (typeof value !== "string") return null;
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value);
  if (!match) return null;
  try {
    return { mime: match[1].toLowerCase(), bytes: base64ToBytes(match[2]) };
  } catch {
    return null;
  }
}

type RowDict = Record<string, unknown>;

/**
 * Externalise base64 avatar data URLs from ``user_settings`` into asset
 * files (BAK-04). Returns a deep-cloned payload with each extracted avatar
 * replaced by an ``alb-asset:`` reference, plus the asset file map.
 */
function externaliseAssets(payload: BackupPayload): {
  out: BackupPayload;
  assets: Record<string, Uint8Array>;
} {
  const out = structuredClone(payload);
  const assets: Record<string, Uint8Array> = {};
  const rows = out.data?.user_settings;
  if (!Array.isArray(rows)) return { out, assets };
  let index = 0;
  for (const row of rows as RowDict[]) {
    const parsed = parseDataUrl(row.avatar);
    if (!parsed) continue;
    const ext = MIME_TO_EXT[parsed.mime] ?? "bin";
    const path = `assets/avatar${index === 0 ? "" : `-${index}`}.${ext}`;
    assets[path] = parsed.bytes;
    row.avatar = `${ASSET_REF_PREFIX}${path}`;
    index += 1;
  }
  return { out, assets };
}

/** Re-inline ``alb-asset:`` avatar references from the ZIP's asset files,
 *  mutating the parsed payload in place. */
function reinlineAssets(
  payload: BackupPayload,
  files: Record<string, Uint8Array>,
): void {
  const rows = payload.data?.user_settings;
  if (!Array.isArray(rows)) return;
  for (const row of rows as RowDict[]) {
    const ref = row.avatar;
    if (typeof ref !== "string" || !ref.startsWith(ASSET_REF_PREFIX)) continue;
    const path = ref.slice(ASSET_REF_PREFIX.length);
    const bytes = files[path];
    if (!bytes) continue;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";
    row.avatar = `data:${mime};base64,${bytesToBase64(bytes)}`;
  }
}

/**
 * Build an `.alb` ZIP from a BackupPayload. Externalises avatars to
 * ``assets/`` and writes a ``manifest.json`` + ``data.json``.
 */
export function buildAlbBytes(
  payload: BackupPayload,
  backupType: BackupType = "full",
): Uint8Array<ArrayBuffer> {
  const { out, assets } = externaliseAssets(payload);
  const manifest: AlbManifest = {
    format: ALB_FORMAT,
    container: ALB_CONTAINER,
    app_version: payload.app_version ?? "",
    schema_version: payload.version,
    created_at: payload.created_at,
    backup_type: backupType,
    user_id: payload.user_id,
    storage_mode: payload.storage_mode,
    assets: Object.keys(assets),
    stats: payload.stats,
  };
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "data.json": strToU8(JSON.stringify(out)),
    ...assets,
  };
  // Copy into a fresh ArrayBuffer-backed view so the result is a
  // ``Uint8Array<ArrayBuffer>`` (assignable to BlobPart / BufferSource;
  // fflate's return is the looser ``ArrayBufferLike`` under TS 6).
  const zipped = zipSync(files, { level: 6 });
  const buffer = new ArrayBuffer(zipped.length);
  const view = new Uint8Array(buffer);
  view.set(zipped);
  return view;
}

export interface ParsedAlb {
  manifest: AlbManifest;
  payload: BackupPayload;
}

/**
 * Parse `.alb` bytes back into a {@link AlbManifest} + a fully-inlined
 * {@link BackupPayload} (avatars re-embedded as data URLs).
 *
 * @param bytes - The raw `.alb` (ZIP) bytes.
 * @param maxUncompressedBytes - Reject when the decompressed total exceeds
 *   this (zip-bomb guard; the size limit is on the UNCOMPRESSED size).
 * @throws Error on a malformed / non-`.alb` archive.
 */
export function parseAlbBytes(
  bytes: Uint8Array,
  maxUncompressedBytes = Infinity,
): ParsedAlb {
  const files = unzipSync(bytes);
  let total = 0;
  for (const name of Object.keys(files)) total += files[name].length;
  if (total > maxUncompressedBytes) {
    throw new Error("Backup archive is too large when uncompressed.");
  }
  const manifestRaw = files["manifest.json"];
  const dataRaw = files["data.json"];
  if (!manifestRaw || !dataRaw) {
    throw new Error("Not a valid .alb backup (missing manifest.json/data.json).");
  }
  const manifest = JSON.parse(strFromU8(manifestRaw)) as AlbManifest;
  const payload = JSON.parse(strFromU8(dataRaw)) as BackupPayload;
  reinlineAssets(payload, files);
  return { manifest, payload };
}
