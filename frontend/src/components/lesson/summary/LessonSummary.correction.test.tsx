/**
 * LessonSummary correction-adjusted score tests (#2479).
 *
 * The main run freezes the score at grading time; the correction round lifts
 * SRS ``ElementError`` rows but not that number, so the summary used to show
 * first-pass stars + "Guter Anfang" on the same screen that reported "Alle
 * Fehler korrigiert". These pin the fix: the two-segment score bar, the
 * corrected legend, and stars + message following the correction-adjusted
 * final state — plus the single-segment fallback when nothing was corrected.
 *
 * ``useLessonSessionErrors`` is mocked to inject the live SRS rows; the
 * next-step hook is stubbed to nothing-available. ``userId`` stays empty so
 * the streak read + correction block stay out of the way — the bar reads the
 * mocked rows regardless.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
});

vi.mock("../../../hooks/learning/useNextStepSuggestions", () => ({
  useNextStepSuggestions: () => ({
    loading: false,
    nextLesson: { available: false, isPaused: false },
    errorReplay: { available: false, errorCount: 0 },
    adaptiveLesson: { available: false, focusTag: null, errorCount: 0 },
    reviewSession: { available: false, dueCount: 0 },
    setComplete: false,
    primaryAction: "next",
  }),
}));

const sessionErrorsMock = vi.fn();
vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => sessionErrorsMock(),
}));

import LessonSummary from "./LessonSummary";
import type {
  ContentLesson,
  ElementError,
  LessonProgress,
} from "../../../storage/types";

const LESSON: ContentLesson = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [],
};

function errRow(partial: Partial<ElementError>): ElementError {
  return {
    id: Math.random().toString(),
    user_id: "u",
    set_id: "set1",
    lesson_id: "01-greetings.json",
    exercise_id: "e",
    element_key: Math.random().toString(),
    element_type: "vocabulary",
    user_answer: "",
    correct_answer: "",
    error_count: 1,
    correct_streak: 0,
    last_error_at: null,
    last_attempt_at: "2026-08-06T00:00:00Z",
    mastered: false,
    mastered_at: null,
    created_at: "2026-08-06T00:00:00Z",
    updated_at: "2026-08-06T00:00:00Z",
    ...partial,
  };
}

function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: "p1",
    user_id: "",
    source: "bundled:x",
    set_id: "set1",
    lesson_filename: "01-greetings.json",
    status: "completed",
    lesson_mode: "practice",
    step_results: { s0: { correct: 10, total: 16, attempts: 2 } },
    score_correct: 10,
    score_total: 16,
    time_spent_seconds: 120,
    started_at: "2026-06-14T10:00:00Z",
    updated_at: "2026-06-14T10:02:00Z",
    completed_at: "2026-06-14T10:02:00Z",
    paused_at: null,
    abandoned_at: null,
    ...overrides,
  } as unknown as LessonProgress;
}

function renderSummary(
  progress: LessonProgress | null,
  lessonMode: "practice" | "exam" = "practice",
) {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={progress}
        lessonMode={lessonMode}
        nextLessonFilename={null}
        userId=""
        setId="set1"
        setTitle="Set One"
        source="bundled:x"
        setSlug="x"
        lessonFilename="01-greetings.json"
        onMarkComplete={vi.fn()}
        onNextLesson={vi.fn()}
        onRepeat={vi.fn()}
        onExit={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("LessonSummary correction-adjusted score (#2479)", () => {
  it("lifts stars, message and score to the final state when all errors are corrected", () => {
    // 10/16 immediate; all 6 wrong elements corrected -> 16/16, 3 stars.
    sessionErrorsMock.mockReturnValue(
      Array.from({ length: 6 }, () =>
        errRow({ error_count: 1, correct_streak: 1 }),
      ),
    );
    renderSummary(makeProgress());

    expect(screen.getByTestId("lesson-summary-score").textContent).toBe(
      "16 / 16",
    );
    expect(screen.getByTestId("lesson-summary-stars")).toHaveAttribute(
      "aria-label",
      "3 of 3 stars",
    );
    expect(screen.getByTestId("lesson-summary-message").textContent).toBe(
      "Perfect score!",
    );
    // Two-segment bar + legend appear; the corrected segment stacks straight
    // after the immediate one (left offset = the first-pass 63%).
    const corrected = screen.getByTestId("lesson-summary-score-fill-corrected");
    expect(corrected).toBeInTheDocument();
    expect(corrected.style.left).toBe("63%");
    const legend = screen.getByTestId("lesson-summary-score-legend");
    expect(legend.textContent).toContain("10 on the first try");
    expect(legend.textContent).toContain("6 after correcting");
    expect(screen.getByTestId("lesson-summary-score-bar")).toHaveAttribute(
      "data-has-corrections",
      "true",
    );
  });

  it("lifts the score part-way for a partial correction", () => {
    // 3 of the 6 wrong elements corrected -> 13/16 = 81% -> 2 stars.
    sessionErrorsMock.mockReturnValue([
      ...Array.from({ length: 3 }, () =>
        errRow({ error_count: 1, correct_streak: 1 }),
      ),
      ...Array.from({ length: 3 }, () =>
        errRow({ error_count: 1, correct_streak: 0 }),
      ),
    ]);
    renderSummary(makeProgress());

    expect(screen.getByTestId("lesson-summary-score").textContent).toBe(
      "13 / 16",
    );
    expect(screen.getByTestId("lesson-summary-stars")).toHaveAttribute(
      "aria-label",
      "2 of 3 stars",
    );
  });

  it("stays single-segment with first-pass stars when nothing was corrected", () => {
    // All 6 still wrong -> 10/16 = 63% -> 1 star -> "Guter Anfang".
    sessionErrorsMock.mockReturnValue(
      Array.from({ length: 6 }, () =>
        errRow({ error_count: 1, correct_streak: 0 }),
      ),
    );
    renderSummary(makeProgress());

    expect(screen.getByTestId("lesson-summary-score").textContent).toBe(
      "10 / 16",
    );
    expect(screen.getByTestId("lesson-summary-stars")).toHaveAttribute(
      "aria-label",
      "1 of 3 stars",
    );
    expect(
      screen.queryByTestId("lesson-summary-score-fill-corrected"),
    ).toBeNull();
    expect(screen.queryByTestId("lesson-summary-score-legend")).toBeNull();
    expect(screen.getByTestId("lesson-summary-score-bar")).toHaveAttribute(
      "data-has-corrections",
      "false",
    );
  });

  it("exam mode stays on the first-pass score (an exam is not corrected)", () => {
    // Even though all 6 are corrected in SRS, exam mode ignores the
    // adjustment: 10/16 = 63% -> 1 star.
    sessionErrorsMock.mockReturnValue(
      Array.from({ length: 6 }, () =>
        errRow({ error_count: 1, correct_streak: 1 }),
      ),
    );
    renderSummary(makeProgress({ lesson_mode: "exam" }), "exam");

    expect(screen.getByTestId("lesson-summary-score").textContent).toBe(
      "10 / 16",
    );
    expect(screen.getByTestId("lesson-summary-stars")).toHaveAttribute(
      "aria-label",
      "1 of 3 stars",
    );
    expect(
      screen.queryByTestId("lesson-summary-score-fill-corrected"),
    ).toBeNull();
  });
});
