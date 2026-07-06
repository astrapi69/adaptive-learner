/**
 * One pin, one truth (#1401): the runtime dependency on
 * ``learn-content-engine`` must be pinned EXACTLY and must equal the
 * repo-level pin ``schema/engine-version.txt`` (the source the
 * app-vs-engine schema-parity gate reads, #1398). Two independent pin
 * locations are exactly the drift class the mirror decoupling (#1397)
 * eliminated — this test keeps it from returning through the back door.
 *
 * The pin must live in ``dependencies`` (the engine is RUNTIME format
 * logic since #1401), not ``devDependencies``.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(HERE, "../../../..");
const REPO_ROOT = resolve(FRONTEND_ROOT, "..");

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(resolve(FRONTEND_ROOT, "package.json"), "utf-8"),
) as PackageJson;

const versionPin = readFileSync(
  resolve(REPO_ROOT, "schema", "engine-version.txt"),
  "utf-8",
).trim();

describe("learn-content-engine pin (#1401)", () => {
  it("is a RUNTIME dependency (the engine carries format logic)", () => {
    expect(pkg.dependencies?.["learn-content-engine"]).toBeDefined();
    expect(pkg.devDependencies?.["learn-content-engine"]).toBeUndefined();
  });

  it("is pinned exactly (no range operator)", () => {
    const pin = pkg.dependencies?.["learn-content-engine"] ?? "";
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("equals schema/engine-version.txt (one pin, one truth)", () => {
    expect(pkg.dependencies?.["learn-content-engine"]).toBe(versionPin);
  });
});
