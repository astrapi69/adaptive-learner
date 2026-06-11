#!/usr/bin/env node
/**
 * Circular-dependency guard (#251, infra block 4).
 *
 * Runs madge over ``src/`` and fails the build only when the number of
 * import cycles EXCEEDS the documented baseline — so a NEW cycle is a hard
 * error while the pre-existing debt doesn't block CI. The baseline only
 * ever goes DOWN: when a cycle is fixed, lower it (see #252).
 *
 * madge is run via ``npx madge@<pinned>`` rather than a devDependency: it
 * declares ``peerOptional typescript@^5`` which conflicts with the repo's
 * TS 6, and it's a CI-only tool never imported by the app.
 *
 * Current baseline (3), all routed through ``storage/types.ts``:
 *   1) api/client.ts > lib/content/ai-content-validator.ts >
 *      lib/content/content-validator.ts > storage/types.ts
 *   2) lib/content/ai-content-validator.ts >
 *      lib/content/content-validator.ts > storage/types.ts
 *   3) storage/types.ts > storage/export-builder.ts > storage/db.ts
 */

import {execFileSync} from "node:child_process";

const MADGE_VERSION = "8.0.0";
const BASELINE = 3;

function runMadge() {
    try {
        // madge exits 1 when cycles are found, so capture either way.
        return execFileSync(
            "npx",
            [
                `madge@${MADGE_VERSION}`,
                "--circular",
                "--no-color",
                "--extensions",
                "ts,tsx",
                "src/",
            ],
            {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]},
        );
    } catch (err) {
        // Non-zero exit (cycles found) still carries the report on stdout.
        const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
        if (out.trim()) return out;
        throw err;
    }
}

const output = runMadge();
process.stdout.write(output);

const match = output.match(/Found (\d+) circular dependenc/);
const count = match ? Number(match[1]) : 0;

console.log(`\nCircular dependencies: ${count} (baseline ${BASELINE})`);

if (count > BASELINE) {
    console.error(
        `\nERROR: ${count} circular dependencies exceed the baseline of ${BASELINE}.\n` +
            "A new import cycle was introduced. Break it (prefer `import type` for\n" +
            "type-only edges), or — if intentional — only then adjust the baseline.",
    );
    process.exit(1);
}

if (count < BASELINE) {
    console.log(
        `\nGood: cycle count dropped below the baseline. Lower BASELINE to ${count} ` +
            "in this script (it only ratchets down).",
    );
}
