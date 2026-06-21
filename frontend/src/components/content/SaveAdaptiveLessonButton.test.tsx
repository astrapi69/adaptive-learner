import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import SaveAdaptiveLessonButton from "./SaveAdaptiveLessonButton";
import type { ContentLesson } from "../../storage/types";

const saveUserSet = vi.fn();
vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: { saveUserSet: (...a: unknown[]) => saveUserSet(...a) },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: unknown) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u", projectId: null, language: "fr" }),
}));

const ADAPTIVE: ContentLesson = {
  id: "adaptive-fr-a1-2026-05-29T17:00:00.000Z",
  title: "Adaptive lesson",
  description: null,
  estimated_minutes: 5,
  cards: [],
  steps: [
    {
      id: "adaptive-theory-x",
      type: "theory",
      title: "T",
      body: "Body",
    },
    {
      id: "adaptive-step-0-article:gender-ex-1",
      type: "exercise",
      title: null,
      body: null,
      exercise: {
        id: "ex-1",
        type: "free_text",
        prompt: "Translate",
        card_ids: ["src-card"],
        accept: ["le chat"],
        distractors: [],
      },
    },
  ],
};

describe("SaveAdaptiveLessonButton", () => {
  beforeEach(() => {
    saveUserSet.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("snapshots + saves the adaptive lesson with origin 'adaptive'", async () => {
    saveUserSet.mockResolvedValue({});
    render(<SaveAdaptiveLessonButton lesson={ADAPTIVE} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("adaptive-save-lesson"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.origin).toBe("adaptive");
    expect(arg.language).toBe("fr");
    // The snapshot id is slug-safe (no colons/dots from the ISO id).
    expect(arg.set_id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const lessons = arg.lessons as ContentLesson[];
    expect(lessons[0].cards).toEqual([]);
    expect(lessons[0].steps[1].exercise!.card_ids).toEqual([]);
    // Shows the saved confirmation afterwards.
    await screen.findByTestId("adaptive-save-done");
    expect(toastSuccess).toHaveBeenCalled();
  });
});
