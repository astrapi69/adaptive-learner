/**
 * #3575 - in the detailed view "Why you missed these" marks each mistake
 * as corrected or still open. A corrected exercise no longer has a wrong
 * last attempt, so it used to drop out of the list silently; with the
 * correction summary it stays, marked corrected, with the first answer
 * against the correct one.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryExplanations } from "./LessonSummarySections";
import type { CorrectionSummary } from "../../../lib/lesson/correction/correction-summary";
import type { ContentLessonExercise, ElementError } from "../../../storage/types";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function openError(): ElementError {
  return {
    id: "e-open",
    user_id: "u1",
    set_id: "es-a1",
    lesson_id: "lesson-1",
    exercise_id: "ex-open",
    element_key: "adios",
    element_type: "vocabulary",
    user_answer: "adio",
    correct_answer: "adiós",
    error_count: 1,
    correct_streak: 0,
    last_error_at: "2026-08-10T00:00:00Z",
    last_attempt_at: "2026-08-10T00:00:00Z",
    mastered: false,
    mastered_at: null,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
  };
}

function summaryEntry(stepId: string, corrected: boolean) {
  return {
    exercise: { id: `ex-${stepId}` } as ContentLessonExercise,
    stepId,
    title: `Translate ${stepId}`,
    question: `Translate ${stepId}`,
    firstAnswer: "ola",
    correctAnswer: "hola",
    corrected,
    explanation: null,
  };
}

const CORRECTION: CorrectionSummary = {
  entries: [summaryEntry("fixed", true), summaryEntry("open", false)],
  correctedCount: 1,
  total: 2,
  firstTry: { correct: 1, total: 3 },
};

describe("SummaryExplanations correction marks (#3575)", () => {
  it("marks a still-wrong entry as still open", () => {
    render(
      <SummaryExplanations sessionErrors={[openError()]} detailed correction={CORRECTION} t={t} />,
    );
    const mark = screen.getByTestId("lesson-summary-explain-status-e-open");
    expect(mark).toHaveAttribute("data-corrected", "false");
    expect(mark).toHaveTextContent("Still open");
  });

  it("keeps a corrected exercise in the list, marked, with its first answer", () => {
    render(
      <SummaryExplanations sessionErrors={[openError()]} detailed correction={CORRECTION} t={t} />,
    );
    const row = screen.getByTestId("lesson-summary-explain-corrected-fixed");
    expect(row).toHaveTextContent("Corrected");
    expect(row).toHaveTextContent("Translate fixed");
    expect(row).toHaveTextContent("ola");
    expect(row).toHaveTextContent("hola");
    expect(screen.queryByTestId("lesson-summary-explain-corrected-open")).toBeNull();
  });

  it("still renders when every mistake is corrected", () => {
    render(<SummaryExplanations sessionErrors={[]} detailed correction={CORRECTION} t={t} />);
    expect(screen.getByTestId("lesson-summary-explanations")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-summary-explain-corrected-fixed")).toBeInTheDocument();
  });

  it("adds no marks without correction data", () => {
    render(<SummaryExplanations sessionErrors={[openError()]} detailed t={t} />);
    expect(screen.getByTestId("lesson-summary-explain-e-open")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-summary-explain-status-e-open")).toBeNull();
  });
});
