import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
 *
 * Scope is ``frontend/src`` and nothing above it. Until #2972 the walk was
 * rooted one directory too high (``frontend/``), so it also read every
 * ``.ts``/``.tsx`` under ``node_modules``, ``dist`` and ``e2e`` - seven
 * times the files, which is what pushed the scan past the 5000 ms default
 * budget under full-suite load. The first test pins the root and reports
 * the scanned set size so a wrong root can never again read as clean.
 */

const abs = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const SRC_ROOT = abs("../../../"); // frontend/src (this file is src/lib/content/engine/)
const FORBIDDEN_TYPES_FILE = abs("../../../storage/types/content/lesson-schema.generated.ts");
const CONTENT_HUB = abs("../../../storage/types/content/content.ts");

/** All *.ts / *.tsx files under frontend/src. */
function sourceFiles(): string[] {
  return readdirSync(SRC_ROOT, { recursive: true, encoding: "utf-8" })
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => join(SRC_ROOT, entry));
}

describe("lesson type source - single engine origin (D1b)", () => {
  it("scans frontend/src only - never node_modules or the frontend root (#2972)", () => {
    // Fail closed (gate contract #2083, point 4): a walk rooted one level
    // too high covered node_modules/dist/e2e as well (7x the files, the
    // load-dependent timeouts of #2972) and still printed "0 offenders";
    // a walk rooted too low or on a missing dir would print the same.
    const files = sourceFiles();
    expect(SRC_ROOT.replace(/\/$/, "")).toMatch(/[\\/]frontend[\\/]src$/);
    expect(files.filter((file) => /[\\/]node_modules[\\/]/.test(file))).toEqual([]);
    expect(files.length).toBeGreaterThan(500);
    console.log(`[lesson-types-source] scanned ${files.length} .ts/.tsx files under ${SRC_ROOT}`);
  });

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
