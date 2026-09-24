/**
 * RunnerStep (EXP-052 slice 1, refs #3169).
 *
 * The active exercise step of the shell: the controlled dispatcher
 * inside the prefixed step article; ``onComplete`` flips the two-phase
 * state, keeps the run-local result (the #1790 lock) and records the
 * hint-stamped attempts through the source. A re-entered answered step
 * hands the dispatcher its locked ``reviewed`` answer, or the fallback
 * panel when no raw answer was kept.
 */

import "@testing-library/jest-dom/vitest";
import {act, render, screen} from "@testing-library/react";
import {createRef} from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {clearHintUsage, markHintUsed} from "../../../lib/hints/hint-usage";
import type {ExerciseHandle} from "../../exercises";
import RunnerStep from "./RunnerStep";
import type {RunnerSource} from "./types";

const dispatcherProps = vi.fn();

vi.mock("../../exercises/shell/ExerciseDispatcher", async (orig) => {
  const actual = await orig<typeof import("../../exercises/shell/ExerciseDispatcher")>();
  const {forwardRef, useImperativeHandle} = await import("react");
  type Props = {
    reviewed?: unknown;
    onComplete: (r: unknown) => Promise<void>;
  };
  const Mock = forwardRef<{submit: () => void}, Props>((props, ref) => {
    dispatcherProps(props);
    useImperativeHandle(ref, () => ({
      submit: () =>
        void props.onComplete({
          correct: 1,
          total: 1,
          attempts: [
            {set_id: "fr-a1", lesson_id: "l1", exercise_id: "ex-a", element_key: "merci", correct: true},
          ],
          raw_answer: {kind: "cloze", inputs: ["merci"]},
        }),
    }));
    return <div data-testid="mock-exercise" data-reviewed={props.reviewed ? "locked" : "open"} />;
  });
  Mock.displayName = "MockExerciseDispatcher";
  return {...actual, ExerciseDispatcher: Mock};
});

const STEP = {
  id: "review-s0",
  type: "exercise" as const,
  title: null,
  exercise: {
    id: "ex-a",
    type: "cloze" as const,
    prompt: "Fill in",
    card_ids: [],
    sentence: "___ beaucoup",
    blanks: [{accept: ["merci"]}],
    distractors: [],
  },
};

function makeSource(): RunnerSource {
  return {
    status: "ready",
    error: null,
    title: "Review session",
    step: STEP,
    cards: [],
    setId: "fr-a1",
    lessonId: "l1",
    runKey: "fr-a1#0",
    position: {index: 0, total: 1},
    isSummary: false,
    tallies: {correct: 0, total: 0},
    goNext: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  dispatcherProps.mockClear();
  clearHintUsage();
});

