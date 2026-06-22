/**
 * Tests for the Lesson viewer page
 * (Phase 44 / EXP-002 / 3B — F-102 + F-103).
 *
 * Pins each load state (loading / not-cached / ready /
 * summary) renders the right testid + key affordances. The
 * exercise placeholder shows when the page hits a step type
 * commits 4-6 will fill in.
 */

import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useLessonMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("../../hooks/lesson/useLesson", () => ({
  useLesson: () => useLessonMock(),
}));

// Phase 46A — LessonPage now fetches the set's lesson list
// via getStorage().contentLoader.listLessons to compute the
// "Next lesson" button. Tests stub it to a single-lesson set
// by default; per-test overrides set a multi-lesson list when
// they want to assert the Next button surface.
vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: vi.fn(),
      downloadSet: vi.fn(),
      listLessons: listLessonsMock,
      getLesson: vi.fn(),
    },
  }),
}));

import LessonPage from "./Lesson";
import type { ContentLessonExercise } from "../../storage/types";

const LESSON = {
  id: "01-greetings",
  title: "Greetings",
  description: "Basic French greetings.",
  estimated_minutes: 10,
  cards: [],
  steps: [
    {
      id: "intro",
      type: "theory" as const,
      title: "Intro",
      body: "# Welcome\n\nBasic greetings.",
    },
    {
      id: "ex-1",
      type: "exercise" as const,
      title: "Match the words",
      exercise: {
        id: "ex-1",
        type: "matching" as const,
        prompt: "Match the words.",
        card_ids: [],
        distractors: [],
      },
    },
  ],
};

