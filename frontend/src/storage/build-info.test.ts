/**
 * Build provenance regression (#66).
 *
 * GitHub Pages runs the Dexie build with no backend, so the About panel
 * gets its Build hash + Build date from Vite-injected literals rather
 * than a server-side `git rev-parse`. This pins two things:
 *   1. The deploy workflow exports VITE_BUILD_HASH / VITE_BUILD_DATE so
 *      a deployed build is never "unknown".
 *   2. The Dexie system info wires those literals through instead of a
 *      hardcoded "unknown".
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { dexieStorage } from "./db/dexie-storage";

describe("build provenance (#66)", () => {
  it("the GH-Pages deploy workflow injects build metadata", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), "../.github/workflows/deploy-gh-pages.yml"),
      "utf-8",
    );
    expect(workflow).toContain("VITE_BUILD_HASH");
    expect(workflow).toContain("VITE_BUILD_DATE");
    expect(workflow).toContain("git rev-parse --short HEAD");
  });

  it("Dexie system info reads the injected build literals, not a hardcoded 'unknown'", async () => {
    const info = await dexieStorage.system.info();
    expect(info.app.build_hash).toBe(__BUILD_HASH__);
    expect(info.app.build_date).toBe(__BUILD_DATE__);
  });
});
