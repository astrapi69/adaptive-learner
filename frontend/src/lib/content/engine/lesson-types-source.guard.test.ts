import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

/**
 * D1b guard (#1521): the lesson TS types have a single source - the
 * ``learn-content-engine`` package. The app must NOT regenerate its own copy.
 * This watchdog fails if the old generated mirror file reappears or if any
 * source imports lesson types from a local ``lesson-schema.generated`` module
 * instead of the engine.
 *
 * (The ajv runtime SCHEMA mirror ``lesson.schema.generated.json`` is a
 * different, still-required artefact and is deliberately not covered here.)
 */

const abs = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const SRC_ROOT = abs("../../../../"); // frontend/src
const FORBIDDEN_TYPES_FILE = abs("../../../storage/types/content/lesson-schema.generated.ts");
const CONTENT_HUB = abs("../../../storage/types/content/content.ts");

/** All *.ts / *.tsx files under frontend/src. */
function sourceFiles(): string[] {
  return readdirSync(SRC_ROOT, { recursive: true, encoding: "utf-8" })
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => `${SRC_ROOT}/${entry}`);
}

describe("lesson type source - single engine origin (D1b)", () => {
  it("does not regenerate the local lesson-schema.generated.ts types file", () => {
    expect(existsSync(FORBIDDEN_TYPES_FILE)).toBe(false);
  });

  it("no source imports lesson TYPES from a local lesson-schema.generated module", () => {
    const offenders = sourceFiles().filter((file) =>
      /from\s+["'][^"']*lesson-schema\.generated["']/.test(readFileSync(file, "utf-8")),
    );
    // Note: the ajv mirror is imported as `lesson.schema.generated.json` (a
    // .json, matched by the trailing `.json"` the regex above excludes).
    expect(offenders).toEqual([]);
  });

  it("the content hub sources its raw lesson types from learn-content-engine", () => {
    const hub = readFileSync(CONTENT_HUB, "utf-8");
    expect(hub).toMatch(/}\s*from\s+["']learn-content-engine["']/);
  });
});
