/**
 * LessonSummary mark-as-complete availability (#1787).
 *
 * An anonymous run (no learner profile → ``userId === ""``) has nowhere to
 * persist a completion: ``useLesson.markCompleted`` no-ops without a user.
 * Pre-fix the button rendered ACTIVE and the click died silently. Per the
 * feature-state policy (#335, visible-but-disabled) the button must stay
 * visible but disabled, with a localized reason the user can actually read
 * (FormHint line + tooltip). With a learner present the button stays active
 * and the hint is absent.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../exercises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../exercises")>();
  return {
    ...actual,
    CorrectionBlock: () => <div data-testid="correction-block-stub" />,
  };
});

vi.mock("./NextStepSuggestions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./NextStepSuggestions")>();
  return {
    ...actual,
    default: () => <div data-testid="next-steps-stub" />,
  };
});

vi.mock("../../../hooks/learning/useNextStepSuggestions", () => ({
  useNextStepSuggestions: () => ({
    loading: false,
    nextLesson: { available: true, isPaused: false },
    errorReplay: {
      available: false,
      errorCount: 0,
      correctedCount: 0,
      allCorrected: false,
    },
    adaptiveLesson: { available: false, focusTag: null, errorCount: 0 },
    reviewSession: { available: false, dueCount: 0 },
    setComplete: false,
    primaryAction: "next",
  }),
}));

vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => [],
}));

import LessonSummary from "./LessonSummary";
import type { ContentLesson, LessonProgress } from "../../../storage/types";

const LESSON: ContentLesson = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [
    {
      id: "s0",
      type: "exercise",
      title: "Type the greeting",
      exercise: {
        id: "s0",
        type: "free_text",
        prompt: "How do you say hello?",
        card_ids: [],
        accept: ["Bonjour"],
        distractors: [],
      },
    },
  ],
} as unknown as ContentLesson;

function makeProgress(userId: string): LessonProgress | null {
  if (!userId) return null;
  return {
    id: "p1",
    user_id: userId,
    source: "bundled:x",
    set_id: "set1",
    lesson_filename: "01-greetings.json",
    status: "in_progress",
    step_results: { s0: { attempts: 1 } },
    score_correct: 7,
    score_total: 10,
    time_spent_seconds: 120,
    started_at: "2026-06-14T10:00:00Z",
    updated_at: "2026-06-14T10:02:00Z",
    completed_at: null,
    paused_at: null,
    abandoned_at: null,
  } as unknown as LessonProgress;
}

function renderSummary(userId: string, onMarkComplete = vi.fn()) {
  render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={makeProgress(userId)}
        nextLessonFilename={null}
        userId={userId}
        setId="set1"
        setTitle="Set One"
        source="bundled:x"
        setSlug="x"
        lessonFilename="01-greetings.json"
        onMarkComplete={onMarkComplete}
        onNextLesson={vi.fn()}
        onRepeat={vi.fn()}
        onExit={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onMarkComplete;
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("LessonSummary: mark-complete needs a learner profile (#1787)", () => {
  it("anonymous run — button disabled, reason hint visible, click no-ops", () => {
    const onMarkComplete = renderSummary("");
    const button = screen.getByTestId("lesson-summary-mark-complete");
    expect(button).toBeDisabled();
    expect(
      screen.getByTestId("lesson-summary-mark-complete-hint"),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(onMarkComplete).not.toHaveBeenCalled();
  });

  it("learner present — button enabled, no hint, click fires", () => {
    const onMarkComplete = renderSummary("u1");
    const button = screen.getByTestId("lesson-summary-mark-complete");
    expect(button).toBeEnabled();
    expect(
      screen.queryByTestId("lesson-summary-mark-complete-hint"),
    ).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onMarkComplete).toHaveBeenCalledTimes(1);
  });
});
