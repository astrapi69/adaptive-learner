/**
 * AIX-06 (EXP-036) — tests for the batch "Generate for all lessons" button.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import GenerateSetExercisesButton from "./GenerateSetExercisesButton";
import { I18nProvider } from "../../../hooks/ui/useI18n";
import type { BatchLesson, SetBatchDeps } from "../../../lib/ai/generation/generate-exercises-for-set";
import type { ContentLessonExercise, ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";

vi.mock("../../../utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// #1896 — the default pending-probe reads the content store; tests that
// do not care about the disabled state get a "one lesson pending" stub.
vi.mock("../../../lib/ai/generation/set-exercise-candidates", () => ({
  countLessonsWithoutExercises: vi.fn(async () => 1),
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

function renderButton(
  prepareDeps: (e: ContentSetEntry) => Promise<SetBatchDeps | null>,
  countPending?: (e: ContentSetEntry) => Promise<number>,
) {
  const t = (_k: string, fallback?: string) => fallback ?? _k;
  render(
    <I18nProvider>
      <MemoryRouter>
        <GenerateSetExercisesButton
          entry={ENTRY}
          t={t}
          prepareDeps={prepareDeps}
          countPending={countPending}
        />
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

  // Click-path guard (defense in depth): the probe said "1 pending" but the
  // freshly loaded lessons all carry exercises (stale probe / concurrent edit).
  it("does nothing (info toast) when all lessons already have exercises", async () => {
    renderButton(async () => mockDeps([lesson("a", 3)]), async () => 1);
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

  // --- #1896 — proactive disabled state ------------------------------------

  it("disables the button when every lesson already has exercises", async () => {
    const prepare = vi.fn(async () => mockDeps([lesson("a", 3)]));
    renderButton(prepare, async () => 0);
    const button = await screen.findByTestId("generate-set-exercises-set1");
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute(
      "title",
      "All lessons already have exercises.",
    );
    fireEvent.click(button);
    await waitFor(() => expect(prepare).not.toHaveBeenCalled());
    expect(mockNotify.info).not.toHaveBeenCalled();
  });

  it("keeps the button active when some lessons still lack exercises", async () => {
    renderButton(async () => mockDeps([lesson("a", 0), lesson("b", 2)]), async () => 1);
    const button = await screen.findByTestId("generate-set-exercises-set1");
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAttribute("title");
    fireEvent.click(button);
    await waitFor(() => expect(mockNotify.success).toHaveBeenCalled());
  });

  it("stays clickable when the pending probe fails (fail open)", async () => {
    renderButton(
      async () => mockDeps([lesson("a", 0)]),
      async () => {
        throw new Error("storage unavailable");
      },
    );
    const button = await screen.findByTestId("generate-set-exercises-set1");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockNotify.success).toHaveBeenCalled());
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
