/**
 * useRunStepResults (EXP-052 slice 1, refs #3169).
 *
 * The run-local step results of an ephemeral runner: what makes the
 * #1790 answered-step lock work without a persisted progress row. A
 * record keeps the graded result under the step id; a new run key
 * drops everything.
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {useRunStepResults} from "./useRunStepResults";

const SCORED = {
  correct: 1,
  total: 2,
  attempts: [],
  raw_answer: {kind: "cloze" as const, inputs: ["merci"]},
};

describe("useRunStepResults", () => {
  it("boundary: starts a run with no results", () => {
    const {result} = renderHook(() => useRunStepResults("run-1"));
    expect(result.current.progress.step_results).toEqual({});
  });

  it("happy path: a recorded step carries score, raw answer and one attempt", () => {
    const {result} = renderHook(() => useRunStepResults("run-1"));
    act(() => result.current.record("s0", SCORED));
    const stored = result.current.progress.step_results.s0;
    expect(stored.correct).toBe(1);
    expect(stored.total).toBe(2);
    expect(stored.attempts).toBe(1);
    expect(stored.raw_answer).toEqual(SCORED.raw_answer);
    expect(typeof stored.completed_at).toBe("string");
  });

  it("edge: a step without a raw answer stores null (the fallback panel case)", () => {
    const {result} = renderHook(() => useRunStepResults("run-1"));
    act(() => result.current.record("s0", {correct: 0, total: 1, attempts: []}));
    expect(result.current.progress.step_results.s0.raw_answer).toBeNull();
  });

  it("edge: recording the same step again counts the attempt and keeps the latest answer", () => {
    const {result} = renderHook(() => useRunStepResults("run-1"));
    act(() => result.current.record("s0", SCORED));
    act(() =>
      result.current.record("s0", {
        ...SCORED,
        correct: 2,
        raw_answer: {kind: "cloze", inputs: ["bonjour"]},
      }),
    );
    const stored = result.current.progress.step_results.s0;
    expect(stored.attempts).toBe(2);
    expect(stored.correct).toBe(2);
    expect(stored.raw_answer).toEqual({kind: "cloze", inputs: ["bonjour"]});
  });

  it("reproduction: a new run key forgets the previous run's results", () => {
    const {result, rerender} = renderHook(({key}) => useRunStepResults(key), {
      initialProps: {key: "run-1"},
    });
    act(() => result.current.record("s0", SCORED));
    expect(Object.keys(result.current.progress.step_results)).toEqual(["s0"]);
    rerender({key: "run-2"});
    expect(result.current.progress.step_results).toEqual({});
  });

  it("keeps the results across re-renders with the same run key", () => {
    const {result, rerender} = renderHook(({key}) => useRunStepResults(key), {
      initialProps: {key: "run-1"},
    });
    act(() => result.current.record("s0", SCORED));
    rerender({key: "run-1"});
    expect(Object.keys(result.current.progress.step_results)).toEqual(["s0"]);
  });
});
