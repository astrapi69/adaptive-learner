/**
 * #3575 - the compact lesson summary offers to fix the run's mistakes.
 *
 * Since #3124 the compact default shows only result and XP, so the
 * ``correction`` section is off and a learner with mistakes had nothing
 * that leads to fixing them. A "Fix mistakes (n)" button now sits with the
 * always-rendered actions whenever mistakes of this run are still open; it
 * opens the correction round expanded. After a correction the compact view
 * says how many are corrected. The counts are the ones the correction
 * block already uses (``openFailedExercises`` over the live SRS rows).
 *
 * ``CorrectionBlock`` is stubbed: this file pins the summary's decision,
 * the block's own drill flow has its own tests.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

// The summary's side reads (streak, missions, ...) answer empty: this file
// pins only the fix-mistakes decision, not those surfaces.
vi.mock("../../../storage", () => ({
  getStorage: () =>
    new Proxy(
      {},
      { get: () => new Proxy({}, { get: () => vi.fn(async () => undefined) }) },
    ),
}));

const sessionErrorsMock = vi.fn();
vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => sessionErrorsMock(),
}));

vi.mock("../../exercises", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CorrectionBlock: ({ initiallyExpanded }: { initiallyExpanded?: boolean }) => (
    <div data-testid="lesson-correction-block" data-initially-expanded={String(Boolean(initiallyExpanded))} />
  ),
}));

import LessonSummary from "./LessonSummary";
import type {
  ContentLesson,
  ElementError,
  LessonProgress,
} from "../../../storage/types";

function exerciseStep(id: string) {
  return {
    id,
    type: "exercise",
    title: null,
    body: null,
    exercise: {
      id: `ex-${id}`,
      type: "free_text",
      prompt: "Translate",
      card_ids: [],
      accept: ["hola"],
      distractors: [],
    },
  };
}

const LESSON = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [exerciseStep("s1"), exerciseStep("s2"), exerciseStep("s3")],
} as unknown as ContentLesson;

/** s1 and s2 failed in this run, s3 was right. */
function makeProgress(): LessonProgress {
  return {
    id: "p1",
    user_id: "u1",
    source: "bundled:x",
    set_id: "set1",
    lesson_filename: "01-greetings.json",
    status: "completed",
    lesson_mode: "practice",
    step_results: {
      s1: { correct: 0, total: 1, attempts: 1, user_answer: "ola" },
      s2: { correct: 0, total: 1, attempts: 1, user_answer: "hello" },
      s3: { correct: 1, total: 1, attempts: 1 },
    },
    score_correct: 1,
    score_total: 3,
    time_spent_seconds: 60,
    started_at: "2026-10-06T10:00:00Z",
    updated_at: "2026-10-06T10:01:00Z",
    completed_at: null,
    paused_at: null,
    abandoned_at: null,
  } as unknown as LessonProgress;
}

/** A live SRS row for ``exerciseId``; ``corrected`` = last answer right. */
function row(exerciseId: string, corrected: boolean): ElementError {
  return {
    id: exerciseId,
    user_id: "u1",
    set_id: "set1",
    lesson_id: "01-greetings.json",
    exercise_id: exerciseId,
    element_key: `${exerciseId}-k`,
    element_type: "vocabulary",
    user_answer: "x",
    correct_answer: "hola",
    error_count: 1,
    correct_streak: corrected ? 1 : 0,
    last_error_at: null,
    last_attempt_at: "2026-10-06T10:00:00Z",
    mastered: false,
    mastered_at: null,
    created_at: "2026-10-06T10:00:00Z",
    updated_at: "2026-10-06T10:00:00Z",
  } as ElementError;
}

function renderSummary() {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={makeProgress()}
        lessonMode="practice"
        nextLessonFilename={null}
        userId="u1"
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

describe("compact summary: fix mistakes (#3575)", () => {
  it("offers to fix the open mistakes without changing Settings", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", false), row("ex-s2", false)]);
    renderSummary();
    expect(screen.queryByTestId("lesson-correction-block")).toBeNull();
    expect(screen.getByTestId("lesson-summary-fix-mistakes")).toHaveTextContent("Fix mistakes (2)");
  });

  it("opens the correction round expanded on click and hides the button", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", false), row("ex-s2", false)]);
    renderSummary();
    fireEvent.click(screen.getByTestId("lesson-summary-fix-mistakes"));
    expect(screen.getByTestId("lesson-correction-block")).toHaveAttribute(
      "data-initially-expanded",
      "true",
    );
    expect(screen.queryByTestId("lesson-summary-fix-mistakes")).toBeNull();
  });

  it("counts only the still-open mistakes and says how many are corrected", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", true), row("ex-s2", false)]);
    renderSummary();
    expect(screen.getByTestId("lesson-summary-fix-mistakes")).toHaveTextContent("Fix mistakes (1)");
    expect(screen.getByTestId("lesson-summary-corrected-count")).toHaveTextContent("1 of 2 corrected");
  });

  it("shows no button once every mistake is corrected, only the count", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", true), row("ex-s2", true)]);
    renderSummary();
    expect(screen.queryByTestId("lesson-summary-fix-mistakes")).toBeNull();
    expect(screen.getByTestId("lesson-summary-corrected-count")).toHaveTextContent("2 of 2 corrected");
  });

  it("shows neither when the run had no mistakes", () => {
    sessionErrorsMock.mockReturnValue([]);
    render(
      <MemoryRouter>
        <LessonSummary
          lesson={LESSON}
          progress={{
            ...makeProgress(),
            step_results: {
              s1: { correct: 1, total: 1, attempts: 1 },
              s2: { correct: 1, total: 1, attempts: 1 },
              s3: { correct: 1, total: 1, attempts: 1 },
            },
            score_correct: 3,
          } as unknown as LessonProgress}
          lessonMode="practice"
          nextLessonFilename={null}
          userId="u1"
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
    expect(screen.queryByTestId("lesson-summary-fix-mistakes")).toBeNull();
    expect(screen.queryByTestId("lesson-summary-corrected-count")).toBeNull();
  });
});
