/**
 * RunnerFooter (EXP-052 slice 0, refs #3169).
 *
 * The lesson footer generalised over the footer part of the policy
 * (``testIdPrefix`` / ``prevStep`` / ``pause``). Pins: byte-identical
 * output to ``LessonFooterNav`` for the lesson policy in every flow,
 * the prefixed testids, the prev-less and pause-less variants with
 * the #1834 overlap-proof layout, and the empty-summary null.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonFooterNav from "../chrome/LessonFooterNav";
import RunnerFooter from "./RunnerFooter";

const LESSON = {
  testIdPrefix: "lesson",
  i18nNamespace: "lesson",
  prevStep: true,
  pause: true,
  endRun: false,
} as const;
const REVIEW = {
  testIdPrefix: "review",
  i18nNamespace: "review",
  prevStep: true,
  pause: false,
  endRun: false,
} as const;
const ENDLESS = {
  testIdPrefix: "endless",
  i18nNamespace: "endless",
  prevStep: false,
  pause: true,
  endRun: true,
} as const;
/** A prev-less footer with a lone pause (no End): the centred-pause layout. */
const PAUSE_ONLY = { ...ENDLESS, endRun: false } as const;
const BARE = {
  testIdPrefix: "error-replay",
  i18nNamespace: "lesson.error_replay",
  prevStep: false,
  pause: false,
  endRun: false,
} as const;

const BASE = {
  isSummary: false,
  isExerciseStep: true,
  checked: false,
  enteredReviewed: false,
  answerable: true,
  isLastStep: false,
  currentStepIndex: 1,
  isInProgress: true,
  goPrev: () => {},
  goNext: () => {},
  onCheck: () => {},
  onPause: () => {},
  onExit: () => {},
};

describe("RunnerFooter - lesson policy is byte-identical to LessonFooterNav", () => {
  function html(element: React.ReactElement) {
    const { container, unmount } = render(element);
    const markup = container.innerHTML;
    unmount();
    return markup;
  }

  it.each([
    ["practice, unchecked", {}],
    ["practice, checked", { checked: true }],
    ["practice, entered reviewed", { enteredReviewed: true }],
    ["practice, not answerable", { answerable: false }],
    ["practice, last step", { checked: true, isLastStep: true }],
    ["practice, first step", { currentStepIndex: 0 }],
    ["practice, summary", { isSummary: true }],
    ["practice, not in progress", { isInProgress: false }],
    ["exam, exercise step", { delayedFeedback: true, onSubmitAndAdvance: () => {} }],
    ["exam, theory step", { delayedFeedback: true, isExerciseStep: false }],
    ["exam, summary", { delayedFeedback: true, isSummary: true }],
  ] as [string, Partial<React.ComponentProps<typeof LessonFooterNav>>][])(
    "%s renders the same markup through both entry points",
    (_label, overrides) => {
      const viaLesson = html(<LessonFooterNav {...BASE} {...overrides} />);
      const viaRunner = html(<RunnerFooter policy={LESSON} {...BASE} {...overrides} />);
      expect(viaRunner).toBe(viaLesson);
      expect(viaRunner).toContain(`data-testid="lesson-footer"`);
    },
  );
});

