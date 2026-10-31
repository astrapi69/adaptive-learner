/**
 * Backup format version (#3827): compare a backup's format version with the
 * app's, reject what this build cannot read, and name what a newer backup
 * carries that this build does not know.
 *
 * Every 1.x change is additive, so a newer minor or patch is restored with
 * the tables and blocks this build knows; the rest is skipped and named.
 * A newer major is a layout this build cannot read, and a version that is
 * missing or not ``MAJOR.MINOR.PATCH`` is unknown, not old: both are
 * rejected before anything is written.
 *
 * @example
 * assertReadableVersion(payload.version); // throws BackupVersionError
 * const {newer_version, skipped_segments} = newerBackupReport(payload);
 */

import {BACKUP_TABLES, BACKUP_VERSION} from "./backup-tables";

/** A parsed ``MAJOR.MINOR.PATCH`` format version. */
export interface FormatVersion {
    major: number;
    minor: number;
    patch: number;
}

/** Where a backup's version stands against the app's. */
export type VersionStanding = "unknown" | "newer_major" | "newer" | "current_or_older";

/** Why a backup was rejected for its version. */
export type VersionRejection = "unknown_version" | "newer_major";

/** What a restore reports about the backup's version. */
export interface NewerBackupReport {
    /** The backup's version when it is newer than the app's, else null. */
    newer_version: string | null;
    /** Segments with data this build does not know, sorted; only for a newer backup. */
    skipped_segments: string[];
}

/**
 * The top-level keys of a backup this build knows. The backend restore keeps
 * the same set (``PAYLOAD_SEGMENTS`` in ``backup_export.py``, pinned by a
 * parity test); the client-side blocks count as known in both modes.
 */
export const PAYLOAD_SEGMENTS: ReadonlySet<string> = new Set([
    "format",
    "version",
    "app_version",
    "created_at",
    "user_id",
    "storage_mode",
    "data",
    "content_sets",
    "local_storage",
    "plugin_settings",
    "ai_validation_results",
    "stats",
]);

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** A backup this build refuses for its format version. */
export class BackupVersionError extends Error {
    readonly kind: VersionRejection;
    readonly version: string;

    constructor(kind: VersionRejection, version: string) {
        super(
            kind === "newer_major"
                ? `Backup format ${version} is newer than this app reads (${supportedFormat()}).`
                : `Backup format version ${JSON.stringify(version)} cannot be read.`,
        );
        this.name = "BackupVersionError";
        this.kind = kind;
        this.version = version;
    }
}

/**
 * Parse a format version strictly: three dot-separated numbers, nothing else.
 *
 * @param raw - The ``version`` field of a payload, of any type.
 * @returns The parsed version, or null when it cannot be read.
 */
export function parseFormatVersion(raw: unknown): FormatVersion | null {
    if (typeof raw !== "string") {
        return null;
    }
    const match = VERSION_PATTERN.exec(raw);
    if (match === null) {
        return null;
    }
    return {major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3])};
}

/**
 * Compare a backup's version numerically with the app's.
 *
 * @param raw - The backup's ``version`` field.
 * @param app - The app's format version; ``BACKUP_VERSION`` by default.
 */
export function versionStanding(raw: unknown, app: string = BACKUP_VERSION): VersionStanding {
    const backup = parseFormatVersion(raw);
    const own = parseFormatVersion(app);
    if (backup === null || own === null) {
        return "unknown";
    }
    if (backup.major !== own.major) {
        return backup.major > own.major ? "newer_major" : "current_or_older";
    }
    const order = [backup.minor - own.minor, backup.patch - own.patch].find((d) => d !== 0) ?? 0;
    return order > 0 ? "newer" : "current_or_older";
}

/** The formats this build reads, e.g. ``"1.x"``. */
export function supportedFormat(): string {
    return `${BACKUP_VERSION.split(".", 1)[0]}.x`;
}

/**
 * Throw a {@link BackupVersionError} for a version this build cannot read.
 *
 * @param raw - The backup's ``version`` field.
 */
export function assertReadableVersion(raw: unknown): void {
    const standing = versionStanding(raw);
    if (standing === "unknown") {
        throw new BackupVersionError("unknown_version", typeof raw === "string" ? raw : String(raw ?? ""));
    }
    if (standing === "newer_major") {
        throw new BackupVersionError("newer_major", raw as string);
    }
}

/**
 * Report a newer backup and the segments this build skips in it.
 *
 * A segment is skipped when it carries data: a non-empty table in ``data``
 * that is not in ``BACKUP_TABLES``, or a non-empty top-level block that is
 * not in {@link PAYLOAD_SEGMENTS}. A current or older backup reports
 * nothing, so the safe paths stay quiet.
 *
 * @param payload - A payload that passed the shape check.
 */
export function newerBackupReport(payload: Record<string, unknown>): NewerBackupReport {
    if (versionStanding(payload.version) !== "newer") {
        return {newer_version: null, skipped_segments: []};
    }
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const tables = Object.keys(data).filter((t) => !(t in BACKUP_TABLES) && hasData(data[t]));
    const blocks = Object.keys(payload).filter((k) => !PAYLOAD_SEGMENTS.has(k) && hasData(payload[k]));
    return {
        newer_version: payload.version as string,
        skipped_segments: [...new Set([...tables, ...blocks])].sort(),
    };
}

function hasData(value: unknown): boolean {
    if (value === null || value === undefined || value === "") {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === "object") {
        return Object.keys(value).length > 0;
    }
    return true;
}