const PROGRESS = {
  id: "row-1",
  user_id: "user-1",
  source: "astrapi69/adaptive-learner-content",
  set_id: "language-fr-a1",
  lesson_filename: "01-greetings.json",
  status: "in_progress" as const,
  step_results: {},
  score_correct: 0,
  score_total: 0,
  time_spent_seconds: 0,
  started_at: "2026-05-26T00:00:00Z",
  updated_at: "2026-05-26T00:00:00Z",
  completed_at: null,
};

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/lesson/:setSlug/:setId/:filename"
          element={<LessonPage />}
        />
        <Route path="/content" element={<div data-testid="content-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const VALID_PATH =
  "/lesson/astrapi69--adaptive-learner-content/language-fr-a1/01-greetings.json";

beforeEach(() => {
  useLessonMock.mockReset();
  listLessonsMock.mockReset();
  // Default: single-lesson set so the "Next lesson" button
  // hides. Tests that assert the button override per-test.
  listLessonsMock.mockResolvedValue({
    set_id: "language-fr-a1",
    source: "astrapi69/adaptive-learner-content",
    version: "1.0.0",
    lessons: ["01-greetings.json"],
  });
});

describe("LessonPage: load states", () => {
  it("renders loading state", () => {
    useLessonMock.mockReturnValue({
      status: "loading",
      lesson: null,
      progress: null,
      currentStepIndex: 0,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-loading")).toBeInTheDocument();
  });

  it("renders not-cached state with link to /content", () => {
    useLessonMock.mockReturnValue({
      status: "not-cached",
      lesson: null,
      progress: null,
      currentStepIndex: 0,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-not-cached")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-goto-content")).toBeInTheDocument();
  });

  it("renders error state", () => {
    useLessonMock.mockReturnValue({
      status: "error",
      lesson: null,
      progress: null,
      currentStepIndex: 0,
      error: "boom",
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-error")).toBeInTheDocument();
  });
});

describe("LessonPage: ready state rendering", () => {
  function _ready(stepIndex: number, progressOverride = PROGRESS) {
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: progressOverride,
      currentStepIndex: stepIndex,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
  }

  it("renders the theory step with its markdown body", () => {
    _ready(0);
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-page")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-step-intro")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-theory-body")).toBeInTheDocument();
    expect(screen.getByText(/Welcome/)).toBeInTheDocument();
  });

  it("renders the matching exercise on an exercise step (commit 6)", () => {
    // The LESSON fixture's exercise has no pairs, so the
    // matching component's empty-state surfaces. That's
    // enough to pin that the dispatcher routed correctly.
    _ready(1);
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("matching-empty")).toBeInTheDocument();
  });

  function _renderWithStep(exercise: ContentLessonExercise) {
    const lesson = {
      ...LESSON,
      steps: [
        {
          id: exercise.id,
          type: "exercise" as const,
          exercise,
        },
      ],
    };
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson,
      progress: PROGRESS,
      currentStepIndex: 0,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
  }

  it("dispatcher routes picture_choice to the picture component", () => {
    _renderWithStep({
      id: "ex-pic",
      type: "picture_choice",
      prompt: "Pick the cat.",
      card_ids: [],
      images: [
        { src: "a.png", label: "Cat", is_correct: "true" },
        { src: "b.png", label: "Dog" },
      ],
      distractors: [],
    });
    expect(screen.getByTestId("picture-exercise")).toBeInTheDocument();
  });

  it("dispatcher routes free_text to the free-text component (Phase 45)", () => {
    _renderWithStep({
      id: "ex-free",
      type: "free_text",
      prompt: "How do you say 'thanks' in French?",
      card_ids: [],
      accept: ["Merci"],
      distractors: [],
    });
    expect(screen.getByTestId("free-text-exercise")).toBeInTheDocument();
    // Placeholder must NOT also fire — exclusive routing.
    expect(
      screen.queryByTestId("lesson-exercise-placeholder-free_text"),
    ).not.toBeInTheDocument();
  });

  it("dispatcher routes word_tiles to the word-tiles component (Phase 45)", () => {
    _renderWithStep({
      id: "ex-tiles",
      type: "word_tiles",
      prompt: "Arrange the words.",
      card_ids: [],
      tiles: ["Au", "revoir"],
      distractors: [],
    });
    expect(screen.getByTestId("word-tiles-exercise")).toBeInTheDocument();
    expect(
      screen.queryByTestId("lesson-exercise-placeholder-word_tiles"),
    ).not.toBeInTheDocument();
  });

  it("renders the coming-soon placeholder for unknown future types", () => {
    // Defensive regression-pin: if a future schema_version
    // ships a new ExerciseType and a lesson lands in the
    // cache before its renderer exists, the placeholder
    // must fire so the user can skip the step. v1.35.0
    // shipped cloze (Phase 52D), so we simulate a still-
    // future "ordering" type by casting the runtime string;
    // TypeScript's compile-time union doesn't include it.
    _renderWithStep({
      id: "ex-future",
      type: "ordering" as unknown as ContentLessonExercise["type"],
      prompt: "Put these words in order.",
      card_ids: [],
      distractors: [],
    });
    expect(
      screen.getByTestId("lesson-exercise-placeholder-ordering"),
    ).toBeInTheDocument();
  });

  it("records a step result when the matching exercise completes", async () => {
    const recordStepResult = vi.fn().mockResolvedValue(undefined);
    const lessonWithPairs = {
      ...LESSON,
      steps: [
        LESSON.steps[0],
        {
          ...LESSON.steps[1],
          exercise: {
            ...LESSON.steps[1].exercise!,
            pairs: [{ left: "A", right: "1" }],
          },
        },
      ],
    };
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: lessonWithPairs,
      progress: PROGRESS,
      currentStepIndex: 1,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult,
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    // BUG P1 — the exercise no longer carries its own submit
    // button in the Lesson (controlled) flow; the shared
    // "Prüfen" button drives evaluation. It is disabled until
    // the answer is checkable, then grades on click.
    expect(screen.queryByTestId("matching-submit")).toBeNull();
    const checkBtn = screen.getByTestId("lesson-check");
    expect(checkBtn).toBeDisabled();
    fireEvent.click(screen.getByTestId("matching-left-0"));
    fireEvent.click(screen.getByTestId("matching-right-0"));
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    fireEvent.click(checkBtn);
    await waitFor(() => {
      // #167 bug 1 — recordStepResult now carries a readable
      // user_answer for matching: the learner's pairings as
      // "left -> right" (reconstructed from the raw answer).
      expect(recordStepResult).toHaveBeenCalledWith({
        step_id: "ex-1",
        correct: 1,
        total: 1,
        user_answer: "A -> 1",
        // BUG P1 / Problem 2 — the raw answer is persisted
        // so a revisit can re-render the locked visual.
        raw_answer: { kind: "matching", matches: [[0, 0]] },
        // #594 Hint Economy — no hint revealed in this run.
        hint_used: false,
      });
    });
    // After grading, the button advances (Problem 1 phase 2).
    await waitFor(() =>
      expect(screen.getByTestId("lesson-next")).toBeInTheDocument(),
    );
  });

  it("revisiting a completed exercise step renders it locked + Weiter (Problem 2)", () => {
    const lessonWithPairs = {
      ...LESSON,
      steps: [
        LESSON.steps[0],
        {
          ...LESSON.steps[1],
          exercise: {
            ...LESSON.steps[1].exercise!,
            pairs: [
              { left: "A", right: "1" },
              { left: "B", right: "2" },
            ],
          },
        },
      ],
    };
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: lessonWithPairs,
      progress: {
        ...PROGRESS,
        step_results: {
          "ex-1": {
            correct: 2,
            total: 2,
            attempts: 1,
            completed_at: "2026-05-26T00:00:00Z",
            raw_answer: {
              kind: "matching",
              matches: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        },
      },
      currentStepIndex: 1,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    // The completed step renders its locked result, not a
    // fresh, re-answerable exercise.
    expect(screen.getByTestId("matching-result")).toHaveAttribute(
      "data-result",
      "correct",
    );
    // The button skips the "Check" phase and advances directly.
    expect(screen.queryByTestId("lesson-check")).toBeNull();
    expect(screen.getByTestId("lesson-next")).toBeInTheDocument();
  });

  it("legacy completed step (no raw_answer) shows the fallback panel", () => {
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: {
        ...PROGRESS,
        step_results: {
          "ex-1": {
            correct: 1,
            total: 1,
            attempts: 1,
            completed_at: "2026-05-26T00:00:00Z",
          },
        },
      },
      currentStepIndex: 1,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-reviewed-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-check")).toBeNull();
    expect(screen.getByTestId("lesson-next")).toBeInTheDocument();
  });

  it("renders the summary view at index past last step", () => {
    _ready(2, {
      ...PROGRESS,
      score_correct: 3,
      score_total: 4,
      time_spent_seconds: 180,
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-summary")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-summary-score")).toHaveTextContent(
      "3 / 4",
    );
    expect(screen.getByTestId("lesson-summary-time")).toHaveTextContent(/3/);
  });

  it("summary surfaces 2 stars at the 75% boundary", () => {
    _ready(2, { ...PROGRESS, score_correct: 3, score_total: 4 });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-summary")).toHaveAttribute(
      "data-stars",
      "2",
    );
    expect(screen.getByTestId("lesson-summary-star-1")).toHaveAttribute(
      "data-earned",
      "true",
    );
    expect(screen.getByTestId("lesson-summary-star-2")).toHaveAttribute(
      "data-earned",
      "true",
    );
    expect(screen.getByTestId("lesson-summary-star-3")).toHaveAttribute(
      "data-earned",
      "false",
    );
  });

  it("summary surfaces 3 stars + the celebration class at 100%", () => {
    _ready(2, { ...PROGRESS, score_correct: 4, score_total: 4 });
    renderAtPath(VALID_PATH);
    const summary = screen.getByTestId("lesson-summary");
    expect(summary).toHaveAttribute("data-stars", "3");
    expect(summary.className).toContain("is-celebrating");
  });

  it("summary fires confetti + a celebration message on a perfect run", () => {
    _ready(2, { ...PROGRESS, score_correct: 4, score_total: 4 });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("confetti")).toBeInTheDocument();
    const message = screen.getByTestId("lesson-summary-message");
    expect(message).toHaveAttribute("data-stars", "3");
    expect(message.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("summary shows no confetti below 3 stars but still shows a message", () => {
    _ready(2, { ...PROGRESS, score_correct: 1, score_total: 4 });
    renderAtPath(VALID_PATH);
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
    const message = screen.getByTestId("lesson-summary-message");
    expect(message).toHaveAttribute("data-stars", "0");
    expect(message.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("summary surfaces 0 stars below 50% (no celebration)", () => {
    _ready(2, { ...PROGRESS, score_correct: 1, score_total: 4 });
    renderAtPath(VALID_PATH);
    const summary = screen.getByTestId("lesson-summary");
    expect(summary).toHaveAttribute("data-stars", "0");
    expect(summary.className).not.toContain("is-celebrating");
    for (const n of [1, 2, 3]) {
      expect(screen.getByTestId(`lesson-summary-star-${n}`)).toHaveAttribute(
        "data-earned",
        "false",
      );
    }
  });

  it("summary renders the score bar with the right ARIA progressbar value", () => {
    _ready(2, { ...PROGRESS, score_correct: 3, score_total: 4 });
    renderAtPath(VALID_PATH);
    const bar = screen.getByTestId("lesson-summary-score-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("summary renders the per-exercise breakdown row for each exercise step", () => {
    _ready(2, {
      ...PROGRESS,
      score_correct: 1,
      score_total: 1,
      step_results: {
        "ex-1": {
          correct: 1,
          total: 1,
          attempts: 1,
          completed_at: "2026-05-27T00:01:00Z",
        },
      },
    });
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-summary-breakdown")).toBeInTheDocument();
    const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
    expect(row).toHaveAttribute("data-status", "correct");
    expect(row).toHaveTextContent(/1\s*\/\s*1/);
  });

  it("breakdown row reveals the canonical answer when an exercise was wrong", () => {
    const lessonWithPairs = {
      ...LESSON,
      steps: [
        LESSON.steps[0],
        {
          ...LESSON.steps[1],
          exercise: {
            ...LESSON.steps[1].exercise!,
            pairs: [
              { left: "Bonjour", right: "Hello" },
              { left: "Merci", right: "Thanks" },
            ],
          },
        },
      ],
    };
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: lessonWithPairs,
      progress: {
        ...PROGRESS,
        score_correct: 1,
        score_total: 2,
        step_results: {
          "ex-1": {
            correct: 1,
            total: 2,
            attempts: 1,
            completed_at: "2026-05-27T00:01:00Z",
          },
        },
      },
      currentStepIndex: 2,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
    expect(row).toHaveAttribute("data-status", "wrong");
    expect(row).toHaveTextContent(/Bonjour/);
    expect(row).toHaveTextContent(/Hello/);
  });

  it("breakdown row marks unattempted exercise steps as such", () => {
    _ready(2, {
      ...PROGRESS,
      // No step_results entry for ex-1 → unattempted.
      step_results: {},
    });
    renderAtPath(VALID_PATH);
    const row = screen.getByTestId("lesson-summary-breakdown-ex-1");
    expect(row).toHaveAttribute("data-status", "unattempted");
  });

  it("Practice again restarts the row then returns to step 0 (#983)", async () => {
    const goToStep = vi.fn();
    const markRestarted = vi.fn().mockResolvedValue(undefined);
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: PROGRESS,
      currentStepIndex: 2,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep,
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      markRestarted,
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    fireEvent.click(screen.getByTestId("lesson-summary-repeat"));
    // #983 — restart FIRST (clears the run so the next completion counts
    // as a fresh attempt), then jump back to the first step.
    expect(markRestarted).toHaveBeenCalled();
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(0));
  });

  it("Next lesson button hides when the set has only this lesson", async () => {
    // Default listLessonsMock returns a single-lesson set.
    _ready(2);
    renderAtPath(VALID_PATH);
    // listLessons resolves asynchronously; verify the absence
    // after a microtask tick.
    await waitFor(() => {
      expect(listLessonsMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("lesson-summary-next")).not.toBeInTheDocument();
  });

  it("Next lesson surfaces in the smart card when the set has a successor", async () => {
    listLessonsMock.mockResolvedValue({
      set_id: "language-fr-a1",
      source: "astrapi69/adaptive-learner-content",
      version: "1.0.0",
      lessons: ["01-greetings.json", "02-numbers.json"],
    });
    _ready(2);
    renderAtPath(VALID_PATH);
    // Phase 64 — the next-lesson action now lives inside the
    // NextStepSuggestions card as a router Link to the
    // successor; the standalone fallback button stays hidden.
    const cta = await screen.findByTestId("next-step-cta-next");
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute("href")).toContain("02-numbers.json");
    expect(screen.queryByTestId("lesson-summary-next")).not.toBeInTheDocument();
  });

  it("disables Previous on step 0", () => {
    _ready(0);
    renderAtPath(VALID_PATH);
    expect(screen.getByTestId("lesson-prev")).toBeDisabled();
  });

  it("Next button reads 'Finish' on the last step", async () => {
    _ready(1);
    renderAtPath(VALID_PATH);
    // The last step is an exercise, so the shared button
    // starts in the "Check" phase; once graded it advances
    // and reads "Finish".
    const checkBtn = await screen.findByTestId("lesson-check");
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    fireEvent.click(checkBtn);
    const nextBtn = await screen.findByTestId("lesson-next");
    expect(nextBtn).toHaveTextContent(/Finish/i);
  });

  it("calls goNext when Next is clicked", () => {
    const goNext = vi.fn();
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: PROGRESS,
      currentStepIndex: 0,
      error: null,
      goNext,
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    act(() => {
      fireEvent.click(screen.getByTestId("lesson-next"));
    });
    expect(goNext).toHaveBeenCalled();
  });

  it("summary mark-complete calls markCompleted", async () => {
    const markCompleted = vi.fn().mockResolvedValue(undefined);
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: PROGRESS,
      currentStepIndex: 2,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted,
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
    act(() => {
      fireEvent.click(screen.getByTestId("lesson-summary-mark-complete"));
    });
    await waitFor(() => {
      expect(markCompleted).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// BUG P1 — single two-phase button per exercise step.
//
// Regression-pin: the Lesson (controlled) flow must render EXACTLY ONE
// flow button — the shared two-phase "Prüfen" → "Weiter" button — and
// NONE of the exercise renderers may surface their own internal submit
// ("Antwort prüfen") button. This pins all 5 exercise types through the
// real ExerciseDispatcher + real renderers (only useLesson + getStorage
// are mocked), so a future renderer that forgets the `!controlled` gate
// fails loudly here.
// ---------------------------------------------------------------------------
describe("BUG P1: exactly one two-phase button, no internal submit", () => {
  const INTERNAL_SUBMIT_TESTIDS = [
    "matching-submit",
    "picture-submit",
    "free-text-submit",
    "word-tiles-submit",
    "cloze-submit",
  ];

  function _mountExercise(exercise: ContentLessonExercise) {
    const lesson = {
      ...LESSON,
      steps: [{ id: exercise.id, type: "exercise" as const, exercise }],
    };
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson,
      progress: PROGRESS,
      currentStepIndex: 0,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
    renderAtPath(VALID_PATH);
  }

  const CASES: Array<{ name: string; exercise: ContentLessonExercise }> = [
    {
      name: "matching",
      exercise: {
        id: "ex-m",
        type: "matching",
        prompt: "Match.",
        card_ids: [],
        pairs: [{ left: "A", right: "1" }],
        distractors: [],
      },
    },
    {
      name: "picture_choice",
      exercise: {
        id: "ex-p",
        type: "picture_choice",
        prompt: "Pick.",
        card_ids: [],
        images: [
          { src: "a.svg", label: "Apple", is_correct: "true" },
          { src: "b.svg", label: "Banana" },
        ],
        distractors: [],
      },
    },
    {
      name: "free_text",
      exercise: {
        id: "ex-f",
        type: "free_text",
        prompt: "Translate.",
        card_ids: [],
        accept: ["hola"],
        distractors: [],
      },
    },
    {
      name: "word_tiles",
      exercise: {
        id: "ex-w",
        type: "word_tiles",
        prompt: "Order.",
        card_ids: [],
        tiles: ["yo", "hablo"],
        distractors: [],
      },
    },
    {
      name: "cloze",
      exercise: {
        id: "ex-c",
        type: "cloze",
        prompt: "Fill.",
        card_ids: [],
        sentence: "Yo ___ español.",
        blanks: [{ accept: ["hablo"] }],
        cloze_mode: "type",
        distractors: [],
      },
    },
  ];

  for (const { name, exercise } of CASES) {
    it(`${name}: renders no internal submit button (controlled)`, () => {
      _mountExercise(exercise);
      for (const testid of INTERNAL_SUBMIT_TESTIDS) {
        expect(screen.queryByTestId(testid)).toBeNull();
      }
    });

    it(`${name}: shows exactly one flow button, in the disabled "Check" phase before answering`, () => {
      _mountExercise(exercise);
      // The shared two-phase button is in the "Check" phase…
      const checkBtn = screen.getByTestId("lesson-check");
      expect(checkBtn).toBeInTheDocument();
      // …disabled until the answer is checkable…
      expect(checkBtn).toBeDisabled();
      // …and the "Next" phase of the SAME button is not yet present.
      expect(screen.queryByTestId("lesson-next")).toBeNull();
      // No internal submit button competes with it.
      for (const testid of INTERNAL_SUBMIT_TESTIDS) {
        expect(screen.queryByTestId(testid)).toBeNull();
      }
    });
  }

  it("free_text: the one button advances to the 'Weiter' phase after a check", async () => {
    _mountExercise({
      id: "ex-f",
      type: "free_text",
      prompt: "Translate.",
      card_ids: [],
      accept: ["hola"],
      distractors: [],
    });
    // Phase 1 — disabled "Check"; no internal submit, no "Next".
    const checkBtn = screen.getByTestId("lesson-check");
    expect(checkBtn).toBeDisabled();
    expect(screen.queryByTestId("free-text-submit")).toBeNull();
    // Answer → the single button enables.
    fireEvent.change(screen.getByTestId("free-text-input"), {
      target: { value: "hola" },
    });
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    // Click "Check" → the SAME button slot flips to "Next" ("Weiter").
    fireEvent.click(checkBtn);
    await waitFor(() =>
      expect(screen.getByTestId("lesson-next")).toBeInTheDocument(),
    );
    // The "Check" phase is gone (one button, two phases — never both).
    expect(screen.queryByTestId("lesson-check")).toBeNull();
    // Still no internal submit button.
    expect(screen.queryByTestId("free-text-submit")).toBeNull();
  });
});

describe("LessonPage: button icons + 'Lektion pausieren' rename", () => {
  function _ready(stepIndex: number) {
    useLessonMock.mockReturnValue({
      status: "ready",
      lesson: LESSON,
      progress: PROGRESS,
      currentStepIndex: stepIndex,
      error: null,
      goNext: vi.fn(),
      goPrev: vi.fn(),
      goToStep: vi.fn(),
      goToStepById: vi.fn(),
      recordStepResult: vi.fn(),
      markCompleted: vi.fn(),
      refresh: vi.fn(),
    });
  }

  it("the pause button is labelled 'Pause lesson' (renamed from back-to-browser)", () => {
    _ready(0);
    renderAtPath(VALID_PATH);
    const pause = screen.getByTestId("lesson-back-btn");
    expect(pause).toHaveAttribute("aria-label", "Pause lesson");
    // Desktop label present in the DOM (hidden on mobile via md:inline).
    const label = pause.querySelector("span.hidden.md\\:inline");
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent("Pause lesson");
    // 44px touch target now via shadcn Button (min-h-11 = 44px).
    expect(pause).toHaveClass("min-h-11");
  });

  it("clicking pause opens the exit dialog (unchanged Phase 63 behavior)", () => {
    _ready(0);
    renderAtPath(VALID_PATH);
    expect(screen.queryByTestId("lesson-exit-dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("lesson-back-btn"));
    expect(screen.getByTestId("lesson-exit-dialog")).toBeInTheDocument();
  });

  it("the Previous button is icon-only on mobile (label hidden) with a 44px target", () => {
    _ready(0);
    renderAtPath(VALID_PATH);
    const prev = screen.getByTestId("lesson-prev");
    expect(prev).toHaveAttribute("aria-label", "Previous");
    // 44px touch target now via shadcn Button (min-h-11 = 44px).
    expect(prev).toHaveClass("min-h-11");
    expect(prev).toHaveClass("min-w-[44px]");
    expect(prev.querySelector("span.hidden.md\\:inline")).toHaveTextContent(
      "Previous",
    );
    // The icon is always present (the affordance on mobile).
    expect(prev.querySelector("svg")).not.toBeNull();
  });

  it("the Check button always keeps its text label plus an icon", () => {
    _ready(1); // exercise step, not yet checked -> Check button shows
    renderAtPath(VALID_PATH);
    const check = screen.getByTestId("lesson-check");
    expect(check).toHaveTextContent("Check");
    expect(check.querySelector("svg")).not.toBeNull();
    // 44px touch target now via shadcn Button (min-h-11 = 44px).
    expect(check).toHaveClass("min-h-11");
  });
});
