/**
 * LessonSummary configurable + reorderable sections (#1426, generalises
 * #1411 / #1376).
 *
 * Every non-essential section of the completion panel is individually
 * toggleable AND reorderable via the ``summarySectionsPref`` ordered config.
 * These pin: defaults (all ON, default order), each section disabling exactly
 * itself, the panel following a CUSTOM order, a disabled section keeping its
 * slot (re-enabling brings it back there), the essential navigation surviving
 * EVERY combination (including all-off) and staying pinned last, the migrated
 * #1376 correction choice, and the next-lesson fallback appearing when the
 * next-steps section is off.
 *
 * CorrectionBlock + NextStepSuggestions are stubbed so we assert
 * LessonSummary's own layout, not their internals.
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

vi.mock("../../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: () => [],
}));

import LessonSummary from "./LessonSummary";
import {
  DEFAULT_SUMMARY_SECTION_ORDER,
  SUMMARY_SECTION_KEYS,
  setSummarySectionEnabled,
  writeSummarySections,
  type SummarySectionKey,
  type SummarySectionsConfig,
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

/** Build a full ordered config from an explicit id order (disabled ids OFF). */
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

/** The essential surface that must survive every combination, pinned last. */
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

describe("LessonSummary configurable + reorderable sections (#1426)", () => {
  it("defaults ON — renders every configurable section", () => {
    renderSummary();
    for (const key of SUMMARY_SECTION_KEYS) {
      expect(screen.getByTestId(SECTION_PROBES[key]), key).toBeInTheDocument();
    }
  });

  it("default order renders sections in today's fixed top-to-bottom sequence", () => {
    renderSummary();
    const probes = [...DEFAULT_SUMMARY_SECTION_ORDER].map((key) =>
      screen.getByTestId(SECTION_PROBES[key]),
    );
    for (let i = 0; i < probes.length - 1; i++) {
      expect(
        precedes(probes[i], probes[i + 1]),
        `${DEFAULT_SUMMARY_SECTION_ORDER[i]} before ${DEFAULT_SUMMARY_SECTION_ORDER[i + 1]}`,
      ).toBe(true);
    }
  });

  it.each(SUMMARY_SECTION_KEYS.map((key) => [key] as const))(
    "disabling only %s removes exactly that section",
    (disabledKey) => {
      setSummarySectionEnabled(disabledKey, false);
      renderSummary();
      for (const key of SUMMARY_SECTION_KEYS) {
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
      for (const testid of ESSENTIAL_TESTIDS) {
        expect(screen.getByTestId(testid)).toBeInTheDocument();
      }
    },
  );

  it("renders the sections in a CUSTOM configured order (correction first)", () => {
    // Move correction to the very front, next_steps second.
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
    const correction = screen.getByTestId("correction-block-stub");
    const nextSteps = screen.getByTestId("next-steps-stub");
    const stars = screen.getByTestId("lesson-summary-stars");
    expect(precedes(correction, nextSteps)).toBe(true);
    expect(precedes(nextSteps, stars)).toBe(true);
    // The essential navigation is still pinned AFTER every reordered section.
    const exit = screen.getByTestId("lesson-summary-exit");
    expect(precedes(stars, exit)).toBe(true);
  });

  it("a disabled section keeps its slot: re-enabling brings it back there", () => {
    // Custom order with xp between share and answers; disable it.
    const order: SummarySectionKey[] = [
      "favorite",
      "result",
      "share",
      "xp",
      "answers",
      "export",
      "next_steps",
      "correction",
    ];
    writeSummarySections(configFrom(order, ["xp"]));
    const first = renderSummary();
    expect(screen.queryByTestId("lesson-summary-xp")).not.toBeInTheDocument();
    first.unmount();

    // Re-enable xp at the SAME stored slot (between share and answers).
    writeSummarySections(configFrom(order));
    renderSummary();
    const share = screen.getByTestId("lesson-summary-share");
    const xp = screen.getByTestId("lesson-summary-xp");
    const answers = screen.getByTestId("lesson-summary-breakdown");
    expect(precedes(share, xp)).toBe(true);
    expect(precedes(xp, answers)).toBe(true);
  });

  it("all sections OFF — minimal panel keeps heading + essential navigation", () => {
    writeSummarySections(configFrom([...SUMMARY_SECTION_KEYS], [
      ...SUMMARY_SECTION_KEYS,
    ]));
    renderSummary();

    for (const key of SUMMARY_SECTION_KEYS) {
      expect(
        screen.queryByTestId(SECTION_PROBES[key]),
        key,
      ).not.toBeInTheDocument();
    }
    expect(screen.getByTestId("lesson-summary")).toBeInTheDocument();
    expect(screen.getByText(/Greetings/)).toBeInTheDocument();
    for (const testid of ESSENTIAL_TESTIDS) {
      expect(screen.getByTestId(testid)).toBeInTheDocument();
    }
    // With next-steps off, the plain "Next lesson" fallback appears so
    // forward navigation never disappears.
    expect(screen.getByTestId("lesson-summary-next")).toBeInTheDocument();
  });

  it("the continue-actions stay pinned last, independent of any section config", () => {
    // A wild reorder + several sections off must not move the exits.
    writeSummarySections(
      configFrom(
        [
          "correction",
          "export",
          "answers",
          "next_steps",
          "share",
          "xp",
          "result",
          "favorite",
        ],
        ["result", "xp", "favorite"],
      ),
    );
    renderSummary();
    const section = screen.getByTestId("lesson-summary");
    const exit = screen.getByTestId("lesson-summary-exit");
    const repeat = screen.getByTestId("lesson-summary-repeat");
    // Both exits are in the LAST child block of the panel.
    expect(section.lastElementChild).toContainElement(exit);
    expect(section.lastElementChild).toContainElement(repeat);
    // Everything still-enabled precedes the exits.
    for (const testid of [
      "correction-block-stub",
      "lesson-summary-export",
      "next-steps-stub",
    ]) {
      expect(precedes(screen.getByTestId(testid), exit)).toBe(true);
    }
  });

  it("next-steps ON + smart card available — no duplicate fallback button", () => {
    renderSummary();
    expect(screen.getByTestId("next-steps-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-summary-next")).not.toBeInTheDocument();
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
