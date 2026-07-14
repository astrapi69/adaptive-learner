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
  isInProgress: true,
  goPrev: () => {},
  goNext: () => {},
  onCheck: () => {},
  onPause: () => {},
  onExit: () => {},
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

describe("LessonFooterNav — footer pause control (#1642)", () => {
  it("renders the icon-only pause button with a 44px target in the practice flow", () => {
    render(<LessonFooterNav {...BASE} />);
    const pause = screen.getByTestId("lesson-pause-btn");
    expect(pause).toHaveAttribute("aria-label", "Pause lesson");
    // Icon-only: no visible text label, but the icon is present.
    expect(pause).not.toHaveTextContent("Pause");
    expect(pause.querySelector("svg")).not.toBeNull();
    // 44px touch target via shadcn Button size="icon" (size-11).
    expect(pause).toHaveClass("size-11");
  });

  it("is also present in the exam delayed-feedback flow", () => {
    render(
      <LessonFooterNav {...BASE} delayedFeedback onSubmitAndAdvance={() => {}} />,
    );
    expect(screen.getByTestId("lesson-pause-btn")).toBeInTheDocument();
  });

  it("pauses (not exits) while the lesson is in progress", () => {
    const onPause = vi.fn();
    const onExit = vi.fn();
    render(
      <LessonFooterNav {...BASE} isInProgress onPause={onPause} onExit={onExit} />,
    );
    fireEvent.click(screen.getByTestId("lesson-pause-btn"));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it("exits (not pauses) when the lesson is no longer in progress", () => {
    const onPause = vi.fn();
    const onExit = vi.fn();
    render(
      <LessonFooterNav
        {...BASE}
        isInProgress={false}
        onPause={onPause}
        onExit={onExit}
      />,
    );
    fireEvent.click(screen.getByTestId("lesson-pause-btn"));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onPause).not.toHaveBeenCalled();
  });

  it("orders the footer Previous -> Pause -> action for a sensible focus flow", () => {
    render(<LessonFooterNav {...BASE} />);
    const nav = screen.getByTestId("lesson-footer");
    const ids = Array.from(nav.querySelectorAll("[data-testid]")).map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual(["lesson-prev", "lesson-pause-btn", "lesson-check"]);
    // centred distribution so pause sits between the two edges
    expect(nav.className).toContain("justify-between");
  });

  it("keeps Previous and Check working after the layout change (no regression)", () => {
    const goPrev = vi.fn();
    const onCheck = vi.fn();
    render(<LessonFooterNav {...BASE} currentStepIndex={1} goPrev={goPrev} onCheck={onCheck} />);
    fireEvent.click(screen.getByTestId("lesson-prev"));
    expect(goPrev).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("lesson-check"));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });
});
