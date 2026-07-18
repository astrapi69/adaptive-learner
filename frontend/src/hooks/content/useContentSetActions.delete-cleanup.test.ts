/**
 * Set-delete cleanup pins (#1819): the confirm flow purges the SW lesson
 * cache on EVERY delete and deletes the planned learner data only via the
 * opt-in flag. Plans come from live storage reads when the modal opens.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ContentSetEntry } from "../../storage/types";

const deleteSetMock = vi.fn();
const deleteSetsMock = vi.fn();
const listProgressMock = vi.fn();
const listErrorsMock = vi.fn();
const listSetsMock = vi.fn();
const deleteLearningDataMock = vi.fn();
const purgeMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      deleteSet: (...a: unknown[]) => deleteSetMock(...a),
      deleteSets: (...a: unknown[]) => deleteSetsMock(...a),
      listSets: (...a: unknown[]) => listSetsMock(...a),
    },
    lessonProgress: { list: (...a: unknown[]) => listProgressMock(...a) },
    elementErrors: { list: (...a: unknown[]) => listErrorsMock(...a) },
    learningData: {
      deleteLearningData: (...a: unknown[]) => deleteLearningDataMock(...a),
    },
  }),
}));

vi.mock("../../lib/content/cache/sw-lesson-cache", () => ({
  purgeSetFromLessonCache: (...a: unknown[]) => purgeMock(...a),
}));

vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u-1" }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "de" }),
}));

import { useContentSetActions } from "./useContentSetActions";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "jane/repo",
    branch: "main",
    id: "waehrung",
    title: "Set",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  } as ContentSetEntry;
}

function mountHook() {
  return renderHook(() =>
    useContentSetActions({
      navigate: vi.fn() as never,
      setSets: vi.fn(),
      setPerSetState: vi.fn(),
    }),
  );
}

beforeEach(() => {
  deleteSetMock.mockReset().mockResolvedValue(undefined);
  deleteSetsMock.mockReset().mockResolvedValue(undefined);
  listProgressMock.mockReset().mockResolvedValue([
    { id: "lp-1", source: "jane/repo", set_id: "waehrung" },
  ]);
  listErrorsMock.mockReset().mockResolvedValue([
    { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
  ]);
  listSetsMock.mockReset().mockResolvedValue({
    sets: [{ source: "jane/repo", id: "waehrung", cached_version: "1.0.0" }],
  });
  deleteLearningDataMock.mockReset().mockResolvedValue({
    lessonsDeleted: 1,
    cardsDeleted: 1,
  });
  purgeMock.mockReset().mockResolvedValue(1);
  localStorage.clear();
});

describe("set delete cleanup (#1819)", () => {
  it("opening the dialog computes the deletion plan from live reads", async () => {
    const { result } = mountHook();
    act(() => result.current.setDeleteSetTarget(entry()));
    await waitFor(() =>
      expect(result.current.deleteSetPlan).toEqual({
        lessonProgressIds: ["lp-1"],
        orphanedSetIds: ["waehrung"],
        lessonCount: 1,
        cardCount: 1,
      }),
    );
  });

  it("confirm ALWAYS purges the SW lesson cache, even without the opt-in", async () => {
    const { result } = mountHook();
    act(() => result.current.setDeleteSetTarget(entry()));
    await waitFor(() => expect(result.current.deleteSetPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmDeleteSet(false);
    });
    expect(deleteSetMock).toHaveBeenCalledWith("jane/repo", "waehrung");
    expect(purgeMock).toHaveBeenCalledWith("jane/repo", "waehrung");
    expect(deleteLearningDataMock).not.toHaveBeenCalled();
  });

  it("opt-in deletes exactly the planned learner data", async () => {
    const { result } = mountHook();
    act(() => result.current.setDeleteSetTarget(entry()));
    await waitFor(() => expect(result.current.deleteSetPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmDeleteSet(true);
    });
    expect(deleteLearningDataMock).toHaveBeenCalledWith("u-1", {
      lessonProgressIds: ["lp-1"],
      setIds: ["waehrung"],
    });
  });

  it("bulk confirm purges every set and honours the opt-in", async () => {
    const { result } = mountHook();
    act(() =>
      result.current.setBulkDeleteTargets([
        entry(),
        entry({ id: "other-set" }),
      ]),
    );
    await waitFor(() => expect(result.current.bulkDeletePlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmBulkDelete(true);
    });
    expect(deleteSetsMock).toHaveBeenCalledTimes(1);
    expect(purgeMock).toHaveBeenCalledWith("jane/repo", "waehrung");
    expect(purgeMock).toHaveBeenCalledWith("jane/repo", "other-set");
    expect(deleteLearningDataMock).toHaveBeenCalledTimes(1);
  });
});
