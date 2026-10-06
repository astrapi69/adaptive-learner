/**
 * #3575 - the lesson summary shows the correction summary once the
 * learner has corrected something, and hands the run's first pass to
 * Retry errors so its end can show the same summary.
 *
 * (Setup shared with LessonSummary.fix-mistakes.test.tsx.) Original note:
 * the compact lesson summary offers to fix the run's mistakes.
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
  CorrectionBlock: ({
    onComplete,
    replayState,
  }: {
    onComplete: (improved: number) => void;
    replayState?: { firstPass?: { mistakes: unknown[] } } | null;
  }) => (
    <div
      data-testid="lesson-correction-block"
      data-first-pass-mistakes={String(replayState?.firstPass?.mistakes.length ?? "none")}
    >
      <button type="button" data-testid="stub-finish-correction" onClick={() => onComplete(1)} />
    </div>
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

function openCorrection() {
  fireEvent.click(screen.getByTestId("lesson-summary-fix-mistakes"));
}

describe("lesson summary: correction summary (#3575)", () => {
  it("shows no correction summary before anything is corrected", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", false), row("ex-s2", false)]);
    renderSummary();
    openCorrection();
    expect(screen.queryByTestId("correction-summary")).toBeNull();
  });

  it("shows the correction summary under the round once it is finished", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", true), row("ex-s2", false)]);
    renderSummary();
    openCorrection();
    fireEvent.click(screen.getByTestId("stub-finish-correction"));
    const panel = screen.getByTestId("correction-summary");
    expect(panel).toHaveTextContent("1 of 2 corrected");
    expect(screen.getByTestId("correction-summary-entry-s1")).toHaveAttribute("data-corrected", "true");
    expect(screen.getByTestId("correction-summary-entry-s2")).toHaveAttribute("data-corrected", "false");
  });

  it("shows the record whenever the correction section is open and something is corrected", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", true), row("ex-s2", false)]);
    renderSummary();
    openCorrection();
    expect(screen.getByTestId("correction-summary")).toBeInTheDocument();
  });

  it("hands the run's first pass to Retry errors", () => {
    sessionErrorsMock.mockReturnValue([row("ex-s1", false), row("ex-s2", false)]);
    renderSummary();
    openCorrection();
    expect(screen.getByTestId("lesson-correction-block")).toHaveAttribute(
      "data-first-pass-mistakes",
      "2",
    );
  });
});
