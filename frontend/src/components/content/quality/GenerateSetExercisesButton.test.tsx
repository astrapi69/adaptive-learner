/**
 * AIX-06 (EXP-036) — tests for the batch "Generate for all lessons" button.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import GenerateSetExercisesButton from "./GenerateSetExercisesButton";
import { I18nProvider } from "../../../hooks/ui/useI18n";
import type { BatchLesson, SetBatchDeps } from "../../../lib/ai/generation/generate-exercises-for-set";
import type { ContentLessonExercise, ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";

vi.mock("../../../utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockNotify = vi.mocked(notify);

const ENTRY = { id: "set1", source: "user-generated", title: "My set" } as ContentSetEntry;

function lesson(id: string, exerciseCount: number): BatchLesson {
  return {
    id,
    filename: `${id}.json`,
    title: id,
    theorySteps: [{ id: "t", title: "T", body: "theory" }],
    exerciseCount,
  };
}

function ex(id: string): ContentLessonExercise {
  return { id, type: "free_text", prompt: "Q", card_ids: [], accept: ["a"], distractors: [] };
}

function mockDeps(lessons: BatchLesson[]): SetBatchDeps {
  return {
    loadLessons: async () => lessons,
    generateForLesson: async (l) => [ex(`${l.id}-1`)],
    saveLessonExercises: async () => {},
  };
}

function renderButton(prepareDeps: (e: ContentSetEntry) => Promise<SetBatchDeps | null>) {
  const t = (_k: string, fallback?: string) => fallback ?? _k;
  render(
    <I18nProvider>
      <MemoryRouter>
        <GenerateSetExercisesButton entry={ENTRY} t={t} prepareDeps={prepareDeps} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});
afterEach(() => vi.restoreAllMocks());

describe("GenerateSetExercisesButton", () => {
  it("renders the batch button", () => {
    renderButton(async () => mockDeps([lesson("a", 0)]));
    expect(screen.getByTestId("generate-set-exercises-set1")).toBeInTheDocument();
  });

  it("confirms cost then generates for every theory-only lesson", async () => {
    renderButton(async () => mockDeps([lesson("a", 0), lesson("b", 0)]));
    fireEvent.click(screen.getByTestId("generate-set-exercises-set1"));
    await waitFor(() => expect(mockNotify.success).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalled();
    expect(mockNotify.success.mock.calls[0][0]).toContain("2 of 2");
  });

  it("does nothing (info toast) when all lessons already have exercises", async () => {
    renderButton(async () => mockDeps([lesson("a", 3)]));
    fireEvent.click(screen.getByTestId("generate-set-exercises-set1"));
    await waitFor(() => expect(mockNotify.info).toHaveBeenCalled());
    expect(window.confirm).not.toHaveBeenCalled();
    expect(mockNotify.success).not.toHaveBeenCalled();
  });

  it("does not generate when the cost confirm is dismissed", async () => {
    window.confirm = vi.fn(() => false);
    const deps = mockDeps([lesson("a", 0)]);
    const saveSpy = vi.spyOn(deps, "saveLessonExercises");
    renderButton(async () => deps);
    fireEvent.click(screen.getByTestId("generate-set-exercises-set1"));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(saveSpy).not.toHaveBeenCalled();
    expect(mockNotify.success).not.toHaveBeenCalled();
  });

  it("shows the API-key notice when no provider is configured", async () => {
    renderButton(async () => null);
    fireEvent.click(screen.getByTestId("generate-set-exercises-set1"));
    await waitFor(() =>
      expect(screen.getByTestId("generate-set-no-key-set1")).toBeInTheDocument(),
    );
    expect(mockNotify.success).not.toHaveBeenCalled();
  });
});
