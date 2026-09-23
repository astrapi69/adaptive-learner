/**
 * useReviewSource (EXP-052 slice 1, refs #3169).
 *
 * The adapter between ``useReviewLesson`` (called exactly as the page
 * did) and the shell's ``RunnerSource``: status normalisation, the live
 * title (#2703), the element-counting subtitle (#664 / #3170), the
 * lesson id the dispatcher stamps (#673 with the legacy parser), the
 * position, the step-carrying ``recordStepAttempts`` (#3170), the
 * summary tallies, the neutral wording flag (#3170), ``reload`` and the
 * run key that changes with every round.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useReviewLessonMock = vi.fn();

vi.mock("../modes/useReviewLesson", () => ({
  useReviewLesson: (opts: unknown) => useReviewLessonMock(opts),
}));

import {extractReviewLessonId, useReviewSource} from "./useReviewSource";

const STEP = {
  id: "review-01-greetings.json-ex-a-merci",
  type: "exercise" as const,
  title: null,
  review_lesson_id: "01-greetings.json",
  exercise: {
    id: "ex-a",
    type: "cloze" as const,
    prompt: "Fill in",
    card_ids: [],
    sentence: "___",
    blanks: ["merci"],
    distractors: [],
  },
};

const LESSON = {
  id: "review-fr-a1",
  title: "Review session",
  description: null,
  estimated_minutes: 1,
  cards: [{id: "c1", tags: []}],
  steps: [STEP, {...STEP, id: "review-01-greetings.json-ex-b-bonjour", review_element_keys: ["bonjour", "salut"]}],
};

const BASE = {
  status: "ready",
  lesson: LESSON,
  queue: [{element_key: "merci", error_count: 1}],
  currentStepIndex: 0,
  dueCount: 3,
  error: null,
  goNext: vi.fn(),
  goPrev: vi.fn(),
  goToStep: vi.fn(),
  recordStepAttempts: vi.fn().mockResolvedValue(undefined),
  sessionScoreCorrect: 1,
  sessionScoreTotal: 2,
  remaining: 4,
  reload: vi.fn(),
};

beforeEach(() => {
  useReviewLessonMock.mockReset();
  useReviewLessonMock.mockReturnValue(BASE);
});

describe("useReviewSource: the hook call", () => {
  it("calls useReviewLesson with the set, the live title and the limit, as the page did", () => {
    renderHook(() => useReviewSource({setId: "fr-a1", limit: 5}));
    expect(useReviewLessonMock).toHaveBeenCalledWith(
      expect.objectContaining({setId: "fr-a1", title: "Review session", limit: 5}),
    );
  });
});

describe("useReviewSource: status", () => {
  it.each([["loading"], ["empty"], ["not-cached"], ["error"]])("passes %s through", (status) => {
    useReviewLessonMock.mockReturnValue({...BASE, status, lesson: null});
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.status).toBe(status);
    expect(result.current.step).toBeNull();
  });

  it("edge: ready without a lesson is an error (the page's inline guard)", () => {
    useReviewLessonMock.mockReturnValue({...BASE, status: "ready", lesson: null});
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.status).toBe("error");
  });
});

describe("useReviewSource: header texts", () => {
  it("title is the live session title", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.title).toBe("Review session");
  });

  it("#3170: the subtitle counts the elements the steps cover (3 for 2 steps)", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.subtitle).toContain("3");
    expect(result.current.subtitle).not.toContain(" of ");
  });

  it("#664: the capped form names shown and due when the pool is trimmed", () => {
    useReviewLessonMock.mockReturnValue({...BASE, dueCount: 5});
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.subtitle).toContain("3 of 5");
  });
});

describe("useReviewSource: the step and its lesson id", () => {
  it("exposes the current step, the set, the cards and the stamped lesson id", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.step).toBe(STEP);
    expect(result.current.setId).toBe("fr-a1");
    expect(result.current.cards).toBe(LESSON.cards);
    expect(result.current.lessonId).toBe("01-greetings.json");
  });

  it("#673: falls back to the legacy id parser for steps without review_lesson_id", () => {
    useReviewLessonMock.mockReturnValue({
      ...BASE,
      lesson: {...LESSON, steps: [{...STEP, id: "review-01-greetings.json-exa-merci", review_lesson_id: undefined}]},
    });
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.lessonId).toBe("01-greetings.json");
  });

  it.each([
    ["full id", "review-01-greetings.json-exa-merci", "01-greetings.json"],
    ["lossy by design (#673): a hyphenated exercise id loses its tail", "review-01-greetings.json-ex-a-merci", "01-greetings.json-ex"],
    ["boundary: one dash only", "review-abc", "abc"],
    ["boundary: two tokens", "review-abc-def", "abc-def"],
    ["edge: no review prefix", "lesson-x", ""],
  ])("legacy parser %s", (_name, stepId, expected) => {
    expect(extractReviewLessonId(stepId)).toBe(expected);
  });
});

describe("useReviewSource: position, summary and navigation", () => {
  it("carries the position and is not on the summary while a step is open", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.position).toEqual({index: 0, total: 2});
    expect(result.current.isSummary).toBe(false);
  });

  it("boundary: the index past the last step is the summary with a null step", () => {
    useReviewLessonMock.mockReturnValue({...BASE, currentStepIndex: 2});
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.isSummary).toBe(true);
    expect(result.current.step).toBeNull();
    expect(result.current.position).toEqual({index: 2, total: 2});
  });

  it("forwards goNext, goPrev and reload to the hook", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    result.current.goNext();
    result.current.goPrev?.();
    act(() => result.current.reload());
    expect(BASE.goNext).toHaveBeenCalledTimes(1);
    expect(BASE.goPrev).toHaveBeenCalledTimes(1);
    expect(BASE.reload).toHaveBeenCalledTimes(1);
  });

  it("#3170: recordStepAttempts carries the current step along", async () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    const attempts = [{element_key: "merci", correct: true}];
    await result.current.recordStepAttempts(attempts as never);
    expect(BASE.recordStepAttempts).toHaveBeenCalledWith(attempts, STEP);
  });
});

describe("useReviewSource: summary data and run identity", () => {
  it("tallies come from the hook's per-element scores", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.tallies).toEqual({correct: 1, total: 2, remaining: 4});
  });

  it("edge: missing counts default to zero", () => {
    useReviewLessonMock.mockReturnValue({
      ...BASE,
      sessionScoreCorrect: undefined,
      sessionScoreTotal: undefined,
      remaining: undefined,
      dueCount: undefined,
    });
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.tallies).toEqual({correct: 0, total: 0, remaining: 0});
  });

  it("#3170: neutral wording once the queue holds a never-wrong element", () => {
    const {result, rerender} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    expect(result.current.neutral).toBe(false);
    useReviewLessonMock.mockReturnValue({
      ...BASE,
      queue: [...BASE.queue, {element_key: "bonjour", error_count: 0}],
    });
    rerender();
    expect(result.current.neutral).toBe(true);
  });

  it("the run key names the set and changes with every round", () => {
    const {result} = renderHook(() => useReviewSource({setId: "fr-a1", limit: 10}));
    const first = result.current.runKey;
    expect(first).toContain("fr-a1");
    act(() => result.current.reload());
    expect(result.current.runKey).not.toBe(first);
    expect(result.current.runKey).toContain("fr-a1");
  });
});
