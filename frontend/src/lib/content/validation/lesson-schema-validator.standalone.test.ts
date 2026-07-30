/**
 * Pins for the build-time-compiled validator (#2205).
 *
 * 1. Pin-coupling: the generated module embeds the sha256 of the schema
 *    it was built from; a schema re-pin without regeneration fails HERE,
 *    never silently (the engine-repin class, applied to the validator).
 * 2. Source gate: runtime `ajv.compile` / `new Ajv` may exist ONLY in the
 *    generator script - the bundle must stay free of code generation, or
 *    the CSP breaks again on whatever route loads it next.
 * Both report the set they examined (gate contract point 4).
 */
import {createHash} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const HERE = __dirname;
const SRC_ROOT = join(HERE, "../../..");

describe("standalone validator pin-coupling", () => {
    it("was generated from the CURRENT schema mirror", () => {
        const schema = readFileSync(join(HERE, "lesson.schema.generated.json"), "utf-8");
        const hash = createHash("sha256").update(schema).digest("hex");
        const generated = readFileSync(
            join(HERE, "lesson-schema-validator.standalone.cjs"),
            "utf-8",
        );
        const match = generated.match(/schema-source-sha256: ([0-9a-f]{64})/);
        expect(match, "generated module carries no schema hash - regenerate").not.toBeNull();
        expect(
            match?.[1],
            "schema mirror changed without regenerating the validator - run `bun run generate:validator` (make sync-schema does)",
        ).toBe(hash);
    });
});

describe("no runtime schema compilation in the bundle sources", () => {
    it("only the generator may call ajv.compile / new Ajv", () => {
        const offenders: string[] = [];
        let scanned = 0;
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.(ts|tsx)$/.test(entry) || /\.test\./.test(entry)) continue;
                scanned += 1;
                const text = readFileSync(full, "utf-8");
                if (/\bnew Ajv|ajv\.compile\(|\.compile\(lessonJsonSchema/.test(text)) {
                    offenders.push(full);
                }
            }
        };
        walk(SRC_ROOT);
        expect(scanned, "scanned nothing - the gate proves nothing").toBeGreaterThan(300);
        console.log(`scanned ${scanned} source files for runtime schema compilation`);
        expect(offenders, "runtime ajv compilation is an unsafe-eval CSP break (#2205)").toEqual([]);
    });
});
