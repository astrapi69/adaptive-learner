import {describe, expect, it} from "vitest";

import {supportedFormat} from "../../storage/backup/backup-version";
import {backupFileErrorText, newerBackupNotice} from "./backupVersionNotice";

/** The English fallback stands in for the catalog. */
const t = (_key: string, fallback: string): string => fallback;

describe("backupFileErrorText (#3827)", () => {
    it("names both versions for a newer major format", () => {
        const text = backupFileErrorText({ok: false, error: "newer_major", version: "2.0.0"}, t);
        expect(text).toContain("2.0.0");
        expect(text).toContain(supportedFormat());
        expect(text).not.toContain("{{");
    });

    it("says the version cannot be read", () => {
        expect(backupFileErrorText({ok: false, error: "unknown_version"}, t)).toBe(
            "The format version of this backup cannot be read, so it was not imported.",
        );
    });

    it.each([
        ["too_large", "This backup file is too large (over 100 MB)."],
        [
            "not_a_backup",
            "This file is not a valid backup file. Please choose a file exported with 'Create backup'.",
        ],
    ] as const)("keeps the %s text", (error, text) => {
        expect(backupFileErrorText({ok: false, error}, t)).toBe(text);
    });
});

describe("newerBackupNotice (#3827)", () => {
    it.each([
        ["no newer version", {newer_version: null, skipped_segments: []}],
        ["an older backend without the fields", {}],
    ])("is null for %s", (_label, summary) => {
        expect(newerBackupNotice(summary, t, "en")).toBeNull();
    });

    it("says everything was restored when nothing was skipped", () => {
        expect(newerBackupNotice({newer_version: "1.10.0", skipped_segments: []}, t, "en")).toBe(
            "This backup was made by a newer version of the app (backup format 1.10.0). Everything in it was restored.",
        );
    });

    it("lists the skipped segments in the reader's language", () => {
        const text = newerBackupNotice(
            {newer_version: "1.10.0", skipped_segments: ["future_block", "future_table"]},
            t,
            "en",
        );
        expect(text).toBe(
            "This backup was made by a newer version of the app (backup format 1.10.0). Everything this version knows was restored; skipped: future_block and future_table.",
        );
    });
});
