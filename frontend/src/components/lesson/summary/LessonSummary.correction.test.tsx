/**
 * LessonSummary correction-round placement + toggle (#1376).
 *
 * The SRS correction round is now optional (default ON) and rendered as the
 * LAST element of the summary — below the "next steps" area — instead of above
 * it. These pin the composition: order, the toggle, and that disabling it does
 * not remove the error-replay entry point (errors stay reachable).
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert LessonSummary's
 * own layout, not their internals.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("./NextStepSuggestions", () => ({
  default: () => <div data-testid="next-steps-stub" />,
}));

vi.mock("../../../hooks/learning/useNextStepSuggestions", () => ({
  useNextStepSuggestions: () => ({
    loading: false,
    nextLesson: { available: false, isPaused: false },
    errorReplay: { available: false, errorCount: 0, correctedCount: 0, allCorrected: false },
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
import {
  readCorrectionRoundEnabled,
  setCorrectionRoundEnabled,
} from "../../../lib/learning/correctionRoundPref";
import type { ContentLesson, LessonProgress } from "../../../storage/types";

const LESSON: ContentLesson = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [],
};

function makeProgress(): LessonProgress {
  return {
    id: "p1",
    user_id: "u1",
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
    completed_at: "2026-06-14T10:02:00Z",
    paused_at: null,
    abandoned_at: null,
  } as unknown as LessonProgress;
}

function renderSummary() {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={makeProgress()}
        nextLessonFilename={null}
        userId="u1"
        setId="set1"
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

/** True when `a` appears before `b` in document order. */
function precedes(a: Element, b: Element): boolean {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("LessonSummary correction-round placement (#1376)", () => {
  it("defaults ON — renders the correction round as the LAST element, after the next-steps area", () => {
    expect(readCorrectionRoundEnabled()).toBe(true);
    renderSummary();

    const nextSteps = screen.getByTestId("next-steps-stub");
    const correction = screen.getByTestId("correction-block-stub");
    const section = screen.getByTestId("lesson-summary");

    // After the "next steps" area…
    expect(precedes(nextSteps, correction)).toBe(true);
    // …and after the secondary next/repeat/exit actions…
    expect(precedes(screen.getByTestId("lesson-summary-exit"), correction)).toBe(
      true,
    );
    // …and it is the very last child of the summary panel.
    expect(section.lastElementChild).toContainElement(correction);
  });

  it("toggle OFF — does not render the correction round", () => {
    setCorrectionRoundEnabled(false);
    renderSummary();
    expect(
      screen.queryByTestId("correction-block-stub"),
    ).not.toBeInTheDocument();
  });

  it("keeps the rest of the panel order unchanged (next-steps → secondary actions)", () => {
    renderSummary();
    const nextSteps = screen.getByTestId("next-steps-stub");
    const exit = screen.getByTestId("lesson-summary-exit");
    expect(precedes(nextSteps, exit)).toBe(true);
  });

  it("OFF still leaves the errors reachable via the next-steps error-replay entry", () => {
    // The correction round is only one entry point; turning it off must not
    // remove the NextStepSuggestions area (which carries the "Fehler
    // wiederholen" card + SRS review link).
    setCorrectionRoundEnabled(false);
    renderSummary();
    expect(screen.getByTestId("next-steps-stub")).toBeInTheDocument();
    expect(
      screen.queryByTestId("correction-block-stub"),
    ).not.toBeInTheDocument();
  });
});
