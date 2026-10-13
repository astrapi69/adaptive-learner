/**
 * Tests for LessonExamResult (#1007 Phase 2) — the dedicated end-of-exam
 * result panel: verdict, score, XP + exam-bonus note, and retry.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonExamResult from "./LessonExamResult";
import { resolveAuthorEvaluation } from "../../../lib/lesson/summary/author-evaluation";

const BASE = {
  examPass: true,
  examThreshold: 60,
  correct: 9,
  total: 10,
  scorePct: 90,
  minutes: 4,
  xpGain: 120,
  bonusPct: 50,
  onRetry: () => {},
};

describe("LessonExamResult", () => {
  it("shows the passed verdict + score", () => {
    render(<LessonExamResult {...BASE} />);
    const panel = screen.getByTestId("lesson-exam-result");
    expect(panel).toHaveAttribute("data-passed", "true");
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent(
      "Passed",
    );
    expect(screen.getByTestId("lesson-exam-result-score")).toHaveTextContent(
      "9 / 10 (90%)",
    );
  });

  it("shows the failed verdict", () => {
    render(<LessonExamResult {...BASE} examPass={false} correct={3} scorePct={30} />);
    expect(screen.getByTestId("lesson-exam-result")).toHaveAttribute(
      "data-passed",
      "false",
    );
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent(
      "Not passed",
    );
  });

  it("shows the XP with the exam-bonus note when bonusPct > 0", () => {
    render(<LessonExamResult {...BASE} />);
    const xp = screen.getByTestId("lesson-exam-result-xp");
    expect(xp).toHaveTextContent("+120");
    expect(xp).toHaveTextContent("50% exam bonus");
  });

  it("omits the bonus note when bonusPct is 0", () => {
    render(<LessonExamResult {...BASE} bonusPct={0} />);
    expect(screen.getByTestId("lesson-exam-result-xp")).not.toHaveTextContent(
      "exam bonus",
    );
  });

  it("fires onRetry from the retry button", () => {
    const onRetry = vi.fn();
    render(<LessonExamResult {...BASE} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId("lesson-exam-result-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("LessonExamResult with the set's evaluation block (#3736)", () => {
  const author = (block: Parameters<typeof resolveAuthorEvaluation>[0], correct: number, total = 10) =>
    resolveAuthorEvaluation(block, correct, total);

  it("without a block keeps the learner verdict and names no source", () => {
    render(<LessonExamResult {...BASE} authorEvaluation={null} />);
    expect(screen.getByTestId("lesson-exam-result")).toHaveAttribute("data-evaluation-source", "learner");
    expect(screen.queryByTestId("lesson-exam-result-source")).toBeNull();
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("(pass ≥ 60%)");
  });

  it("pass_fail: the author's mark decides, is labelled, and the title replaces the heading", () => {
    render(
      <LessonExamResult
        {...BASE}
        examThreshold={80}
        correct={7}
        scorePct={70}
        examPass={true}
        authorEvaluation={author({ scheme: "pass_fail", pass_percent: 60, title: "Pilotprüfung" }, 7)}
      />,
    );
    const panel = screen.getByTestId("lesson-exam-result");
    expect(panel).toHaveAttribute("data-evaluation-source", "author");
    expect(panel).toHaveAttribute("data-passed", "true");
    expect(screen.getByRole("heading")).toHaveTextContent("Pilotprüfung");
    const verdict = screen.getByTestId("lesson-exam-result-verdict");
    expect(verdict).toHaveTextContent("Passed");
    expect(verdict).toHaveTextContent("(pass ≥ 60%)");
    expect(verdict).not.toHaveTextContent("80%");
    expect(screen.getByTestId("lesson-exam-result-source")).toHaveTextContent(
      "Evaluated by this set's own rules, not your own pass threshold",
    );
  });

  it("pass_fail below the mark is not passed", () => {
    render(
      <LessonExamResult
        {...BASE}
        examPass={false}
        correct={5}
        authorEvaluation={author({ scheme: "pass_fail", pass_percent: 60 }, 5)}
      />,
    );
    expect(screen.getByTestId("lesson-exam-result")).toHaveAttribute("data-passed", "false");
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("Not passed");
    expect(screen.getByRole("heading")).toHaveTextContent("Exam result");
  });

  const GRADES = {
    scheme: "grades" as const,
    pass_percent: 60,
    grades: [
      { min_percent: 60, label: "D" },
      { min_percent: 86, label: "B", label_native: "gut" },
    ],
  };

  it("grades: shows the grade label with its native label, and the pass line", () => {
    render(<LessonExamResult {...BASE} correct={69} total={80} authorEvaluation={author(GRADES, 69, 80)} />);
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("Grade: B (gut)");
    expect(screen.getByTestId("lesson-exam-result-pass")).toHaveTextContent("Passed");
  });

  it("grades: below the lowest row reaches no grade", () => {
    render(<LessonExamResult {...BASE} examPass={false} correct={5} authorEvaluation={author(GRADES, 5)} />);
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("No grade reached");
    expect(screen.getByTestId("lesson-exam-result-pass")).toHaveTextContent("Not passed");
  });

  it("percent: shows the percent and the advisory mark", () => {
    render(
      <LessonExamResult {...BASE} correct={2} total={3} authorEvaluation={author({ scheme: "percent", pass_percent: 70 }, 2, 3)} />,
    );
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("66.7% correct");
    expect(screen.getByTestId("lesson-exam-result-advisory")).toHaveTextContent(
      "Recommended mark of 70% not reached",
    );
    expect(screen.getByTestId("lesson-exam-result")).not.toHaveAttribute("data-passed");
  });

  it("percent without a mark shows no advisory line", () => {
    render(<LessonExamResult {...BASE} authorEvaluation={author({ scheme: "percent" }, 9)} />);
    expect(screen.getByTestId("lesson-exam-result-verdict")).toHaveTextContent("90% correct");
    expect(screen.queryByTestId("lesson-exam-result-advisory")).toBeNull();
  });
});
