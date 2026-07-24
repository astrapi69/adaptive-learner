/**
 * LessonSummary XP-gain tests (#505).
 *
 * Pins the "+N XP" reward surfaced at lesson end. The amount is
 * the parity-tested lesson-XP formula (base 30 + 10/star + 20 for
 * a first-attempt 3-star run, streak 0 here), so a perfect first
 * run shows "+80 XP" and an unscored run shows no pill.
 *
 * The next-step hook is stubbed to nothing-available so the
 * summary's smart cards stay out of the way; an empty userId keeps
 * the SRS correction block + the streak read out of the picture
 * (streak defaults to 0, no multiplier).
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The "+N XP" gain now counts up via shared/AnimatedCounter; under
// reduced motion it renders the final value synchronously, which is
// exactly what these XP-math assertions want.
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

import LessonSummary from "./LessonSummary";
import type { ContentLesson, LessonProgress } from "../../../storage/types";

const LESSON: ContentLesson = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [],
};

function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: "p1",
    user_id: "",
    source: "bundled:x",
    set_id: "set1",
    lesson_filename: "01-greetings.json",
    status: "completed",
    step_results: { s0: { attempts: 1 } },
    score_correct: 10,
    score_total: 10,
    time_spent_seconds: 120,
    started_at: "2026-06-14T10:00:00Z",
    updated_at: "2026-06-14T10:02:00Z",
    completed_at: "2026-06-14T10:02:00Z",
    paused_at: null,
    abandoned_at: null,
    ...overrides,
  } as unknown as LessonProgress;
}

function renderSummary(progress: LessonProgress | null) {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={progress}
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

describe("LessonSummary XP gain", () => {
  it("shows +80 XP for a perfect first-attempt run", () => {
    renderSummary(makeProgress());
    expect(screen.getByTestId("lesson-summary-xp")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-summary-xp-gain").textContent).toBe(
      "+80 XP",
    );
  });

  it("scales the gain down with a lower score", () => {
    // 5/10 = 50% -> 1 star -> base 30 + 10 = 40 XP.
    renderSummary(makeProgress({ score_correct: 5, score_total: 10 }));
    expect(screen.getByTestId("lesson-summary-xp-gain").textContent).toBe(
      "+40 XP",
    );
  });

  it("renders no XP pill for an unscored run", () => {
    const { container } = renderSummary(
      makeProgress({ score_correct: 0, score_total: 0 }),
    );
    expect(
      container.querySelector('[data-testid="lesson-summary-xp"]'),
    ).toBeNull();
  });
});
