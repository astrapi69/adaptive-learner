/**
 * Minimal `.alb` (Adaptive Learner Backup) reader for E2E assertions.
 *
 * An `.alb` is a standard ZIP (deflate, written by fflate's `zipSync` in
 * `frontend/src/lib/backup/albContainer.ts`) holding `manifest.json`,
 * `data.json` and optional `assets/…`. The specs only need the two JSON
 * entries, so this walks the ZIP local-file headers with Node's built-in
 * `zlib` instead of pulling a ZIP dependency into e2e (Language/Runtime
 * first, reusability.md). `zipSync` writes sizes into the local headers
 * (no data descriptors) and never uses ZIP64 at backup sizes, so the
 * fixed 30-byte header walk below is exact for the files we produce.
 *
 * @example
 *   const {manifest, data} = readAlb(await download.path());
 *   expect(manifest.format).toBe("adaptive-learner-backup");
 */

import {readFileSync} from "node:fs";
import {inflateRawSync} from "node:zlib";

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;

/** Every entry of the archive, name -> raw bytes. */
export function readZipEntries(zipPath: string): Map<string, Buffer> {
    const buf = readFileSync(zipPath);
    const entries = new Map<string, Buffer>();
    let offset = 0;
    while (offset + 4 <= buf.length) {
        const sig = buf.readUInt32LE(offset);
        if (sig === CENTRAL_DIR_SIG) break; // local entries end here
        if (sig !== LOCAL_HEADER_SIG) {
            throw new Error(
                `not a ZIP local header at offset ${offset} in ${zipPath} ` +
                    `(signature 0x${sig.toString(16)})`,
            );
        }
        const method = buf.readUInt16LE(offset + 8);
        const compressedSize = buf.readUInt32LE(offset + 18);
        const nameLength = buf.readUInt16LE(offset + 26);
        const extraLength = buf.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        const name = buf.subarray(nameStart, nameStart + nameLength).toString("utf-8");
        const dataStart = nameStart + nameLength + extraLength;
        const raw = buf.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) {
            entries.set(name, Buffer.from(raw));
        } else if (method === 8) {
            entries.set(name, inflateRawSync(raw));
        } else {
            throw new Error(`unsupported ZIP method ${method} for ${name} in ${zipPath}`);
        }
        offset = dataStart + compressedSize;
    }
    if (entries.size === 0) {
        throw new Error(`no ZIP entries found in ${zipPath} - not an .alb container?`);
    }
    return entries;
}

/** Parse the two JSON entries every `.alb` carries. */
export function readAlb(zipPath: string): {
    manifest: Record<string, unknown>;
    data: Record<string, unknown>;
} {
    const entries = readZipEntries(zipPath);
    const manifestBytes = entries.get("manifest.json");
    const dataBytes = entries.get("data.json");
    if (!manifestBytes || !dataBytes) {
        throw new Error(
            `.alb misses manifest.json/data.json - entries: ${[...entries.keys()].join(", ")}`,
        );
    }
    return {
        manifest: JSON.parse(manifestBytes.toString("utf-8")),
        data: JSON.parse(dataBytes.toString("utf-8")),
    };
}
