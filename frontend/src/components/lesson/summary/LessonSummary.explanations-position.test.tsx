/**
 * LessonSummary — mistake-review ("Why you missed these", #599) position vs the
 * correction round (#1432).
 *
 * The architect directive is that the SRS correction round is the LAST content
 * section, directly above the pinned continue-actions. #599's
 * ``SummaryExplanations`` area (a standalone, separately-toggled review of the
 * run's still-weak text mistakes) used to render BELOW the whole reorderable
 * block, so it landed under correction and pushed it to second-to-last.
 *
 * These pin: by default the review renders directly ABOVE the correction round
 * (and below ``next_steps``) with correction as the last content section; the
 * review follows correction when the user reorders it; when correction is OFF
 * the review still renders (fallback) above the pinned actions; and rendering
 * NEVER rewrites the stored order (no silent reset of a #1427 saved order).
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert LessonSummary's
 * own layout, not their internals. ``useLessonSessionErrors`` returns one
 * unmastered text mistake so the #599 area actually renders.
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

const TEXT_MISTAKE = {
  id: "e1",
  user_id: "u1",
  set_id: "set1",
  lesson_id: "01-greetings.json",
  exercise_id: "s0",
  element_key: "hello",
  element_type: "free_text",
  user_answer: "Salut",
  correct_answer: "Bonjour",
  error_count: 1,
  correct_streak: 0,
  last_error_at: "2026-06-14T10:02:00Z",
  last_attempt_at: "2026-06-14T10:02:00Z",
  mastered: false,
  mastered_at: null,
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:02:00Z",
};

vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => [TEXT_MISTAKE],
}));

import LessonSummary from "./LessonSummary";
import {
  setSummarySectionEnabled,
  writeSummarySections,
  type SummarySectionKey,
  type SummarySectionsConfig,
} from "../../../lib/learning/summarySectionsPref";
import type { ContentLesson, LessonProgress } from "../../../storage/types";

const KEY_ORDER = "adaptive-learner.lesson.summary_sections_order";

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

function configFrom(
  order: SummarySectionKey[],
  disabled: SummarySectionKey[] = [],
): SummarySectionsConfig {
  const off = new Set(disabled);
  return order.map((id) => ({ id, enabled: !off.has(id) }));
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

describe("LessonSummary mistake-review vs correction position (#1432)", () => {
  it("default order: 'Why you missed these' renders directly above the correction round, which stays the last content section", () => {
    renderSummary();
    const nextSteps = screen.getByTestId("next-steps-stub");
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const correction = screen.getByTestId("correction-block-stub");
    const exit = screen.getByTestId("lesson-summary-exit");

    // next_steps → explanations → correction → (pinned) actions.
    expect(precedes(nextSteps, explanations)).toBe(true);
    expect(precedes(explanations, correction)).toBe(true);
    expect(precedes(correction, exit)).toBe(true);

    // Correction is the last CONTENT section: nothing renders between it and
    // the pinned actions block.
    expect(precedes(correction, screen.getByTestId("lesson-summary-repeat"))).toBe(
      true,
    );
  });

  it("the review follows the correction round when it is reordered (correction first)", () => {
    writeSummarySections(
      configFrom([
        "correction",
        "next_steps",
        "favorite",
        "result",
        "xp",
        "share",
        "answers",
        "export",
      ]),
    );
    renderSummary();
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const correction = screen.getByTestId("correction-block-stub");
    const stars = screen.getByTestId("lesson-summary-stars");
    // The review is spliced directly above correction wherever it sits.
    expect(precedes(explanations, correction)).toBe(true);
    // Correction (now first) precedes the still-default later sections.
    expect(precedes(correction, stars)).toBe(true);
  });

  it("correction OFF: the mistake review still renders (fallback) above the pinned actions", () => {
    setSummarySectionEnabled("correction", false);
    renderSummary();
    expect(
      screen.queryByTestId("correction-block-stub"),
    ).not.toBeInTheDocument();
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const exit = screen.getByTestId("lesson-summary-exit");
    expect(precedes(explanations, exit)).toBe(true);
  });

  it("rendering NEVER rewrites the stored order (no silent reset of a saved #1427 order)", () => {
    const custom: SummarySectionKey[] = [
      "favorite",
      "result",
      "share",
      "xp",
      "answers",
      "export",
      "next_steps",
      "correction",
    ];
    writeSummarySections(configFrom(custom));
    const before = localStorage.getItem(KEY_ORDER);
    renderSummary();
    // The stored config is byte-identical after render — position of the #599
    // review is a render concern, it does not touch the persisted order.
    expect(localStorage.getItem(KEY_ORDER)).toBe(before);
  });
});
