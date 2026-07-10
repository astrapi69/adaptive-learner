/**
 * App-vs-engine schema parity gate (engine = reference; #1394, flipped
 * by #1517).
 *
 * Source-of-truth chain: learn-content-engine is the CANONICAL home of
 * the lesson schema (immutable per published npm release); this app
 * generates conforming ``schema/*.json`` from its Pydantic models
 * (``make sync-schema`` — Pydantic is the app's editorial + runtime
 * tool, not the authority); the content repos mirror the ENGINE (pinned
 * to its release) — not this repo. This test proves the app conforms:
 * the app-generated schemas must be byte-identical to the schemas
 * bundled by the PINNED engine release (the exact-version dependency in
 * package.json).
 *
 * RED here means the Pydantic models moved without the engine-first
 * procedure (engine PR + release first, then pin bump +
 * ``make sync-schema`` here), or the pin bump after an engine release is
 * still missing.
 *
 * Since #1401 the engine is a RUNTIME dependency (the app consumes its
 * parse/projection logic); the pin-equality with the repo-level
 * ``schema/engine-version.txt`` is covered by ``engine-pin.test.ts``.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
// frontend/src/lib/content/validation → repo root is five levels up.
const REPO_SCHEMA_DIR = join(HERE, "..", "..", "..", "..", "..", "schema");
const require = createRequire(import.meta.url);

const MIRRORED = [
  "lesson.schema.json",
  "content-manifest.schema.json",
] as const;

describe("app-generated schemas match the pinned learn-content-engine release", () => {
  it("pins learn-content-engine to an exact version (no range)", () => {
    const pkg = JSON.parse(
      readFileSync(join(HERE, "..", "..", "..", "..", "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string> };
    const pin = pkg.dependencies?.["learn-content-engine"];
    expect(pin, "learn-content-engine must be a runtime dependency").toBeTruthy();
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
  });

  for (const name of MIRRORED) {
    it(`schema/${name} is byte-identical to the engine-bundled copy`, () => {
      const appBytes = readFileSync(join(REPO_SCHEMA_DIR, name), "utf-8");
      const engineBytes = readFileSync(
        require.resolve(`learn-content-engine/schema/${name}`),
        "utf-8",
      );
      expect(appBytes).toBe(engineBytes);
    });
  }
});
