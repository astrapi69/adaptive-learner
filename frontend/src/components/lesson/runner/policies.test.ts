/**
 * Runner policy constants (EXP-052 slice 0, refs #3169).
 *
 * Table-tests the six ``RunnerPolicy`` constants against the behaviour
 * matrix the owner ratified on 2026-09-23: every column present, the
 * three non-optional literals pinned to ``true``, Endless without a
 * previous step (structural, not a preference), and the exit / pause /
 * options / theory / persist / mode columns row by row.
 */

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
  "optionsBar",
  "theoryLink",
  "enterShortcut",
  "reanchor",
  "clearHints",
  "persistProgress",
  "mode",
].sort();

const ROWS: [string, RunnerPolicy][] = Object.entries(RUNNER_POLICIES);

/** The matrix columns that vary per runner, in the ratified row order. */
function varyingColumns(policy: RunnerPolicy) {
  return {
    exit: policy.exit,
    prevStep: policy.prevStep,
    pause: policy.pause,
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

  it.each(ROWS)("%s carries exactly the twelve ratified columns", (_prefix, policy) => {
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
      optionsBar: true,
      theoryLink: true,
      persistProgress: true,
      mode: "inherit",
    });
    const session = {
      exit: { backTo: "/dashboard" },
      prevStep: true,
      pause: false,
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
