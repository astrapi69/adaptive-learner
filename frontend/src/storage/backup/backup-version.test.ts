/**
 * Backup format version (#3827): the restore compares a backup's format
 * version with the app's, rejects what it cannot read and names the
 * segments it skips in a newer one.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {BACKUP_VERSION} from "./backup-tables";
import {
    BackupVersionError,
    PAYLOAD_SEGMENTS,
    assertReadableVersion,
    newerBackupReport,
    parseFormatVersion,
    supportedFormat,
    versionStanding,
} from "./backup-version";

describe("parseFormatVersion", () => {
    it("reads MAJOR.MINOR.PATCH", () => {
        expect(parseFormatVersion("1.10.2")).toEqual({major: 1, minor: 10, patch: 2});
    });

    it.each([
        ["a word", "abc"],
        ["a wildcard", "1.x"],
        ["a bare major", "1"],
        ["two parts", "1.9"],
        ["whitespace", " "],
        ["padding", " 1.9.0"],
        ["four parts", "1.9.0.1"],
        ["empty", ""],
        ["a number", 13],
        ["a long run of digits", "0".repeat(50_000)],
        ["a part longer than nine digits", "1.0000000000.0"],
        ["null", null],
        ["missing", undefined],
    ])("returns null for %s", (_label, raw) => {
        expect(parseFormatVersion(raw)).toBeNull();
    });
});

describe("versionStanding", () => {
    it.each([
        ["the app's own version", BACKUP_VERSION, "current_or_older"],
        ["an older minor", "1.2.0", "current_or_older"],
        ["an older patch", "1.8.5", "current_or_older"],
        ["a newer patch", "1.9.1", "newer"],
        ["a newer minor, compared numerically", "1.10.0", "newer"],
        ["a newer major", "2.0.0", "newer_major"],
        ["an unreadable version", "1.x", "unknown"],
        ["a missing version", undefined, "unknown"],
    ])("classifies %s", (_label, raw, standing) => {
        expect(versionStanding(raw, "1.9.0")).toBe(standing);
    });
});

describe("assertReadableVersion", () => {
    it("passes the app's own and a newer minor version", () => {
        expect(() => assertReadableVersion(BACKUP_VERSION)).not.toThrow();
        expect(() => assertReadableVersion("1.99.0")).not.toThrow();
    });

    it("rejects a newer major version and names it", () => {
        const error = captureError(() => assertReadableVersion("2.0.0"));
        expect(error).toBeInstanceOf(BackupVersionError);
        expect(error).toMatchObject({kind: "newer_major", version: "2.0.0"});
        expect(error.message).toContain("2.0.0");
        expect(error.message).toContain(supportedFormat());
    });

    it.each(["abc", "1.x", "1", " ", "", undefined])("rejects %j as unknown", (raw) => {
        expect(captureError(() => assertReadableVersion(raw))).toMatchObject({
            kind: "unknown_version",
        });
    });
});

describe("supportedFormat", () => {
    it("names the major the app reads", () => {
        expect(supportedFormat()).toBe(`${BACKUP_VERSION.split(".")[0]}.x`);
    });
});

describe("newerBackupReport", () => {
    const base = {format: "adaptive-learner-backup", user_id: "u-1", data: {}};

    it("names unknown tables and blocks that carry data, sorted", () => {
        const report = newerBackupReport({
            ...base,
            version: "1.10.0",
            data: {future_table: [{id: "f-1"}], users: [{id: "u-1"}], empty_future: []},
            future_block: {anything: true},
            empty_block: {},
        });
        expect(report).toEqual({
            newer_version: "1.10.0",
            skipped_segments: ["future_block", "future_table"],
        });
    });

    it("reports a newer version without unknown segments", () => {
        expect(newerBackupReport({...base, version: "1.10.0"})).toEqual({
            newer_version: "1.10.0",
            skipped_segments: [],
        });
    });

    it.each([BACKUP_VERSION, "1.2.0"])("stays quiet for %s, unknown segments included", (version) => {
        expect(
            newerBackupReport({...base, version, data: {future_table: [{id: "f"}]}}),
        ).toEqual({newer_version: null, skipped_segments: []});
    });
});

describe("payload segments parity (#3827)", () => {
    it("knows the same top-level segments as the backend restore", () => {
        const source = readFileSync(
            join(__dirname, "../../../../backend/app/services/backup_export.py"),
            "utf8",
        );
        const block = /PAYLOAD_SEGMENTS[^=]*=\s*frozenset\(\s*\{([^}]*)\}/.exec(source);
        expect(block, "PAYLOAD_SEGMENTS not found in backup_export.py").not.toBeNull();
        const backend = [...block![1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
        expect(backend.length).toBeGreaterThan(5);
        expect([...PAYLOAD_SEGMENTS].sort()).toEqual(backend);
    });
});

function captureError(action: () => void): BackupVersionError {
    try {
        action();
    } catch (error) {
        return error as BackupVersionError;
    }
    throw new Error("expected a BackupVersionError");
}
