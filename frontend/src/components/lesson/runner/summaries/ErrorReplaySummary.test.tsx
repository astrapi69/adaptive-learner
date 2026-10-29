/**
 * #3575 - the end of Retry errors shows the same correction summary as
 * the lesson summary when the source run's first pass came along.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CorrectionSummary } from "../../../../lib/lesson/correction/correction-summary";
import type { ContentLessonExercise } from "../../../../storage/types";
import ErrorReplaySummary from "./ErrorReplaySummary";

const SUMMARY: CorrectionSummary = {
  entries: [
    {
      exercise: { id: "ex-s1" } as ContentLessonExercise,
      stepId: "s1",
      title: "Translate s1",
      question: "Translate s1",
      firstAnswer: "ola",
      correctAnswer: "hola",
      corrected: true,
      explanation: null,
    },
  ],
  correctedCount: 1,
  total: 1,
  firstTry: { correct: 2, total: 3 },
};

function renderSummary(correctionSummary?: CorrectionSummary | null) {
  return render(
    <ErrorReplaySummary
      correct={1}
      total={1}
      stillWrong={0}
      onRetry={vi.fn()}
      onDone={vi.fn()}
      correctionSummary={correctionSummary}
    />,
  );
}

describe("ErrorReplaySummary correction summary (#3575)", () => {
  it("lists what was corrected when the source run came along", () => {
    renderSummary(SUMMARY);
    expect(screen.getByTestId("correction-summary")).toHaveTextContent("1 of 1 corrected");
    expect(screen.getByTestId("correction-summary-entry-s1")).toHaveAttribute("data-corrected", "true");
  });

  it.each([
    ["absent", undefined],
    ["null (a flash round)", null],
  ])("keeps the score-only recap when the summary is %s", (_name, summary) => {
    renderSummary(summary);
    expect(screen.getByTestId("error-replay-summary-score")).toBeInTheDocument();
    expect(screen.queryByTestId("correction-summary")).toBeNull();
  });
});
