/**
 * The adaptive lesson opens on its borrowed theory page (#3224).
 *
 * The generator (``lesson-generator.ts``, ``_theoryStepForCluster``)
 * prepends the source lesson's theory step whenever an error cluster has
 * a cached source lesson, and every published lesson has one, so in
 * practice every adaptive lesson opens on it. The runner shell handed
 * that step to ``ExerciseDispatcher``, which renders a step without an
 * exercise as "This exercise is missing its type": the first screen of a
 * whole learning mode.
 *
 * The dispatcher is the REAL one here (the #3169 page tests mock it, which
 * would hide exactly this message). The adaptive mode hook is a stateful
 * mock with the generator's shape: the borrowed theory step first, then
 * one free-text exercise.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLessonShortcutsEnabled } from "../../lib/lesson/prefs/lessonShortcutsPref";

const hoisted = vi.hoisted(() => {
  const theory = {
    id: "adaptive-theory-01-greetings-intro",
    type: "theory" as const,
    title: "Greetings",
    body: "## Saying hello\n\n**Bonjour** means hello and works all day.",
    exercise: null,
  };
  const exercise = {
    id: "adaptive-step-0-bonjour",
    type: "exercise" as const,
    title: null,
    body: null,
    exercise: {
      id: "ex-free-bonjour",
      type: "free_text",
      prompt: "Translate: hello",
      card_ids: [],
      accept: ["bonjour"],
      distractors: [],
    },
  };
  return { steps: { value: [theory, exercise] as unknown[] }, theory, exercise };
});

vi.mock("../../hooks/lesson/modes/useAdaptiveLesson", async () => {
  const { useState } = await import("react");
  return {
    useAdaptiveLesson: () => {
      const [idx, setIdx] = useState(0);
      const steps = hoisted.steps.value;
      return {
        status: "ready",
        lesson: {
          id: "adaptive",
          title: "Adaptive lesson",
          estimated_minutes: 1,
          cards: [],
          steps,
        },
        transparency: { tags: [], total_errors: 3, active_elements: 3, mastered_before: 0 },
        currentStepIndex: idx,
        error: null,
        goNext: () => setIdx((i) => Math.min(i + 1, steps.length)),
        goPrev: () => setIdx((i) => Math.max(i - 1, 0)),
        recordStepAttempts: vi.fn().mockResolvedValue(undefined),
        sessionScoreCorrect: 0,
        sessionScoreTotal: 0,
        masteredDelta: null,
        finalize: vi.fn().mockResolvedValue(undefined),
      };
    },
  };
});

vi.mock("../../storage", () => ({
  getStorage: () => ({ elementErrors: { recordBulk: vi.fn().mockResolvedValue([]) } }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "user-1", projectId: null, language: "en" }),
}));

import AdaptiveLessonPage from "./AdaptiveLesson";

const MISSING_TYPE = "This exercise is missing its type";
const THEORY_ARTICLE = `adaptive-lesson-step-${hoisted.theory.id}`;
const EXERCISE_ARTICLE = `adaptive-lesson-step-${hoisted.exercise.id}`;

function mountAdaptive() {
  render(
    <MemoryRouter initialEntries={["/adaptive-lesson/fr-a1-from-en"]}>
      <Routes>
        <Route path="/adaptive-lesson/:setId" element={<AdaptiveLessonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hoisted.steps.value = [hoisted.theory, hoisted.exercise];
  setLessonShortcutsEnabled(true);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe("the adaptive lesson's first screen is its theory page (#3224)", () => {
  it("reproduction: the borrowed theory step shows its content, not 'missing its type'", () => {
    mountAdaptive();
    expect(screen.getByTestId("adaptive-lesson-page")).not.toHaveTextContent(MISSING_TYPE);
    expect(screen.queryByTestId("lesson-exercise-placeholder-missing")).toBeNull();
    const article = screen.getByTestId(THEORY_ARTICLE);
    expect(article).toHaveAttribute("data-step-type", "theory");
    const body = screen.getByTestId("adaptive-lesson-theory-body");
    expect(body).toHaveTextContent("Saying hello");
    expect(body).toHaveTextContent("Bonjour means hello and works all day.");
  });

  it("happy path: the footer on the theory page shows Next, not Check", () => {
    mountAdaptive();
    expect(screen.getByTestId("adaptive-lesson-next")).toBeEnabled();
    expect(screen.queryByTestId("adaptive-lesson-check")).toBeNull();
    expect(screen.getByTestId("adaptive-lesson-prev")).toBeDisabled();
  });

  it("happy path: Next leads from the theory page to the first exercise, with Check", async () => {
    mountAdaptive();
    fireEvent.click(screen.getByTestId("adaptive-lesson-next"));
    await waitFor(() => expect(screen.getByTestId(EXERCISE_ARTICLE)).toBeInTheDocument());
    expect(screen.getByTestId("free-text-exercise")).toBeInTheDocument();
    expect(screen.getByTestId("adaptive-lesson-check")).toBeInTheDocument();
    expect(screen.queryByTestId("adaptive-lesson-theory-body")).toBeNull();
  });

  it("edge: Enter on the theory page moves on to the first exercise", async () => {
    mountAdaptive();
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId(EXERCISE_ARTICLE)).toBeInTheDocument());
  });

  it("boundary: Previous from the first exercise returns to the theory page", async () => {
    mountAdaptive();
    fireEvent.click(screen.getByTestId("adaptive-lesson-next"));
    await waitFor(() => expect(screen.getByTestId(EXERCISE_ARTICLE)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("adaptive-lesson-prev"));
    await waitFor(() => expect(screen.getByTestId(THEORY_ARTICLE)).toBeInTheDocument());
    expect(screen.getByTestId("adaptive-lesson-theory-body")).toHaveTextContent("Saying hello");
    expect(screen.queryByTestId("adaptive-lesson-check")).toBeNull();
  });
});
