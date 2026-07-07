/**
 * Tests for LessonFooterNav — the two-phase practice flow and the exam
 * delayed-feedback flow (#1007 Phase 2).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonFooterNav from "./LessonFooterNav";

const BASE = {
  isSummary: false,
  isExerciseStep: true,
  checked: false,
  enteredReviewed: false,
  answerable: true,
  isLastStep: false,
  currentStepIndex: 1,
  goPrev: () => {},
  goNext: () => {},
  onCheck: () => {},
};

describe("LessonFooterNav — practice flow", () => {
  it("shows Previous + Check on an unchecked exercise step", () => {
    render(<LessonFooterNav {...BASE} />);
    expect(screen.getByTestId("lesson-prev")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-check")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-next")).not.toBeInTheDocument();
  });

  it("shows Next once the step is checked", () => {
    render(<LessonFooterNav {...BASE} checked />);
    expect(screen.getByTestId("lesson-next")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-check")).not.toBeInTheDocument();
  });

  it("gates Check on answerable", () => {
    render(<LessonFooterNav {...BASE} answerable={false} />);
    expect(screen.getByTestId("lesson-check")).toBeDisabled();
  });
});

describe("LessonFooterNav — exam delayed-feedback flow (#1007 Phase 2)", () => {
  it("shows a single forward button and NO Previous / Check", () => {
    render(
      <LessonFooterNav
        {...BASE}
        delayedFeedback
        onSubmitAndAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId("lesson-next")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-prev")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lesson-check")).not.toBeInTheDocument();
  });

  it("submits + advances in one click on an exercise step", () => {
    const onSubmitAndAdvance = vi.fn();
    const goNext = vi.fn();
    render(
      <LessonFooterNav
        {...BASE}
        delayedFeedback
        goNext={goNext}
        onSubmitAndAdvance={onSubmitAndAdvance}
      />,
    );
    fireEvent.click(screen.getByTestId("lesson-next"));
    expect(onSubmitAndAdvance).toHaveBeenCalledTimes(1);
    expect(goNext).not.toHaveBeenCalled();
  });

  it("gates the forward button on answerable for an exercise step", () => {
    render(
      <LessonFooterNav
        {...BASE}
        delayedFeedback
        answerable={false}
        onSubmitAndAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId("lesson-next")).toBeDisabled();
  });

  it("just advances (no submit, always enabled) on a theory step", () => {
    const onSubmitAndAdvance = vi.fn();
    const goNext = vi.fn();
    render(
      <LessonFooterNav
        {...BASE}
        isExerciseStep={false}
        answerable={false}
        delayedFeedback
        goNext={goNext}
        onSubmitAndAdvance={onSubmitAndAdvance}
      />,
    );
    const btn = screen.getByTestId("lesson-next");
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(goNext).toHaveBeenCalledTimes(1);
    expect(onSubmitAndAdvance).not.toHaveBeenCalled();
  });

  it("hides the action button on the summary screen", () => {
    render(<LessonFooterNav {...BASE} delayedFeedback isSummary />);
    expect(screen.queryByTestId("lesson-next")).not.toBeInTheDocument();
  });
});

describe("LessonFooterNav — landscape / safe-area reachability (#1410)", () => {
  it("practice footer stays sticky-bottom and pads with the safe-area utility", () => {
    render(<LessonFooterNav {...BASE} />);
    const nav = screen.getByTestId("lesson-footer");
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("bottom-0");
    // pb-safe = max(var(--space-3), env(safe-area-inset-bottom)) — clears the
    // iOS home-indicator band in landscape AND portrait; identical to the old
    // py-3 bottom padding where the inset is 0 (desktop/Android).
    expect(nav.className).toContain("pb-safe");
    expect(nav.className).toContain("pt-3");
  });

  it("exam (delayed-feedback) footer carries the same safe-area padding", () => {
    render(
      <LessonFooterNav {...BASE} delayedFeedback onSubmitAndAdvance={() => {}} />,
    );
    const nav = screen.getByTestId("lesson-footer");
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("bottom-0");
    expect(nav.className).toContain("pb-safe");
    expect(nav.className).toContain("pt-3");
  });
});
