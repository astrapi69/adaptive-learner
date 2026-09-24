/**
 * Runner policy constants (EXP-052 slice 0, refs #3169).
 *
 * Table-tests the six ``RunnerPolicy`` constants against the behaviour
 * matrix the owner ratified on 2026-09-23: every column present, the
 * three non-optional literals pinned to ``true``, Endless without a
 * previous step (structural, not a preference), and the exit / pause /
 * options / theory / persist / mode columns row by row.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_POLICY,
  ENDLESS_POLICY,
  ERROR_REPLAY_POLICY,
  LESSON_POLICY,
  REVIEW_POLICY,
  RUNNER_POLICIES,
  SHUFFLE_POLICY,
} from "./policies";
import type { RunnerPolicy } from "./types";

const RATIFIED_COLUMNS = [
  "testIdPrefix",
  "i18nNamespace",
  "exit",
  "prevStep",
  "pause",
  "endRun",
  "optionsBar",
  "theoryLink",
  "enterShortcut",
  "reanchor",
  "clearHints",
  "persistProgress",
  "mode",
  "emptyBodyKey",
  "loadFailedKey",
  "notCachedBodyKey",
  "missingParamsKey",
].sort();

const ROWS: [string, RunnerPolicy][] = Object.entries(RUNNER_POLICIES);

/** The matrix columns that vary per runner, in the ratified row order. */
function varyingColumns(policy: RunnerPolicy) {
  return {
    exit: policy.exit,
    prevStep: policy.prevStep,
    pause: policy.pause,
    endRun: policy.endRun,
    optionsBar: policy.optionsBar,
    theoryLink: policy.theoryLink,
    persistProgress: policy.persistProgress,
    mode: policy.mode,
  };
}

