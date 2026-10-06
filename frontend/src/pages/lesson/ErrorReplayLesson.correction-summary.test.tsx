/**
 * #3575 - when Retry errors was opened from a lesson summary, its end
 * shows the correction summary of that lesson run: the router state
 * carries the run's first pass, the live SRS rows decide "corrected".
 */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

const sessionErrorsMock = vi.fn();
vi.mock("../../hooks/learning/useLessonSessionErrors", () => ({
  useLessonSessionErrors: (...args: unknown[]) => sessionErrorsMock(...args),
}));

import ErrorReplayLesson from "./ErrorReplayLesson";
import type { RunMistakes } from "../../lib/lesson/correction/correction-summary";
import type { ContentLessonExercise, ElementError } from "../../storage/types";

const FREE = (id: string, accept: string): ContentLessonExercise =>
  ({
    id,
    type: "free_text",
    prompt: `Translate ${id}`,
    card_ids: [],
    accept: [accept],
    distractors: [],
  }) as ContentLessonExercise;

const EXERCISE = FREE("ex-a", "hola");

const FIRST_PASS: RunMistakes = {
  mistakes: [
    {
      exercise: EXERCISE,
      stepId: "s1",
      title: "Translate ex-a",
      question: "Translate ex-a",
      firstAnswer: "ola",
      correctAnswer: "hola",
    },
  ],
  firstTry: { correct: 2, total: 3 },
};

function renderWithState(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/error-replay/slug/fr-a1/03.json", state }]}>
      <Routes>
        <Route path="/error-replay/:setSlug/:setId/:filename" element={<ErrorReplayLesson />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function answerAndAdvance(value: string) {
  fireEvent.change(screen.getByTestId("free-text-input"), { target: { value } });
  const check = screen.getByTestId("error-replay-check");
  await waitFor(() => expect(check).not.toBeDisabled());
  fireEvent.click(check);
  fireEvent.click(await screen.findByTestId("error-replay-next"));
}

describe("ErrorReplayLesson correction summary (#3575)", () => {
  it("shows the source run's corrections at the end", async () => {
    sessionErrorsMock.mockReturnValue([
      { exercise_id: "ex-a", element_key: "k", correct_streak: 1, mastered: false } as ElementError,
    ]);
    renderWithState({ exercises: [EXERCISE], cards: [], lessonTitle: "Greetings", firstPass: FIRST_PASS });
    await answerAndAdvance("hola");
    await screen.findByTestId("error-replay-summary");
    expect(screen.getByTestId("correction-summary-entry-s1")).toHaveAttribute("data-corrected", "true");
    expect(sessionErrorsMock).toHaveBeenCalledWith(expect.any(String), "fr-a1", "03.json");
  });

  it("keeps the score-only recap without a first pass (a flash round)", async () => {
    sessionErrorsMock.mockReturnValue([]);
    renderWithState({ exercises: [EXERCISE], cards: [], lessonTitle: "Greetings" });
    await answerAndAdvance("hola");
    await screen.findByTestId("error-replay-summary");
    expect(screen.queryByTestId("correction-summary")).toBeNull();
  });
});
