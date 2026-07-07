/**
 * LessonSummary configurable sections (#1411, generalises #1376).
 *
 * Every non-essential section of the completion panel is individually
 * toggleable via the ``summarySectionsPref`` settings object. These pin:
 * defaults (all ON), each section disabling exactly itself, the essential
 * navigation surviving EVERY combination (including all-off), the migrated
 * #1376 correction choice, the stable order, and the next-lesson fallback
 * appearing when the next-steps section is off.
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert
 * LessonSummary's own layout, not their internals.
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

vi.mock("./NextStepSuggestions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./NextStepSuggestions")>();
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

vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => [],
}));

import LessonSummary from "./LessonSummary";
import {
  SUMMARY_SECTION_KEYS,
  defaultSummarySections,
  setSummarySectionEnabled,
  writeSummarySections,
  type SummarySectionKey,
} from "../../../lib/learning/summarySectionsPref";
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

function renderSummary() {
  return render(
    <MemoryRouter>
      <LessonSummary
        lesson={LESSON}
        progress={makeProgress()}
        nextLessonFilename="02-numbers.json"
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

/** The DOM probe for each configurable section (present ⇔ enabled, given
 *  the fixture data above). ``xp`` is exercised via a zero-XP-proof gate:
 *  the fixture earns XP (7/10 non-perfect first attempt → base+star XP). */
const SECTION_PROBES: Record<SummarySectionKey, string> = {
  result: "lesson-summary-stars",
  xp: "lesson-summary-xp",
  favorite: "lesson-summary-favorite",
  share: "lesson-summary-share",
  answers: "lesson-summary-breakdown",
  export: "lesson-summary-export",
  next_steps: "next-steps-stub",
  correction: "correction-block-stub",
};

/** The essential surface that must survive every combination. */
const ESSENTIAL_TESTIDS = [
  "lesson-summary-repeat",
  "lesson-summary-exit",
  "lesson-summary-mark-complete",
];

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

describe("LessonSummary configurable sections (#1411)", () => {
  it("defaults ON — renders every configurable section", () => {
    renderSummary();
    for (const key of SUMMARY_SECTION_KEYS) {
      expect(screen.getByTestId(SECTION_PROBES[key]), key).toBeInTheDocument();
    }
  });

  it.each(SUMMARY_SECTION_KEYS.map((key) => [key] as const))(
    "disabling only %s removes exactly that section",
    (disabledKey) => {
      setSummarySectionEnabled(disabledKey, false);
      renderSummary();
      for (const key of SUMMARY_SECTION_KEYS) {
        // The fixture is a scored run with a next lesson, so with the smart
        // next-lesson card available the fallback assertion below covers
        // navigation; every section probe is independent of the others.
        if (key === disabledKey) {
          expect(
            screen.queryByTestId(SECTION_PROBES[key]),
            `${key} should be hidden`,
          ).not.toBeInTheDocument();
        } else {
          expect(
            screen.getByTestId(SECTION_PROBES[key]),
            `${key} should stay visible`,
          ).toBeInTheDocument();
        }
      }
      // The essential navigation is untouched by any single toggle.
      for (const testid of ESSENTIAL_TESTIDS) {
        expect(screen.getByTestId(testid)).toBeInTheDocument();
      }
    },
  );

  it("all sections OFF — minimal panel keeps heading + essential navigation", () => {
    const allOff = defaultSummarySections();
    for (const key of SUMMARY_SECTION_KEYS) allOff[key] = false;
    writeSummarySections(allOff);
    renderSummary();

    for (const key of SUMMARY_SECTION_KEYS) {
      expect(
        screen.queryByTestId(SECTION_PROBES[key]),
        key,
      ).not.toBeInTheDocument();
    }
    // The panel identity + the exits stay.
    expect(screen.getByTestId("lesson-summary")).toBeInTheDocument();
    expect(screen.getByText(/Greetings/)).toBeInTheDocument();
    for (const testid of ESSENTIAL_TESTIDS) {
      expect(screen.getByTestId(testid)).toBeInTheDocument();
    }
    // With next-steps off, the plain "Next lesson" fallback appears so
    // forward navigation never disappears.
    expect(screen.getByTestId("lesson-summary-next")).toBeInTheDocument();
  });

  it("next-steps ON + smart card available — no duplicate fallback button", () => {
    renderSummary();
    expect(screen.getByTestId("next-steps-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-summary-next")).not.toBeInTheDocument();
  });

  it("keeps the panel order stable: result → next-steps → secondary actions → correction last", () => {
    renderSummary();
    const stars = screen.getByTestId("lesson-summary-stars");
    const nextSteps = screen.getByTestId("next-steps-stub");
    const exit = screen.getByTestId("lesson-summary-exit");
    const correction = screen.getByTestId("correction-block-stub");
    const section = screen.getByTestId("lesson-summary");

    expect(precedes(stars, nextSteps)).toBe(true);
    expect(precedes(nextSteps, exit)).toBe(true);
    expect(precedes(exit, correction)).toBe(true);
    expect(section.lastElementChild).toContainElement(correction);
  });

  it("order stays stable when middle sections are disabled", () => {
    setSummarySectionEnabled("xp", false);
    setSummarySectionEnabled("share", false);
    renderSummary();
    const stars = screen.getByTestId("lesson-summary-stars");
    const answers = screen.getByTestId("lesson-summary-breakdown");
    const correction = screen.getByTestId("correction-block-stub");
    expect(precedes(stars, answers)).toBe(true);
    expect(precedes(answers, correction)).toBe(true);
  });

  it("honours the migrated #1376 correction-round OFF choice (no silent reset)", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    renderSummary();
    expect(
      screen.queryByTestId("correction-block-stub"),
    ).not.toBeInTheDocument();
    // Everything else keeps its default.
    expect(screen.getByTestId("lesson-summary-stars")).toBeInTheDocument();
    expect(screen.getByTestId("next-steps-stub")).toBeInTheDocument();
  });

  it("correction OFF still leaves the errors reachable via the next-steps area", () => {
    setSummarySectionEnabled("correction", false);
    renderSummary();
    expect(screen.getByTestId("next-steps-stub")).toBeInTheDocument();
    expect(
      screen.queryByTestId("correction-block-stub"),
    ).not.toBeInTheDocument();
  });
});