describe("runner policies (ratified matrix 2026-09-23)", () => {
  it("exposes exactly the six runners, keyed by their own testIdPrefix", () => {
    expect(Object.keys(RUNNER_POLICIES).sort()).toEqual(
      ["lesson", "review", "shuffle", "endless", "adaptive-lesson", "error-replay"].sort(),
    );
    for (const [prefix, policy] of ROWS) {
      expect(policy.testIdPrefix).toBe(prefix);
    }
  });

  it.each(ROWS)("%s carries exactly the seventeen ratified columns", (_prefix, policy) => {
    expect(Object.keys(policy).sort()).toEqual(RATIFIED_COLUMNS);
  });

  it.each(ROWS)(
    "%s pins enterShortcut / reanchor / clearHints to the literal true",
    (_prefix, policy) => {
      expect(policy.enterShortcut).toBe(true);
      expect(policy.reanchor).toBe(true);
      expect(policy.clearHints).toBe(true);
    },
  );

  it.each(ROWS)("%s is frozen so a page cannot mutate the shared table", (_prefix, policy) => {
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it("matches the ratified matrix row by row", () => {
    expect(varyingColumns(LESSON_POLICY)).toEqual({
      exit: "set-link",
      prevStep: true,
      pause: true,
      endRun: false,
      optionsBar: true,
      theoryLink: true,
      persistProgress: true,
      mode: "inherit",
    });
    const session = {
      exit: { backTo: "/dashboard" },
      prevStep: true,
      pause: false,
      endRun: false,
      optionsBar: false,
      theoryLink: false,
      persistProgress: false,
      mode: "practice",
    };
    expect(varyingColumns(REVIEW_POLICY)).toEqual(session);
    expect(varyingColumns(SHUFFLE_POLICY)).toEqual(session);
    expect(varyingColumns(ADAPTIVE_POLICY)).toEqual(session);
    expect(varyingColumns(ENDLESS_POLICY)).toEqual({
      ...session,
      prevStep: false,
      pause: true,
      endRun: true,
    });
    expect(varyingColumns(ERROR_REPLAY_POLICY)).toEqual({
      ...session,
      exit: "back-button",
    });
  });

  it("Endless is the only runner without a previous step (structural, not a preference)", () => {
    const withoutPrev = ROWS.filter(([, policy]) => !policy.prevStep).map(([p]) => p);
    expect(withoutPrev).toEqual(["endless"]);
  });

  it("Endless is the only runner with an explicit End (the only run without a last step)", () => {
    const withEnd = ROWS.filter(([, policy]) => policy.endRun).map(([p]) => p);
    expect(withEnd).toEqual(["endless"]);
  });

  it("only the lesson persists progress, inherits the mode and shows options bar + theory link", () => {
    for (const column of ["persistProgress", "optionsBar", "theoryLink"] as const) {
      const enabled = ROWS.filter(([, policy]) => policy[column]).map(([p]) => p);
      expect(enabled, column).toEqual(["lesson"]);
    }
    const inheriting = ROWS.filter(([, policy]) => policy.mode === "inherit").map(([p]) => p);
    expect(inheriting).toEqual(["lesson"]);
  });

  it("keeps the i18n namespaces the pages already use", () => {
    expect(ROWS.map(([, policy]) => policy.i18nNamespace)).toEqual([
      "lesson",
      "review",
      "shuffle",
      "endless",
      "adaptive",
      "lesson.error_replay",
    ]);
  });
});

// #3203 — the two status texts that explain WHY a run shows nothing stay
// per runner and are addressed through the policy, not through runner.*.
// The keys are plain strings the scanner of full-tree-key-coverage never
// sees as t() calls, so this pin resolves them against every catalog.
describe("per-runner status keys (#3203)", () => {
  const LANGS = ["de", "el", "en", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"];
  const I18N_DIR = join(__dirname, "..", "..", "..", "data", "i18n");
  const lookup = (catalog: Record<string, unknown>, dotted: string): unknown =>
    dotted.split(".").reduce<unknown>((node, part) => {
      return node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
    }, catalog);
  const catalogs = LANGS.map(
    (lang) => [lang, JSON.parse(readFileSync(join(I18N_DIR, `${lang}.json`), "utf-8"))] as const,
  );

  it("only the lesson has no empty screen (its source never reports empty)", () => {
    const without = ROWS.filter(([, policy]) => policy.emptyBodyKey === null).map(([p]) => p);
    expect(without).toEqual(["lesson"]);
  });

  it.each(ROWS)("%s status keys resolve in every catalog", (_prefix, policy) => {
    const keys = [
      policy.emptyBodyKey,
      policy.loadFailedKey,
      policy.notCachedBodyKey,
      policy.missingParamsKey,
    ].filter((key): key is string => typeof key === "string");
    expect(keys.length).toBeGreaterThan(0);
    for (const [lang, catalog] of catalogs) {
      for (const key of keys) {
        expect(lookup(catalog, key), `${lang}: ${key}`).toBeTypeOf("string");
        expect(lookup(catalog, key), `${lang}: ${key} empty`).not.toBe("");
      }
    }
  });

  it("the four session runners keep their own empty and load-failed texts", () => {
    expect(REVIEW_POLICY.emptyBodyKey).toBe("review.empty_body");
    expect(SHUFFLE_POLICY.emptyBodyKey).toBe("shuffle.empty_body");
    expect(ENDLESS_POLICY.emptyBodyKey).toBe("endless.empty_body");
    expect(ADAPTIVE_POLICY.emptyBodyKey).toBe("adaptive.empty_body");
    expect(REVIEW_POLICY.loadFailedKey).toBe("review.error.load_failed");
    expect(SHUFFLE_POLICY.loadFailedKey).toBe("shuffle.error.load_failed");
    expect(ENDLESS_POLICY.loadFailedKey).toBe("endless.error.load_failed");
    expect(ADAPTIVE_POLICY.loadFailedKey).toBe("adaptive.error.load_failed");
  });

  it("ErrorReplay reads the existing replay empty text and the lesson's load-failed line", () => {
    expect(ERROR_REPLAY_POLICY.emptyBodyKey).toBe("lesson.error_replay.empty");
    expect(ERROR_REPLAY_POLICY.loadFailedKey).toBe("lesson.error.load_failed");
    expect(LESSON_POLICY.loadFailedKey).toBe("lesson.error.load_failed");
  });
  // A key is shared when the TRIGGERING CONDITION is identical, not when
  // the sentence looks alike: the five session runners fall into
  // not-cached when listSets() has no set with this id, the lesson when
  // getLesson() cannot find this one file inside a set that may well be
  // downloaded; the lesson guards three params, the others one.
  it("shares not-cached and missing-params only where the condition is the same", () => {
    expect(LESSON_POLICY.notCachedBodyKey).toBe("lesson.not_cached_body");
    expect(LESSON_POLICY.missingParamsKey).toBe("lesson.error.missing_params");
    for (const [prefix, policy] of ROWS) {
      if (prefix === "lesson") continue;
      expect(policy.notCachedBodyKey, prefix).toBe("runner.not_cached_body");
      expect(policy.missingParamsKey, prefix).toBe("runner.error.missing_params");
    }
  });
});
