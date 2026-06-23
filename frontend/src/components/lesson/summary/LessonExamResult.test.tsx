/**
 * Tests for LessonExamResult (#1007 Phase 2) — the dedicated end-of-exam
 * result panel: verdict, score, XP + exam-bonus note, and retry.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonExamResult from "./LessonExamResult";

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
