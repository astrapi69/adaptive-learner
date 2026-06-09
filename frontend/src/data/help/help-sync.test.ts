/**
 * Drift pin (Phase 38): the bundled JSON files under
 * ``frontend/src/data/help/`` are what the HelpTooltip +
 * HelpDrawer actually read at runtime, in BOTH storage modes
 * (no API roundtrip is required, even in API mode).
 *
 * Backend YAML stays the canonical authoring surface;
 * ``scripts/sync_help_to_frontend.py`` regenerates the JSON.
 *
 * This pin asserts the structural invariants on the JSON side
 * without taking a YAML dep on the frontend:
 *   1. ``concepts.de.json`` + ``concepts.en.json`` exist + parse.
 *   2. Every entry has the canonical shape
 *      (key / title / short / long).
 *   3. The concepts bundle for DE and EN has parity on keys.
 *
 * Future commits in 38A extend this pin (methods, steps,
 * features) without changing the existing assertions.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const HELP_DIR = join(__dirname);

interface Entry {
  key: string;
  title: string;
  short: string;
  long: string;
}

interface Bundle {
  category: string;
  language: string;
  entries: Entry[];
}

function loadBundle(category: string, lang: string): Bundle {
  return JSON.parse(
    readFileSync(join(HELP_DIR, `${category}.${lang}.json`), "utf-8"),
  );
}

describe("help bundles — Phase 38F passthrough parity", () => {
  const PASSTHROUGH_LANGS = ["es", "fr", "el", "pt", "tr", "ja"] as const;
  const CATEGORIES = ["concepts", "methods", "steps", "features"] as const;

  for (const lang of PASSTHROUGH_LANGS) {
    for (const category of CATEGORIES) {
      it(`${category}.${lang} bundle exists and stamps the right language`, () => {
        const bundle = loadBundle(category, lang);
        expect(bundle.category).toBe(category);
        expect(bundle.language).toBe(lang);
        expect(bundle.entries.length).toBeGreaterThan(0);
      });
    }
  }

  it("every passthrough language has the same 31 keys as EN", () => {
    const enConcepts = new Set(
      loadBundle("concepts", "en").entries.map((e) => e.key),
    );
    const enMethods = new Set(
      loadBundle("methods", "en").entries.map((e) => e.key),
    );
    const enSteps = new Set(
      loadBundle("steps", "en").entries.map((e) => e.key),
    );
    const enFeatures = new Set(
      loadBundle("features", "en").entries.map((e) => e.key),
    );

    for (const lang of PASSTHROUGH_LANGS) {
      const concepts = new Set(
        loadBundle("concepts", lang).entries.map((e) => e.key),
      );
      const methods = new Set(
        loadBundle("methods", lang).entries.map((e) => e.key),
      );
      const steps = new Set(
        loadBundle("steps", lang).entries.map((e) => e.key),
      );
      const features = new Set(
        loadBundle("features", lang).entries.map((e) => e.key),
      );
      expect([...concepts].sort()).toEqual([...enConcepts].sort());
      expect([...methods].sort()).toEqual([...enMethods].sort());
      expect([...steps].sort()).toEqual([...enSteps].sort());
      expect([...features].sort()).toEqual([...enFeatures].sort());
    }
  });
});

describe("help bundles — Features", () => {
  const expectedFeatures = new Set([
    "feature_method_switch",
    "feature_auto_loop",
    "feature_spaced_repetition",
    "feature_conversation_analysis",
    "feature_gamification",
  ]);

  for (const lang of ["de", "en"] as const) {
    it(`features.${lang} parses + contains all five canonical entries`, () => {
      const bundle = loadBundle("features", lang);
      expect(bundle.category).toBe("features");
      expect(bundle.language).toBe(lang);
      const keys = new Set(bundle.entries.map((e) => e.key));
      for (const expected of expectedFeatures) {
        expect(keys.has(expected)).toBe(true);
      }
    });
  }

  it("DE + EN features bundles have identical key sets", () => {
    const de = loadBundle("features", "de");
    const en = loadBundle("features", "en");
    const deKeys = new Set(de.entries.map((e) => e.key));
    const enKeys = new Set(en.entries.map((e) => e.key));
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
  });
});

describe("help bundles — Steps", () => {
  const expectedSteps = new Set([
    "step_input",
    "step_attempt",
    "step_error",
    "step_feedback",
    "step_adapt",
    "step_repeat",
    "step_integrate",
  ]);

  for (const lang of ["de", "en"] as const) {
    it(`steps.${lang} parses + contains all seven canonical entries`, () => {
      const bundle = loadBundle("steps", lang);
      expect(bundle.category).toBe("steps");
      expect(bundle.language).toBe(lang);
      const keys = new Set(bundle.entries.map((e) => e.key));
      for (const expected of expectedSteps) {
        expect(keys.has(expected)).toBe(true);
      }
    });
  }

  it("DE + EN steps bundles have identical key sets", () => {
    const de = loadBundle("steps", "de");
    const en = loadBundle("steps", "en");
    const deKeys = new Set(de.entries.map((e) => e.key));
    const enKeys = new Set(en.entries.map((e) => e.key));
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
  });
});

describe("help bundles — Methods", () => {
  const expectedMethods = new Set([
    "method_deductive",
    "method_inductive",
    "method_error_based",
    "method_dialogic",
    "method_contextual",
    "method_ai_adaptive",
  ]);

  for (const lang of ["de", "en"] as const) {
    it(`methods.${lang} parses + contains all six canonical entries`, () => {
      const bundle = loadBundle("methods", lang);
      expect(bundle.category).toBe("methods");
      expect(bundle.language).toBe(lang);
      const keys = new Set(bundle.entries.map((e) => e.key));
      for (const expected of expectedMethods) {
        expect(keys.has(expected)).toBe(true);
      }
    });
  }

  it("DE + EN methods bundles have identical key sets", () => {
    const de = loadBundle("methods", "de");
    const en = loadBundle("methods", "en");
    const deKeys = new Set(de.entries.map((e) => e.key));
    const enKeys = new Set(en.entries.map((e) => e.key));
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
  });
});

describe("help bundles — Concepts", () => {
  const expectedConcepts = new Set([
    "curriculum",
    "learning_project",
    "learning_profile",
    "learning_session",
  ]);

  for (const lang of ["de", "en"] as const) {
    it(`concepts.${lang} parses + contains all four canonical entries`, () => {
      const bundle = loadBundle("concepts", lang);
      expect(bundle.category).toBe("concepts");
      expect(bundle.language).toBe(lang);
      const keys = new Set(bundle.entries.map((e) => e.key));
      for (const expected of expectedConcepts) {
        expect(keys.has(expected)).toBe(true);
      }
    });
  }

  it("every concepts entry has the canonical shape", () => {
    const bundle = loadBundle("concepts", "en");
    for (const entry of bundle.entries) {
      expect(typeof entry.key).toBe("string");
      expect(entry.key.length).toBeGreaterThan(0);
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.short).toBe("string");
      expect(entry.short.length).toBeGreaterThan(0);
      expect(typeof entry.long).toBe("string");
      expect(entry.long).toContain("## ");
    }
  });

  it("DE + EN concepts bundles have identical key sets", () => {
    const de = loadBundle("concepts", "de");
    const en = loadBundle("concepts", "en");
    const deKeys = new Set(de.entries.map((e) => e.key));
    const enKeys = new Set(en.entries.map((e) => e.key));
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
  });
});
