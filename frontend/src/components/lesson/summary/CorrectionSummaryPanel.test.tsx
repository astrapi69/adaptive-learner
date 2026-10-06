/**
 * #3575 - the correction summary panel: the first-try line, how many
 * mistakes are corrected, and every mistake with its status, the first
 * answer against the correct one, and the explanation while it is open.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CorrectionSummary } from "../../../lib/lesson/correction-summary";
import type { ContentLessonExercise } from "../../../storage/types";
import CorrectionSummaryPanel from "./CorrectionSummaryPanel";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function entry(stepId: string, corrected: boolean, over: Partial<CorrectionSummary["entries"][number]> = {}) {
  return {
    exercise: { id: `ex-${stepId}` } as ContentLessonExercise,
    stepId,
    title: `Translate ${stepId}`,
    question: `Translate ${stepId}`,
    firstAnswer: "ola",
    correctAnswer: "hola",
    corrected,
    explanation: corrected ? null : "Spanish greets with hola.",
    ...over,
  };
}

const SUMMARY: CorrectionSummary = {
  entries: [entry("s1", true), entry("s2", false)],
  correctedCount: 1,
  total: 2,
  firstTry: { correct: 1, total: 3 },
};

describe("CorrectionSummaryPanel (#3575)", () => {
  it("states the first try and how many mistakes are corrected", () => {
    render(<CorrectionSummaryPanel summary={SUMMARY} t={t} />);
    expect(screen.getByTestId("correction-summary-first-try")).toHaveTextContent(
      "First try: 1 of 3 correct",
    );
    expect(screen.getByTestId("correction-summary-count")).toHaveTextContent("1 of 2 corrected");
  });

  it("lists every mistake with its status and the first answer against the correct one", () => {
    render(<CorrectionSummaryPanel summary={SUMMARY} t={t} />);
    const fixed = screen.getByTestId("correction-summary-entry-s1");
    expect(fixed).toHaveAttribute("data-corrected", "true");
    expect(fixed).toHaveTextContent("Corrected");
    expect(fixed).toHaveTextContent("ola");
    expect(fixed).toHaveTextContent("hola");
    const open = screen.getByTestId("correction-summary-entry-s2");
    expect(open).toHaveAttribute("data-corrected", "false");
    expect(open).toHaveTextContent("Still open");
  });

  it("shows the explanation only for a mistake that is still open", () => {
    render(<CorrectionSummaryPanel summary={SUMMARY} t={t} />);
    expect(
      within(screen.getByTestId("correction-summary-entry-s2")).getByTestId("correction-summary-explanation"),
    ).toHaveTextContent("Spanish greets with hola.");
    expect(
      within(screen.getByTestId("correction-summary-entry-s1")).queryByTestId("correction-summary-explanation"),
    ).toBeNull();
  });

  it("shows only the correct answer when the type keeps no first answer", () => {
    const noAnswer = { ...SUMMARY, entries: [entry("s1", false, { firstAnswer: null })] };
    render(<CorrectionSummaryPanel summary={noAnswer} t={t} />);
    const row = screen.getByTestId("correction-summary-entry-s1");
    expect(row).toHaveTextContent("Correct answer: hola");
    expect(row).not.toHaveTextContent("Your answer:");
  });

  it("renders nothing when the run had no mistakes", () => {
    const { container } = render(
      <CorrectionSummaryPanel summary={{ ...SUMMARY, entries: [], correctedCount: 0, total: 0 }} t={t} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
