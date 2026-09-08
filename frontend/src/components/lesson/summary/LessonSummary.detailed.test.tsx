/**
 * The "Detailed evaluation" toggle of the lesson-completion summary (#3031).
 *
 * The compact summary deliberately holds three things back: sections the
 * learner switched off in Settings, the collapsed "View all answers" detail,
 * and the mistake explanations (own toggle plus a 5-entry cap). One button
 * lifts all three for the current view WITHOUT touching any stored
 * preference - the detailed view is derived from the run's data on every
 * click, nothing is persisted.
 *
 * These pin: the toggle's presence and its two labels, each of the three
 * things it lifts, the return to the compact view, that the stored section
 * preference is untouched, that the correction round stays collapsed (it is
 * a drill, not a report - #2496), and that the mistake explanations are never
 * rendered twice when the correction section is off.
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert
 * LessonSummary's own layout, not their internals (same shape as
 * LessonSummary.sections.test.tsx).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

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

/** Props the stubbed CorrectionBlock was last rendered with, so the test can
 *  assert what LessonSummary hands it - not merely that it appeared. */
const correctionProps: Record<string, unknown>[] = [];

vi.mock("../../exercises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../exercises")>();
  return {
    ...actual,
    CorrectionBlock: (props: Record<string, unknown>) => {
      correctionProps.push(props);
      return <div data-testid="correction-block-stub" />;
    },
  };
});

vi.mock("./NextStepSuggestions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./NextStepSuggestions")>();
  return {
    ...actual,
    default: ({ enabled = true }: { enabled?: boolean }) =>
      enabled ? <div data-testid="next-steps-stub" /> : null,
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

/** The run's mistakes. Six entries so the 5-entry cap of the compact view is
 *  a visible boundary: the sixth only appears in the detailed view. */
const SESSION_ERRORS = Array.from({ length: 6 }, (_, i) => ({
  id: `e${i}`,
  user_id: "u1",
  set_id: "set1",
  lesson_id: "01-greetings.json",
  exercise_id: "s0",
  element_key: `word${i}`,
  element_type: "vocabulary",
  user_answer: `wrong${i}`,
  correct_answer: `right${i}`,
  error_count: 1,
  correct_streak: 0,
  last_error_at: "2026-08-10T00:00:00Z",
  last_attempt_at: "2026-08-10T00:00:00Z",
  mastered: false,
  mastered_at: null,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
}));

vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => SESSION_ERRORS,
}));

import LessonSummary from "./LessonSummary";
import {
  readSummarySections,
  setSummarySectionEnabled,
} from "../../../lib/learning/summarySectionsPref";
import { setExplanationsEnabled } from "../../../lib/review/reviewPref";
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

function renderSummary(
  overrides: Partial<ComponentProps<typeof LessonSummary>> = {},
) {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={makeProgress()}
        nextLessonFilename="02-numbers.json"
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
        {...overrides}
      />
    </MemoryRouter>,
  );
}

/** Click the detailed-evaluation toggle. */
function toggleDetailed() {
  fireEvent.click(screen.getByTestId("lesson-summary-detailed-toggle"));
}

afterEach(() => {
  correctionProps.length = 0;
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("LessonSummary detailed-evaluation toggle (#3031)", () => {
  it("offers the toggle, compact by default", () => {
    renderSummary();
    const toggle = screen.getByTestId("lesson-summary-detailed-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("lesson-summary")).toHaveAttribute(
      "data-detailed",
      "false",
    );
  });

  it("shows a section the learner switched off in Settings", () => {
    setSummarySectionEnabled("export", false);
    renderSummary();
    expect(screen.queryByTestId("lesson-summary-export")).toBeNull();

    toggleDetailed();
    expect(screen.getByTestId("lesson-summary-export")).toBeInTheDocument();
  });

  it("opens the collapsed answers overview", () => {
    renderSummary();
    const answers = screen.getByTestId("lesson-summary-breakdown");
    expect(answers).not.toHaveAttribute("open");

    toggleDetailed();
    expect(screen.getByTestId("lesson-summary-breakdown")).toHaveAttribute(
      "open",
    );
  });

  it("shows the mistake explanations even with their own toggle off", () => {
    setExplanationsEnabled(false);
    renderSummary();
    expect(screen.queryByTestId("lesson-summary-explanations")).toBeNull();

    toggleDetailed();
    expect(
      screen.getByTestId("lesson-summary-explanations"),
    ).toBeInTheDocument();
  });

  it("lifts the 5-entry cap on the mistake explanations", () => {
    renderSummary();
    expect(screen.queryByTestId("lesson-summary-explain-e5")).toBeNull();

    toggleDetailed();
    for (const err of SESSION_ERRORS) {
      expect(
        screen.getByTestId(`lesson-summary-explain-${err.id}`),
        err.id,
      ).toBeInTheDocument();
    }
  });

  it("returns to the compact view on a second click", () => {
    setSummarySectionEnabled("export", false);
    renderSummary();

    toggleDetailed();
    expect(screen.getByTestId("lesson-summary-export")).toBeInTheDocument();

    toggleDetailed();
    expect(screen.queryByTestId("lesson-summary-export")).toBeNull();
    expect(screen.getByTestId("lesson-summary-breakdown")).not.toHaveAttribute(
      "open",
    );
    expect(
      screen.getByTestId("lesson-summary-detailed-toggle"),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves the stored section preference untouched", () => {
    setSummarySectionEnabled("export", false);
    const before = readSummarySections();
    renderSummary();

    toggleDetailed();

    expect(readSummarySections()).toEqual(before);
    expect(
      readSummarySections().find((s) => s.id === "export")?.enabled,
    ).toBe(false);
  });

  it("keeps the correction round collapsed - it is a drill, not a report", () => {
    setSummarySectionEnabled("correction", false);
    renderSummary();

    toggleDetailed();

    // The section becomes visible like any other switched-off section...
    expect(screen.getByTestId("correction-block-stub")).toBeInTheDocument();
    // ...but nothing about the detailed view reaches the block itself: it
    // keeps its own collapsed entry (#2496 - auto-expanding pops the mobile
    // keyboard). Asserted on the props it is actually handed, so wiring the
    // detailed flag through in a later change turns this test red.
    expect(correctionProps.length).toBeGreaterThan(0);
    for (const props of correctionProps) {
      expect(Object.keys(props)).not.toContain("detailed");
      expect(Object.keys(props)).not.toContain("open");
      expect(Object.keys(props)).not.toContain("defaultOpen");
    }
  });

  it("renders the mistake explanations exactly once with the correction section off", () => {
    setSummarySectionEnabled("correction", false);
    renderSummary();

    toggleDetailed();

    expect(screen.getAllByTestId("lesson-summary-explanations")).toHaveLength(1);
  });
});
