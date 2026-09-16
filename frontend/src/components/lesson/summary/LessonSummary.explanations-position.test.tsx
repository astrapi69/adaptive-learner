/**
 * LessonSummary — mistake-review ("Why you missed these", #599) position vs the
 * correction round (#1432; default order revised #2570; a section of its own
 * since #3124).
 *
 * #599's ``SummaryExplanations`` area (the review of the run's still-weak
 * text mistakes, master-switched by its own Settings toggle) used to be
 * spliced in above wherever ``correction`` rendered. #3124 made it the
 * ``explanations`` entry of the summary-sections config so the compact
 * default can hold it back: it now renders in its own configured slot. The
 * #1432 adjacency survives as the DEFAULT order (explanations directly above
 * correction, which precedes next_steps, the last content section) and as
 * the migration rule for pre-#3124 stored configs (inserted right before
 * the stored correction entry). A learner who reorders the two apart gets
 * exactly what they configured.
 *
 * These pin: with every section on, the review renders directly ABOVE the
 * correction round (and above ``next_steps``); a stored pre-#3124 config
 * keeps the review above correction after migration; the review renders in
 * ITS OWN slot when reordered; when correction is OFF the review still
 * renders (its own flag decides); and rendering NEVER rewrites the stored
 * order (no silent reset of a #1427 saved order).
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert LessonSummary's
 * own layout, not their internals. ``useLessonSessionErrors`` returns one
 * unmastered text mistake so the #599 area actually renders.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  DEFAULT_SUMMARY_SECTION_ORDER,
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

/** Every section ON, in the default order. */
function allOn(): SummarySectionsConfig {
  return configFrom([...DEFAULT_SUMMARY_SECTION_ORDER]);
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
  it("default order: 'Why you missed these' renders directly above the correction round, which now precedes next_steps as the last content section", () => {
    writeSummarySections(allOn());
    renderSummary();
    const nextSteps = screen.getByTestId("next-steps-stub");
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const correction = screen.getByTestId("correction-block-stub");
    const exit = screen.getByTestId("lesson-summary-exit");

    // explanations → correction → next_steps → (pinned) actions (#2570).
    expect(precedes(explanations, correction)).toBe(true);
    expect(precedes(correction, nextSteps)).toBe(true);
    expect(precedes(nextSteps, exit)).toBe(true);

    // next_steps is the last CONTENT section: nothing renders between it and
    // the pinned actions block.
    expect(precedes(nextSteps, screen.getByTestId("lesson-summary-repeat"))).toBe(
      true,
    );
  });

  it("a pre-#3124 stored config keeps the review directly above the reordered correction round", () => {
    // The eight-entry shape stored before #3124, correction moved first.
    localStorage.setItem(
      KEY_ORDER,
      JSON.stringify(
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
      ),
    );
    renderSummary();
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const correction = screen.getByTestId("correction-block-stub");
    const stars = screen.getByTestId("lesson-summary-stars");
    // Migration slots the review directly above the stored correction entry.
    expect(precedes(explanations, correction)).toBe(true);
    // Correction (first) precedes the later sections.
    expect(precedes(correction, stars)).toBe(true);
  });

  it("the review renders in its own slot when reordered away from the correction round (#3124)", () => {
    writeSummarySections(
      configFrom([
        "explanations",
        "favorite",
        "result",
        "xp",
        "share",
        "answers",
        "export",
        "correction",
        "next_steps",
      ]),
    );
    renderSummary();
    const explanations = screen.getByTestId("lesson-summary-explanations");
    const stars = screen.getByTestId("lesson-summary-stars");
    const correction = screen.getByTestId("correction-block-stub");
    expect(precedes(explanations, stars)).toBe(true);
    expect(precedes(stars, correction)).toBe(true);
  });

  it("correction OFF: the mistake review still renders above the pinned actions", () => {
    writeSummarySections(allOn());
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
      "explanations",
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