describe("RunnerFooter - testid prefix threads through every control", () => {
  it("prefixes footer, prev and check", () => {
    render(<RunnerFooter policy={REVIEW} {...BASE} />);
    expect(screen.getByTestId("review-footer")).toBeInTheDocument();
    expect(screen.getByTestId("review-prev")).toBeInTheDocument();
    expect(screen.getByTestId("review-check")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-footer")).not.toBeInTheDocument();
  });

  it("prefixes next once checked and the pause when the policy has one", () => {
    render(<RunnerFooter policy={ENDLESS} {...BASE} checked />);
    expect(screen.getByTestId("endless-next")).toBeInTheDocument();
    expect(screen.getByTestId("endless-pause-btn")).toBeInTheDocument();
  });

  it("prefixes the exam forward button", () => {
    render(
      <RunnerFooter policy={REVIEW} {...BASE} delayedFeedback onSubmitAndAdvance={() => {}} />,
    );
    expect(screen.getByTestId("review-next")).toBeInTheDocument();
  });
});

describe("RunnerFooter - prevStep: false (Endless: stream source, no step to go back to)", () => {
  it("renders no Previous button and needs no goPrev", () => {
    const { goPrev: _omitted, ...withoutGoPrev } = BASE;
    render(<RunnerFooter policy={ENDLESS} {...withoutGoPrev} />);
    expect(screen.queryByTestId("endless-prev")).not.toBeInTheDocument();
    expect(screen.getByTestId("endless-check")).toBeInTheDocument();
  });

  it("keeps a lone pause centred with mx-auto and every button shrink-0 (#1834)", () => {
    render(<RunnerFooter policy={PAUSE_ONLY} {...BASE} />);
    const nav = screen.getByTestId("endless-footer");
    expect(screen.getByTestId("endless-pause-btn")).toHaveClass("mx-auto", "shrink-0");
    expect(screen.getByTestId("endless-check")).toHaveClass("shrink-0");
    expect(nav.className).not.toContain("justify-between");
  });

  it("orders the Endless footer Pause -> End -> action", () => {
    render(<RunnerFooter policy={ENDLESS} {...BASE} paused={false} onEnd={() => {}} />);
    const ids = Array.from(
      screen.getByTestId("endless-footer").querySelectorAll("[data-testid]"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual(["endless-pause", "endless-end", "endless-check"]);
  });
});

// EXP-052 slice 2, Befund 2: pause and End leave the Endless stat line and
// are operated together in the footer; endRun is Endless-only.
describe("RunnerFooter - endRun + toggle pause (Endless)", () => {
  const ENDLESS_BASE = { ...BASE, paused: false, onEnd: () => {} };

  it("reproduction + happy path: End ends the run, the pause toggles in place", () => {
    const onEnd = vi.fn();
    const onPause = vi.fn();
    render(<RunnerFooter policy={ENDLESS} {...ENDLESS_BASE} onEnd={onEnd} onPause={onPause} />);
    fireEvent.click(screen.getByTestId("endless-end"));
    fireEvent.click(screen.getByTestId("endless-pause"));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("endless-pause")).toHaveAttribute("aria-pressed", "false");
  });

  it("lays out Pause at the leading edge and End taking the free space (#1834)", () => {
    render(<RunnerFooter policy={ENDLESS} {...ENDLESS_BASE} />);
    const pause = screen.getByTestId("endless-pause");
    expect(pause).toHaveClass("shrink-0");
    expect(pause).not.toHaveClass("mx-auto");
    expect(screen.getByTestId("endless-end")).toHaveClass("mr-auto", "shrink-0");
    expect(screen.getByTestId("endless-check")).not.toHaveClass("ml-auto");
  });

  it("edge: while paused the action is hidden and the pause reads as pressed (resume)", () => {
    const onPause = vi.fn();
    render(<RunnerFooter policy={ENDLESS} {...ENDLESS_BASE} paused onPause={onPause} checked />);
    const toggle = screen.getByTestId("endless-pause");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("endless-check")).toBeNull();
    expect(screen.queryByTestId("endless-next")).toBeNull();
    expect(screen.getByTestId("endless-end")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("boundary: the summary of a stream renders no footer at all (#1864 sole exit)", () => {
    const { container } = render(
      <RunnerFooter policy={ENDLESS} {...ENDLESS_BASE} isSummary isInProgress={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it.each([
    ["lesson", LESSON],
    ["review", REVIEW],
    ["error-replay", BARE],
  ] as const)("%s (endRun false) renders no End control", (prefix, policy) => {
    render(<RunnerFooter policy={policy} {...BASE} />);
    expect(screen.queryByTestId(`${prefix}-end`)).toBeNull();
  });
});

describe("RunnerFooter - pause: false (Review / Shuffle / Adaptive / ErrorReplay)", () => {
  it("renders no pause button and pushes the action to the trailing edge", () => {
    render(<RunnerFooter policy={REVIEW} {...BASE} />);
    expect(screen.queryByTestId("review-pause-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("review-check")).toHaveClass("ml-auto", "shrink-0");
    expect(screen.getByTestId("review-prev")).toHaveClass("shrink-0");
  });

  it("pushes Next to the trailing edge once checked", () => {
    render(<RunnerFooter policy={REVIEW} {...BASE} checked />);
    expect(screen.getByTestId("review-next")).toHaveClass("ml-auto", "shrink-0");
  });

  it("exam flow: the single forward button takes the trailing edge", () => {
    render(
      <RunnerFooter policy={REVIEW} {...BASE} delayedFeedback onSubmitAndAdvance={() => {}} />,
    );
    expect(screen.queryByTestId("review-pause-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("review-next")).toHaveClass("ml-auto", "shrink-0");
  });

  it("keeps Previous and Check wired", () => {
    const goPrev = vi.fn();
    const onCheck = vi.fn();
    render(<RunnerFooter policy={REVIEW} {...BASE} goPrev={goPrev} onCheck={onCheck} />);
    fireEvent.click(screen.getByTestId("review-prev"));
    fireEvent.click(screen.getByTestId("review-check"));
    expect(goPrev).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it("disables Previous on the first step", () => {
    render(<RunnerFooter policy={REVIEW} {...BASE} currentStepIndex={0} />);
    expect(screen.getByTestId("review-prev")).toBeDisabled();
  });
});

describe("RunnerFooter - neither prev nor pause", () => {
  it("renders only the action, trailing-aligned", () => {
    render(<RunnerFooter policy={BARE} {...BASE} />);
    const ids = Array.from(
      screen.getByTestId("error-replay-footer").querySelectorAll("[data-testid]"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual(["error-replay-check"]);
    expect(screen.getByTestId("error-replay-check")).toHaveClass("ml-auto");
  });

  it("renders nothing on the summary (an empty sticky bar is not a footer)", () => {
    const { container } = render(<RunnerFooter policy={BARE} {...BASE} isSummary />);
    expect(container.innerHTML).toBe("");
  });

  it("still renders the summary footer when a prev or pause control remains", () => {
    render(<RunnerFooter policy={REVIEW} {...BASE} isSummary />);
    expect(screen.getByTestId("review-footer")).toBeInTheDocument();
    expect(screen.getByTestId("review-prev")).toBeInTheDocument();
    expect(screen.queryByTestId("review-check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-next")).not.toBeInTheDocument();
  });
});
