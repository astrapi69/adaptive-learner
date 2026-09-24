/**
 * LessonRunner composition (EXP-052 slice 1, refs #3169).
 *
 * Slice 0 pinned an empty frame; slice 1 composes it: status view,
 * header, scroll anchor, progress, the exercise step, the summary render
 * prop at exactly one place, the policy-driven footer, the pinned lesson
 * mode, the two-phase state and the hint clear keyed on the run. Each
 * pin holds the shell's contract for the pages that migrate in slices 2
 * to 4.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {clearHintUsage, markHintUsed, wasHintUsed} from "../../../lib/hints/hint-usage";
import LessonRunner from "./LessonRunner";
import {ENDLESS_POLICY, LESSON_POLICY, REVIEW_POLICY, RUNNER_POLICIES} from "./policies";
import type {RunnerPolicy, RunnerSource, RunnerSourceStatus} from "./types";

vi.mock("../../exercises/shell/ExerciseDispatcher", async (orig) => {
  const actual = await orig<typeof import("../../exercises/shell/ExerciseDispatcher")>();
  const {forwardRef, useImperativeHandle} = await import("react");
  type Props = {
    onInteraction?: (a: boolean) => void;
    onComplete: (r: unknown) => Promise<void>;
  };
  const Mock = forwardRef<{submit: () => void}, Props>((props, ref) => {
    useImperativeHandle(ref, () => ({
      submit: () => void props.onComplete({correct: 1, total: 1, attempts: []}),
    }));
    return <input data-testid="mock-input" onChange={() => props.onInteraction?.(true)} />;
  });
  Mock.displayName = "MockExerciseDispatcher";
  return {...actual, ExerciseDispatcher: Mock};
});

const STEP = {
  id: "s0",
  type: "exercise" as const,
  title: null,
  exercise: {
    id: "ex-a",
    type: "cloze" as const,
    prompt: "Fill in",
    card_ids: [],
    sentence: "___",
    blanks: [{accept: ["a"]}],
    distractors: [],
  },
};

function makeSource(overrides: Partial<RunnerSource> = {}): RunnerSource {
  return {
    status: "ready",
    error: null,
    title: "Review session",
    subtitle: "Reviewing 2 elements",
    step: STEP,
    cards: [],
    setId: "fr-a1",
    lessonId: "l1",
    runKey: "fr-a1#0",
    position: {index: 0, total: 2},
    isSummary: false,
    tallies: {correct: 1, total: 2, remaining: 3},
    goNext: vi.fn(),
    goPrev: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mount(source: RunnerSource, policy: RunnerPolicy = REVIEW_POLICY, extra = {}) {
  return render(
    <MemoryRouter initialEntries={["/review/fr-a1"]}>
      <Routes>
        <Route
          path="/review/:setId"
          element={
            <LessonRunner
              source={source}
              policy={policy}
              summary={(tallies) => (
                <div data-testid="summary-probe">{`${tallies.correct}/${tallies.total}/${tallies.remaining}`}</div>
              )}
              {...extra}
            />
          }
        />
        <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearHintUsage();
});

describe("LessonRunner: frame", () => {
  it.each(Object.entries(RUNNER_POLICIES))(
    "%s renders main#main.lesson-page with the prefixed page testid",
    (prefix, policy) => {
      mount(makeSource(), policy);
      const main = screen.getByTestId(`${prefix}-page`);
      expect(main.tagName).toBe("MAIN");
      expect(main).toHaveAttribute("id", "main");
      expect(main.className).toContain("lesson-page");
    },
  );

  it("renders the step anchor before the progress bar", () => {
    mount(makeSource());
    const anchor = screen.getByTestId("review-step-anchor");
    const bar = screen.getByTestId("review-progress-bar");
    expect(anchor.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("LessonRunner: status screens", () => {
  it.each([
    ["loading", "review-loading"],
    ["empty", "review-empty"],
    ["not-cached", "review-not-cached"],
    ["error", "review-error"],
  ] as Array<[RunnerSourceStatus, string]>)("%s renders %s and no frame", (status, testId) => {
    mount(makeSource({status, step: null}));
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByTestId("review-page")).toBeNull();
  });

  it("boundary: a missing set id wins over a ready source", () => {
    mount(makeSource({setId: ""}));
    expect(screen.getByTestId("review-missing-params")).toBeInTheDocument();
  });
});

describe("LessonRunner: header and progress", () => {
  it("renders the session header with back button, title and subtitle", () => {
    mount(makeSource());
    expect(screen.getByTestId("review-back-btn")).toBeInTheDocument();
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Review session");
    expect(screen.getByTestId("review-subtitle")).toHaveTextContent("Reviewing 2 elements");
  });

  it("computes the percent once from the position", () => {
    mount(makeSource({position: {index: 1, total: 4}}));
    expect(screen.getByTestId("review-progress-bar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByTestId("review-progress-bar")).toHaveTextContent("Step 2 of 4");
  });

  it("renders the header extension", () => {
    mount(makeSource(), REVIEW_POLICY, {
      headerExtra: (source: RunnerSource) => <p data-testid="extra">{source.title}</p>,
    });
    expect(screen.getByTestId("extra")).toHaveTextContent("Review session");
  });
});

describe("LessonRunner: step, footer and two-phase state", () => {
  it("renders the step article under the prefix and the policy footer (prev, check, no pause)", () => {
    mount(makeSource());
    expect(screen.getByTestId("review-step-s0")).toBeInTheDocument();
    expect(screen.getByTestId("review-prev")).toBeDisabled();
    expect(screen.getByTestId("review-check")).toBeDisabled();
    expect(screen.queryByTestId("review-pause-btn")).toBeNull();
    expect(screen.queryByTestId("review-next")).toBeNull();
  });

  it("policy table: Endless has no Previous, the lesson carries the pause control", () => {
    const {unmount} = mount(makeSource({position: null, goPrev: undefined}), ENDLESS_POLICY);
    expect(screen.queryByTestId("endless-prev")).toBeNull();
    unmount();
    mount(makeSource(), LESSON_POLICY);
    expect(screen.getByTestId("lesson-pause-btn")).toBeInTheDocument();
  });

  it("Check grades through the exercise ref, then Next advances through the source", async () => {
    const source = makeSource();
    mount(source);
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "a"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("review-check"));
    await waitFor(() => expect(screen.getByTestId("review-next")).toBeInTheDocument());
    expect(source.recordStepAttempts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("review-next"));
    expect(source.goNext).toHaveBeenCalledTimes(1);
  });

  it("Previous goes back through the source", () => {
    const source = makeSource({position: {index: 1, total: 2}});
    mount(source);
    fireEvent.click(screen.getByTestId("review-prev"));
    expect(source.goPrev).toHaveBeenCalledTimes(1);
  });
});

describe("LessonRunner: summary render prop", () => {
  it("renders the summary exactly once, between progress and footer, with the source tallies", () => {
    mount(makeSource({step: null, isSummary: true, position: {index: 2, total: 2}}));
    const probes = screen.getAllByTestId("summary-probe");
    expect(probes).toHaveLength(1);
    expect(probes[0]).toHaveTextContent("1/2/3");
    const bar = screen.getByTestId("review-progress-bar");
    const footer = screen.getByTestId("review-footer");
    expect(bar.compareDocumentPosition(probes[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(probes[0].compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("review-check")).toBeNull();
    expect(screen.queryByTestId("review-next")).toBeNull();
  });

  it("does not render the summary on a step", () => {
    mount(makeSource());
    expect(screen.queryByTestId("summary-probe")).toBeNull();
  });
});

describe("LessonRunner: pinned lesson mode", () => {
  function ModeProbe() {
    const {mode} = useLessonMode();
    return <span data-testid="mode-probe">{mode}</span>;
  }

  it("wraps the content in the policy's mode (review pins practice)", () => {
    render(
      <MemoryRouter>
        <LessonRunner
          source={makeSource({step: null, isSummary: true})}
          policy={REVIEW_POLICY}
          summary={() => <ModeProbe />}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("mode-probe")).toHaveTextContent("practice");
  });

  it("a policy pinning another mode reaches the content", () => {
    render(
      <MemoryRouter>
        <LessonRunner
          source={makeSource({step: null, isSummary: true})}
          policy={{...REVIEW_POLICY, mode: "exam"}}
          summary={() => <ModeProbe />}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("mode-probe")).toHaveTextContent("exam");
  });
});

describe("LessonRunner: a section of the run (Error Replay retry round, slice 3)", () => {
  function Shell({source}: {source: RunnerSource}) {
    return (
      <MemoryRouter>
        <LessonRunner source={source} policy={REVIEW_POLICY} summary={() => null} />
      </MemoryRouter>
    );
  }

  async function answerFirstStep(source: RunnerSource) {
    const view = render(<Shell source={source} />);
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "a"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("review-check"));
    await waitFor(() => expect(screen.getByTestId("review-next")).toBeInTheDocument());
    return view;
  }

  it("reproduction: a new section re-opens a step answered in the previous one", async () => {
    const first = makeSource({sectionKey: "0"});
    const {rerender} = await answerFirstStep(first);
    rerender(<Shell source={{...first, step: null, isSummary: true, position: {index: 2, total: 2}}} />);
    // The retry round replays the SAME step id at index 0, in one update.
    rerender(<Shell source={{...first, sectionKey: "1", position: {index: 0, total: 1}}} />);
    expect(screen.getByTestId("review-check")).toBeInTheDocument();
    expect(screen.queryByTestId("review-next")).toBeNull();
  });

  it("edge: without a new section the answered step stays locked on re-entry", async () => {
    const first = makeSource({sectionKey: "0"});
    const {rerender} = await answerFirstStep(first);
    rerender(<Shell source={{...first, step: null, isSummary: true, position: {index: 2, total: 2}}} />);
    rerender(<Shell source={{...first, position: {index: 0, total: 2}}} />);
    expect(screen.queryByTestId("review-check")).toBeNull();
    expect(screen.getByTestId("review-next")).toBeInTheDocument();
  });

  it("boundary: a new section keeps the run's hint usage (only a new run clears it)", async () => {
    const first = makeSource({sectionKey: "0"});
    const {rerender} = await answerFirstStep(first);
    markHintUsed("ex-a");
    rerender(<Shell source={{...first, sectionKey: "1", position: {index: 0, total: 1}}} />);
    expect(wasHintUsed("ex-a")).toBe(true);
  });
});

describe("LessonRunner: the graded result reaches the source (slice 3)", () => {
  it("hands onStepScored the step id and the dispatcher's score", async () => {
    const onStepScored = vi.fn();
    const source = makeSource({onStepScored});
    mount(source);
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "a"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("review-check"));
    await waitFor(() => expect(onStepScored).toHaveBeenCalledTimes(1));
    expect(onStepScored).toHaveBeenCalledWith("s0", expect.objectContaining({correct: 1, total: 1}));
  });

  it("edge: a source without onStepScored still records", async () => {
    const source = makeSource();
    mount(source);
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "a"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("review-check"));
    await waitFor(() => expect(source.recordStepAttempts).toHaveBeenCalledTimes(1));
  });
});

describe("LessonRunner: hint usage cleared per run", () => {
  it("clears at run start", () => {
    markHintUsed("ex-a");
    mount(makeSource());
    expect(wasHintUsed("ex-a")).toBe(false);
  });

  it("edge: does not clear on a re-render of the same run", async () => {
    mount(makeSource());
    markHintUsed("ex-a");
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "a"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    expect(wasHintUsed("ex-a")).toBe(true);
  });

  it("boundary: a new run key clears again", () => {
    const {rerender} = render(
      <MemoryRouter>
        <LessonRunner source={makeSource()} policy={REVIEW_POLICY} summary={() => null} />
      </MemoryRouter>,
    );
    markHintUsed("ex-a");
    act(() => {
      rerender(
        <MemoryRouter>
          <LessonRunner
            source={makeSource({runKey: "fr-a1#1"})}
            policy={REVIEW_POLICY}
            summary={() => null}
          />
        </MemoryRouter>,
      );
    });
    expect(wasHintUsed("ex-a")).toBe(false);
  });
});
