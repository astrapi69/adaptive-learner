/**
 * Source-text purity gate (#2464, pattern from learn-content-engine#135).
 *
 * A RAW control byte in a source file makes the file "binary" for every
 * text-oriented tool: grep goes SILENT on it (instead of matching), edit
 * tools stop matching, file(1) says "data". That silence is
 * indistinguishable from an empty result, so every search-based inventory
 * runs fail-open on such a file - the engine track lost a finding to
 * exactly this. Separators like NUL are often the RIGHT value at runtime;
 * only the spelling is wrong: write the escape (\u0000 / \u001f), never
 * the raw byte.
 *
 * Gate contract (quality-checks.md): detects the violation (seeded
 * negative control), reports the size of the scanned set and asserts it
 * is non-trivial (an empty set must not read as a clean one).
 */

import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {join, resolve} from "node:path";

import {describe, expect, it} from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");

/** Tab, LF, CR are the only control bytes legitimate in source text. */
const ALLOWED_CONTROL = new Set([0x09, 0x0a, 0x0d]);

/** Byte offsets of raw control bytes (< 0x20, not tab/LF/CR) in a buffer. */
export function findRawControlBytes(data: Buffer): number[] {
    const offsets: number[] = [];
    for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        if (byte < 0x20 && !ALLOWED_CONTROL.has(byte)) offsets.push(i);
    }
    return offsets;
}

/** Git-tracked TS sources (frontend/src + shared) - the index, not the
 *  filesystem, so gitignored artifacts cannot move the result. */
function trackedSources(): string[] {
    const out = execFileSync("git", ["-C", REPO_ROOT, "ls-files", "-z"], {
        encoding: "utf-8",
    });
    return out
        .split("\u0000")
        .filter(
            (rel) =>
                (rel.startsWith("frontend/src/") &&
                    (rel.endsWith(".ts") || rel.endsWith(".tsx"))) ||
                (rel.startsWith("shared/") && rel.endsWith(".ts")),
        );
}

describe("source-text purity (#2464)", () => {
    const files = trackedSources();

    it("scans a non-trivial set (an empty set must not read as clean)", () => {
        expect(files.length).toBeGreaterThan(1000);
    });

    it("no tracked source carries a raw control byte", () => {
        const offenders = files
            .map((rel) => {
                const hits = findRawControlBytes(readFileSync(join(REPO_ROOT, rel)));
                return hits.length > 0 ? `${rel}: ${hits.length} raw byte(s)` : null;
            })
            .filter((entry): entry is string => entry !== null);
        expect(offenders, `scanned ${files.length} files`).toEqual([]);
    });

    it("detects a seeded raw NUL and a raw 0x1f (negative control)", () => {
        expect(findRawControlBytes(Buffer.from("a\u0000b", "utf-8"))).toHaveLength(1);
        expect(findRawControlBytes(Buffer.from("a\u001fb", "utf-8"))).toHaveLength(1);
        expect(findRawControlBytes(Buffer.from("a\tb\nc\r\n", "utf-8"))).toHaveLength(0);
    });
});