describe("RunnerStep", () => {
  it("renders the prefixed step article with the step type", () => {
    render(
      <RunnerStep
        testIdPrefix="review"
        step={STEP}
        source={makeSource()}
        exerciseRef={createRef<ExerciseHandle>()}
        enteredReviewed={false}
        reviewedRaw={null}
        stored={undefined}
        onInteraction={vi.fn()}
        onChecked={vi.fn()}
        onScored={vi.fn()}
      />,
    );
    const article = screen.getByTestId("review-step-review-s0");
    expect(article).toHaveAttribute("data-step-type", "exercise");
    expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
  });

  it("happy path: onComplete flips checked, keeps the run-local result and records hint-stamped attempts", async () => {
    const source = makeSource();
    const onChecked = vi.fn();
    const onScored = vi.fn();
    const ref = createRef<ExerciseHandle>();
    markHintUsed("ex-a");
    render(
      <RunnerStep
        testIdPrefix="review"
        step={STEP}
        source={source}
        exerciseRef={ref}
        enteredReviewed={false}
        reviewedRaw={null}
        stored={undefined}
        onInteraction={vi.fn()}
        onChecked={onChecked}
        onScored={onScored}
      />,
    );
    await act(async () => {
      ref.current?.submit();
    });
    expect(onChecked).toHaveBeenCalledTimes(1);
    expect(onScored).toHaveBeenCalledWith("review-s0", expect.objectContaining({correct: 1, total: 1}));
    expect(source.recordStepAttempts).toHaveBeenCalledTimes(1);
    const recorded = (source.recordStepAttempts as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded[0]).toMatchObject({element_key: "merci", hint_used: true});
  });

  it("hands the dispatcher the source's set, lesson and cards", () => {
    render(
      <RunnerStep
        testIdPrefix="review"
        step={STEP}
        source={makeSource()}
        exerciseRef={createRef<ExerciseHandle>()}
        enteredReviewed={false}
        reviewedRaw={null}
        stored={undefined}
        onInteraction={vi.fn()}
        onChecked={vi.fn()}
        onScored={vi.fn()}
      />,
    );
    expect(dispatcherProps).toHaveBeenCalledWith(
      expect.objectContaining({controlled: true, setId: "fr-a1", lessonId: "l1", cards: []}),
    );
  });

  it("locked re-entry: the dispatcher receives the reviewed raw answer", () => {
    const raw = {kind: "cloze" as const, inputs: ["merci"]};
    render(
      <RunnerStep
        testIdPrefix="review"
        step={STEP}
        source={makeSource()}
        exerciseRef={createRef<ExerciseHandle>()}
        enteredReviewed
        reviewedRaw={raw}
        stored={{correct: 1, total: 1, attempts: 1, completed_at: "t", raw_answer: raw}}
        onInteraction={vi.fn()}
        onChecked={vi.fn()}
        onScored={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "locked");
  });

  it("edge: locked re-entry without a raw answer renders the fallback panel instead", () => {
    render(
      <RunnerStep
        testIdPrefix="review"
        step={STEP}
        source={makeSource()}
        exerciseRef={createRef<ExerciseHandle>()}
        enteredReviewed
        reviewedRaw={null}
        stored={{correct: 1, total: 1, attempts: 1, completed_at: "t", raw_answer: null}}
        onInteraction={vi.fn()}
        onChecked={vi.fn()}
        onScored={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("mock-exercise")).toBeNull();
    expect(screen.getByTestId("review-step-review-s0")).toBeInTheDocument();
  });
});

const THEORY_STEP = {
  id: "adaptive-theory-01-greetings-intro",
  type: "theory" as const,
  title: "Greetings",
  body: "## Saying hello\n\n**Bonjour** means hello.",
  exercise: null,
};

type StepUnderTest = Parameters<typeof RunnerStep>[0]["step"];

function renderStep(step: StepUnderTest, testIdPrefix: Parameters<typeof RunnerStep>[0]["testIdPrefix"] = "review") {
  return render(
    <RunnerStep
      testIdPrefix={testIdPrefix}
      step={step}
      source={makeSource()}
      exerciseRef={createRef<ExerciseHandle>()}
      enteredReviewed={false}
      reviewedRaw={null}
      stored={undefined}
      onInteraction={vi.fn()}
      onChecked={vi.fn()}
      onScored={vi.fn()}
    />,
  );
}

describe("RunnerStep: the one decision between theory and exercise (#3224)", () => {
  it("reproduction: a theory step renders its content, not the exercise dispatcher", () => {
    renderStep(THEORY_STEP, "adaptive-lesson");
    const article = screen.getByTestId(`adaptive-lesson-step-${THEORY_STEP.id}`);
    expect(article).toHaveAttribute("data-step-type", "theory");
    expect(screen.getByRole("heading", {level: 2, name: "Greetings"})).toBeInTheDocument();
    const body = screen.getByTestId("adaptive-lesson-theory-body");
    expect(body).toHaveTextContent("Saying hello");
    expect(body.querySelector("strong")).toHaveTextContent("Bonjour");
    expect(dispatcherProps).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mock-exercise")).toBeNull();
  });

  it.each([
    ["a theory step", "theory", THEORY_STEP],
    ["a theory step that also carries an exercise (the type decides)", "theory", {...THEORY_STEP, exercise: STEP.exercise}],
    ["an exercise step", "exercise", STEP],
    ["an exercise step without an exercise (the dispatcher's content-defect path)", "exercise", {...STEP, exercise: null}],
  ] as const)("%s goes to the %s renderer", (_name, renderer, step) => {
    renderStep(step as StepUnderTest);
    const theoryBodies = screen.queryAllByTestId("review-theory-body");
    if (renderer === "theory") {
      expect(theoryBodies).toHaveLength(1);
      expect(dispatcherProps).not.toHaveBeenCalled();
    } else {
      expect(theoryBodies).toHaveLength(0);
      expect(dispatcherProps).toHaveBeenCalled();
    }
  });

  it("edge: a theory step without a body renders an empty theory body", () => {
    renderStep({...THEORY_STEP, title: null, body: null});
    expect(screen.getByTestId("review-theory-body")).toBeInTheDocument();
    expect(screen.queryByRole("heading", {level: 2})).toBeNull();
    expect(dispatcherProps).not.toHaveBeenCalled();
  });

  it("boundary: the theory content keeps its worked examples and example link, without the lesson-only chrome", () => {
    renderStep({
      ...THEORY_STEP,
      example_url: "https://example.org/greetings",
      example_label: "See it in use",
      examples: [{content: "Bonjour, Marie !"}],
    } as StepUnderTest);
    expect(screen.getByTestId("theory-example-link")).toHaveAttribute("href", "https://example.org/greetings");
    expect(screen.getByTestId("review-theory-body")).toHaveTextContent("Bonjour, Marie !");
    for (const lessonOnly of ["read-aloud-theory", "ask-ai-theory", "theory-back-to-exercise", "exercise-theory-link"]) {
      expect(screen.queryByTestId(lessonOnly)).toBeNull();
    }
  });
});
