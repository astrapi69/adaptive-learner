/**
 * BUG P1 — single two-phase button in the ADAPTIVE lesson flow.
 *
 * Regression-pin for the "two buttons visible" report. The adaptive
 * lesson page used to render each exercise UNCONTROLLED (so the
 * renderer showed its own internal "Antwort prüfen" submit) AND its
 * own "Weiter" nav button — two buttons at once during every exercise
 * step. This pins the controlled two-phase flow: no internal submit,
 * exactly one shared button (Check -> Weiter) per exercise step.
 *
 * Mocks only useAdaptiveLesson + getStorage; the real
 * ExerciseDispatcher + real renderers run so a future regression
 * (a renderer dropping the `!controlled` gate, or the page rendering
 * the nav-next button alongside the exercise) fails loudly here.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAdaptiveLessonMock = vi.fn();

vi.mock("../../hooks/lesson/modes/useAdaptiveLesson", () => ({
  useAdaptiveLesson: () => useAdaptiveLessonMock(),
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({
    elementErrors: { recordBulk: vi.fn().mockResolvedValue(undefined) },
  }),
}));

import AdaptiveLessonPage from "./AdaptiveLesson";
import type { ContentLessonExercise } from "../../storage/types";

const INTERNAL_SUBMIT_TESTIDS = [
  "matching-submit",
  "picture-submit",
  "free-text-submit",
  "word-tiles-submit",
  "cloze-submit",
];

function mountExercise(exercise: ContentLessonExercise) {
  useAdaptiveLessonMock.mockReturnValue({
    status: "ready",
    lesson: {
      id: "adaptive",
      title: "Adaptive lesson",
      estimated_minutes: 5,
      cards: [],
      steps: [{ id: exercise.id, type: "exercise" as const, exercise }],
    },
    transparency: null,
    currentStepIndex: 0,
    error: null,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
    sessionScoreCorrect: 0,
    sessionScoreTotal: 0,
    masteredDelta: 0,
    finalize: vi.fn().mockResolvedValue(undefined),
  });
  return render(
    <MemoryRouter initialEntries={["/adaptive-lesson/language-fr-a1"]}>
      <Routes>
        <Route
          path="/adaptive-lesson/:setId"
          element={<AdaptiveLessonPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
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

beforeEach(() => {
  useAdaptiveLessonMock.mockReset();
});

describe("AdaptiveLesson BUG P1: one two-phase button, no internal submit", () => {
  for (const { name, exercise } of CASES) {
    it(`${name}: renders no internal submit button (controlled)`, () => {
      mountExercise(exercise);
      for (const testid of INTERNAL_SUBMIT_TESTIDS) {
        expect(screen.queryByTestId(testid)).toBeNull();
      }
    });

    it(`${name}: exactly one flow button, disabled "Check", no "Next" before answering`, () => {
      mountExercise(exercise);
      const checkBtn = screen.getByTestId("adaptive-lesson-check");
      expect(checkBtn).toBeInTheDocument();
      expect(checkBtn).toBeDisabled();
      expect(screen.queryByTestId("adaptive-lesson-next")).toBeNull();
      for (const testid of INTERNAL_SUBMIT_TESTIDS) {
        expect(screen.queryByTestId(testid)).toBeNull();
      }
    });
  }

  it("free_text: the one button flips to 'Weiter' after a check", async () => {
    mountExercise({
      id: "ex-f",
      type: "free_text",
      prompt: "Translate.",
      card_ids: [],
      accept: ["hola"],
      distractors: [],
    });
    const checkBtn = screen.getByTestId("adaptive-lesson-check");
    expect(checkBtn).toBeDisabled();
    expect(screen.queryByTestId("free-text-submit")).toBeNull();
    fireEvent.change(screen.getByTestId("free-text-input"), {
      target: { value: "hola" },
    });
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    fireEvent.click(checkBtn);
    await waitFor(() =>
      expect(screen.getByTestId("adaptive-lesson-next")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("adaptive-lesson-check")).toBeNull();
    expect(screen.queryByTestId("free-text-submit")).toBeNull();
  });
});
