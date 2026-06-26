/**
 * Tests for the deployment-strand resolver (#1172).
 *
 * Pins the precedence: explicit deploy variable > branch fallback > URL
 * heuristic > "unknown", and that ``getBuildInfo`` never crashes when the
 * Vite literals are absent (vitest replaces them with the package version
 * but the strand/branch literals are "unknown" in the test env).
 */

import { describe, expect, it } from "vitest";

import { getBuildInfo, resolveStrang } from "./build-info";

describe("resolveStrang (#1172)", () => {
  it("uses the explicit deploy variable (haupt), not a fallback", () => {
    const r = resolveStrang({ buildStrang: "haupt", branch: "feature/x" });
    expect(r.strang).toBe("haupt");
    expect(r.derivedFromFallback).toBe(false);
  });

  it("uses the explicit deploy variable (latest), not a fallback", () => {
    const r = resolveStrang({ buildStrang: "latest", branch: "main" });
    expect(r.strang).toBe("latest");
    expect(r.derivedFromFallback).toBe(false);
  });

  it("falls back to the branch: main -> haupt (no warning)", () => {
    const r = resolveStrang({ buildStrang: "unknown", branch: "main" });
    expect(r.strang).toBe("haupt");
    expect(r.derivedFromFallback).toBe(true);
  });

  it("falls back to the branch: any other branch -> latest (warning)", () => {
    const r = resolveStrang({
      buildStrang: "unknown",
      branch: "fix/something",
    });
    expect(r.strang).toBe("latest");
    expect(r.derivedFromFallback).toBe(true);
  });

  it("falls back to the URL when no branch is known (content-test -> latest)", () => {
    const r = resolveStrang({
      buildStrang: "unknown",
      branch: "unknown",
      href: "https://astrapi69.github.io/adaptive-learner-content-test/",
    });
    expect(r.strang).toBe("latest");
    expect(r.derivedFromFallback).toBe(true);
  });

  it("falls back to the URL when no branch is known (production -> haupt)", () => {
    const r = resolveStrang({
      buildStrang: "unknown",
      branch: "unknown",
      href: "https://astrapi69.github.io/adaptive-learner/",
    });
    expect(r.strang).toBe("haupt");
    expect(r.derivedFromFallback).toBe(true);
  });

  it("returns unknown when nothing resolves (no crash, no guess)", () => {
    const r = resolveStrang({
      buildStrang: "unknown",
      branch: "unknown",
      href: "http://localhost:5173/",
    });
    expect(r.strang).toBe("unknown");
    expect(r.derivedFromFallback).toBe(true);
  });

  it("treats empty/whitespace strand + branch as unknown", () => {
    const r = resolveStrang({ buildStrang: "  ", branch: "" });
    expect(r.strang).toBe("unknown");
  });
});

describe("getBuildInfo (#1172)", () => {
  it("assembles a BuildInfo without crashing in the test env", () => {
    const info = getBuildInfo("http://localhost:5173/");
    expect(info.version).toBe(__APP_VERSION__);
    // Strand/branch literals are "unknown" under vitest, so with a
    // localhost URL the strand stays unknown — proving it does not guess.
    expect(info.branch).toBe("unknown");
    expect(info.strang).toBe("unknown");
    expect(typeof info.hash).toBe("string");
  });

  it("honours an explicit production href via the URL fallback", () => {
    const info = getBuildInfo("https://astrapi69.github.io/adaptive-learner/");
    expect(info.strang).toBe("haupt");
    expect(info.derivedFromFallback).toBe(true);
  });
});
