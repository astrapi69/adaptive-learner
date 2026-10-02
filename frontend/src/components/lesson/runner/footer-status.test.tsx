/**
 * #3237 - the footer status channel: a renderer publishes, the footer shows,
 * nothing leaks past the renderer's lifetime, and no provider means no-op.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonFooterNav from "../chrome/LessonFooterNav";
import RunnerFooter from "./RunnerFooter";
import { FooterStatusLine, FooterStatusProvider, useFooterStatus } from "./footer-status";
import type { RunnerPolicy } from "./types";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "en" }),
}));

function Publisher({ text }: { text: string | null }) {
  useFooterStatus(text);
  return null;
}

const LESSON: Pick<
  RunnerPolicy,
  "testIdPrefix" | "i18nNamespace" | "prevStep" | "pause" | "endRun"
> = {
  testIdPrefix: "lesson",
  i18nNamespace: "lesson",
  prevStep: true,
  pause: true,
  endRun: false,
};

const FOOTER_PROPS = {
  isSummary: false,
  isExerciseStep: true,
  isInProgress: false,
  checked: false,
  enteredReviewed: false,
  answerable: false,
  isLastStep: false,
  currentStepIndex: 1,
  goPrev: () => undefined,
  goNext: () => undefined,
  onCheck: () => undefined,
  onPause: () => undefined,
  onExit: () => undefined,
};

describe("footer status channel (#3237)", () => {
  it("shows what a mounted renderer publishes and drops it on unmount", () => {
    const { rerender } = render(
      <FooterStatusProvider>
        <Publisher text="2 / 5 paired" />
        <FooterStatusLine testId="probe-status" />
      </FooterStatusProvider>,
    );
    expect(screen.getByTestId("probe-status")).toHaveTextContent("2 / 5 paired");
    rerender(
      <FooterStatusProvider>
        <FooterStatusLine testId="probe-status" />
      </FooterStatusProvider>,
    );
    expect(screen.queryByTestId("probe-status")).not.toBeInTheDocument();
  });

  it("gives way to the footer's buttons on a narrow phone (#3237, 320 px)", () => {
    // The footer row is Prev + Pause + status + Check, all on one line. At
    // 320 px the buttons alone nearly fill it; the status is a decorative
    // mirror of the renderer's own counter, so it is the part that shrinks
    // (and truncates) instead of pushing Check past the viewport.
    render(
      <FooterStatusProvider>
        <Publisher text="2 / 5 paired" />
        <FooterStatusLine testId="probe-status" />
      </FooterStatusProvider>,
    );
    const status = screen.getByTestId("probe-status");
    expect(status).not.toHaveClass("shrink-0");
    expect(status).toHaveClass("min-w-0", "truncate");
  });

  it("renders nothing while nothing is published", () => {
    render(
      <FooterStatusProvider>
        <Publisher text={null} />
        <FooterStatusLine testId="probe-status" />
      </FooterStatusProvider>,
    );
    expect(screen.queryByTestId("probe-status")).not.toBeInTheDocument();
  });

  it("is a no-op without a provider", () => {
    render(
      <>
        <Publisher text="orphan" />
        <FooterStatusLine testId="probe-status" />
      </>,
    );
    expect(screen.queryByTestId("probe-status")).not.toBeInTheDocument();
  });

  it("both footers show the line next to Check, and hide it on the summary", () => {
    const { unmount } = render(
      <FooterStatusProvider>
        <Publisher text="1 / 3 paired" />
        <RunnerFooter policy={LESSON} {...FOOTER_PROPS} />
      </FooterStatusProvider>,
    );
    const runnerLine = screen.getByTestId("lesson-footer-status");
    expect(runnerLine).toHaveTextContent("1 / 3 paired");
    expect(runnerLine.nextElementSibling).toBe(screen.getByTestId("lesson-check"));
    expect(runnerLine).toHaveAttribute("aria-hidden", "true");
    unmount();

    render(
      <FooterStatusProvider>
        <Publisher text="1 / 3 paired" />
        <LessonFooterNav {...FOOTER_PROPS} />
      </FooterStatusProvider>,
    );
    const lessonLine = screen.getByTestId("lesson-footer-status");
    expect(lessonLine).toHaveTextContent("1 / 3 paired");
    expect(lessonLine.nextElementSibling).toBe(screen.getByTestId("lesson-check"));
  });

  it("the summary footer never shows a status", () => {
    render(
      <FooterStatusProvider>
        <Publisher text="stale" />
        <LessonFooterNav {...FOOTER_PROPS} isSummary isExerciseStep={false} />
      </FooterStatusProvider>,
    );
    expect(screen.queryByTestId("lesson-footer-status")).not.toBeInTheDocument();
  });
});
