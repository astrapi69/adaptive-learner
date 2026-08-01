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
const purgeLessonMock = vi.fn();
const saveUserSetMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      deleteSet: (...a: unknown[]) => deleteSetMock(...a),
      deleteSets: (...a: unknown[]) => deleteSetsMock(...a),
      listSets: (...a: unknown[]) => listSetsMock(...a),
      saveUserSet: (...a: unknown[]) => saveUserSetMock(...a),
      listLessons: (...a: unknown[]) => listLessonsMock(...a),
      getLesson: (...a: unknown[]) => getLessonMock(...a),
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
  purgeLessonFromLessonCache: (...a: unknown[]) => purgeLessonMock(...a),
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
  purgeLessonMock.mockReset().mockResolvedValue(1);
  saveUserSetMock.mockReset().mockResolvedValue({});
  listLessonsMock.mockReset().mockResolvedValue({
    lessons: ["01-intro.json", "02-body.json"],
  });
  getLessonMock.mockReset().mockImplementation(
    async (_s: string, _i: string, f: string) => ({
      id: f.replace(/\.json$/, ""),
      title: f,
      cards: [],
      steps: [],
    }),
  );
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

describe("single-lesson delete (#2064)", () => {
  const userSet = () =>
    entry({ source: "user-generated", id: "book42", lesson_count: 2 });

  function openLessonTarget(result: { current: ReturnType<typeof useContentSetActions> }) {
    act(() =>
      result.current.setDeleteLessonTarget({
        entry: userSet(),
        filename: "01-intro.json",
        title: "Intro",
      }),
    );
  }

  beforeEach(() => {
    listProgressMock.mockResolvedValue([
      {
        id: "lp-1",
        source: "user-generated",
        set_id: "book42",
        lesson_filename: "01-intro.json",
      },
      {
        id: "lp-2",
        source: "user-generated",
        set_id: "book42",
        lesson_filename: "02-body.json",
      },
    ]);
    listErrorsMock.mockResolvedValue([
      { set_id: "book42", lesson_id: "01-intro.json", exercise_id: "e1", element_key: "a" },
      { set_id: "book42", lesson_id: "02-body.json", exercise_id: "e1", element_key: "b" },
    ]);
  });

  it("opening the dialog plans only the target lesson's data", async () => {
    const { result } = mountHook();
    openLessonTarget(result);
    await waitFor(() =>
      expect(result.current.deleteLessonPlan).toEqual({
        lessonProgressIds: ["lp-1"],
        orphanedSetIds: [],
        lessonCards: [{ set_id: "book42", lesson_id: "01-intro.json" }],
        lessonCount: 1,
        cardCount: 1,
      }),
    );
  });

  it("re-saves the set without the lesson + purges its cache/favorite, no progress opt-out", async () => {
    const { result } = mountHook();
    openLessonTarget(result);
    await waitFor(() => expect(result.current.deleteLessonPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmDeleteLesson(false);
    });
    // Re-saved with only the surviving lesson (no renumbering).
    const saved = saveUserSetMock.mock.calls[0][0];
    expect(saved.set_id).toBe("book42");
    expect(saved.lessons.map((l: { id: string }) => l.id)).toEqual(["02-body"]);
    expect(purgeLessonMock).toHaveBeenCalledWith("user-generated", "book42", "01-intro.json");
    expect(deleteSetMock).not.toHaveBeenCalled();
    expect(deleteLearningDataMock).not.toHaveBeenCalled();
  });

  it("opt-in deletes exactly the lesson's progress + cards", async () => {
    const { result } = mountHook();
    openLessonTarget(result);
    await waitFor(() => expect(result.current.deleteLessonPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmDeleteLesson(true);
    });
    expect(deleteLearningDataMock).toHaveBeenCalledWith("u-1", {
      lessonProgressIds: ["lp-1"],
      setIds: [],
      lessonCards: [{ set_id: "book42", lesson_id: "01-intro.json" }],
    });
  });

  it("deletes the whole set when the last lesson is removed", async () => {
    listLessonsMock.mockResolvedValue({ lessons: ["01-intro.json"] });
    const { result } = mountHook();
    openLessonTarget(result);
    await waitFor(() => expect(result.current.deleteLessonPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmDeleteLesson(false);
    });
    expect(deleteSetMock).toHaveBeenCalledWith("user-generated", "book42");
    expect(purgeMock).toHaveBeenCalledWith("user-generated", "book42");
    expect(saveUserSetMock).not.toHaveBeenCalled();
  });
});

describe("bulk multi-lesson delete (#2065)", () => {
  const userSet = () =>
    entry({ source: "user-generated", id: "book42", lesson_count: 3 });

  function openBulkTarget(
    result: { current: ReturnType<typeof useContentSetActions> },
    filenames: string[],
  ) {
    act(() =>
      result.current.setBulkDeleteLessonsTarget({ entry: userSet(), filenames }),
    );
  }

  beforeEach(() => {
    listLessonsMock.mockResolvedValue({
      lessons: ["01-intro.json", "02-body.json", "03-end.json"],
    });
    listProgressMock.mockResolvedValue([
      { id: "lp-1", source: "user-generated", set_id: "book42", lesson_filename: "01-intro.json" },
      { id: "lp-2", source: "user-generated", set_id: "book42", lesson_filename: "02-body.json" },
      { id: "lp-3", source: "user-generated", set_id: "book42", lesson_filename: "03-end.json" },
    ]);
    listErrorsMock.mockResolvedValue([
      { set_id: "book42", lesson_id: "01-intro.json", exercise_id: "e1", element_key: "a" },
      { set_id: "book42", lesson_id: "02-body.json", exercise_id: "e1", element_key: "b" },
      { set_id: "book42", lesson_id: "03-end.json", exercise_id: "e1", element_key: "c" },
    ]);
  });

  it("opening the dialog aggregates the selected lessons' data into one plan", async () => {
    const { result } = mountHook();
    openBulkTarget(result, ["01-intro.json", "02-body.json"]);
    await waitFor(() =>
      expect(result.current.bulkDeleteLessonsPlan).toEqual({
        lessonProgressIds: ["lp-1", "lp-2"],
        orphanedSetIds: [],
        lessonCards: [
          { set_id: "book42", lesson_id: "01-intro.json" },
          { set_id: "book42", lesson_id: "02-body.json" },
        ],
        lessonCount: 2,
        cardCount: 2,
      }),
    );
  });

  it("re-saves the set once without the whole selection, keeping the order of survivors", async () => {
    const { result } = mountHook();
    openBulkTarget(result, ["01-intro.json", "03-end.json"]);
    await waitFor(() => expect(result.current.bulkDeleteLessonsPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmBulkDeleteLessons(false);
    });
    expect(saveUserSetMock).toHaveBeenCalledTimes(1);
    const saved = saveUserSetMock.mock.calls[0][0];
    expect(saved.lessons.map((l: { id: string }) => l.id)).toEqual(["02-body"]);
    expect(purgeLessonMock).toHaveBeenCalledWith("user-generated", "book42", "01-intro.json");
    expect(purgeLessonMock).toHaveBeenCalledWith("user-generated", "book42", "03-end.json");
    expect(deleteSetMock).not.toHaveBeenCalled();
    expect(deleteLearningDataMock).not.toHaveBeenCalled();
  });

  it("opt-in deletes exactly the aggregated progress + cards in ONE call", async () => {
    const { result } = mountHook();
    openBulkTarget(result, ["01-intro.json", "02-body.json"]);
    await waitFor(() => expect(result.current.bulkDeleteLessonsPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmBulkDeleteLessons(true);
    });
    expect(deleteLearningDataMock).toHaveBeenCalledTimes(1);
    expect(deleteLearningDataMock).toHaveBeenCalledWith("u-1", {
      lessonProgressIds: ["lp-1", "lp-2"],
      setIds: [],
      lessonCards: [
        { set_id: "book42", lesson_id: "01-intro.json" },
        { set_id: "book42", lesson_id: "02-body.json" },
      ],
    });
  });

  it("deletes the whole set when the selection covers EVERY lesson", async () => {
    const { result } = mountHook();
    openBulkTarget(result, ["01-intro.json", "02-body.json", "03-end.json"]);
    await waitFor(() => expect(result.current.bulkDeleteLessonsPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmBulkDeleteLessons(false);
    });
    expect(deleteSetMock).toHaveBeenCalledWith("user-generated", "book42");
    expect(purgeMock).toHaveBeenCalledWith("user-generated", "book42");
    expect(saveUserSetMock).not.toHaveBeenCalled();
  });

  it("ALL-OR-NOTHING: a mid-delete failure leaves the set untouched (no partial removal)", async () => {
    saveUserSetMock.mockRejectedValueOnce(new Error("disk full"));
    const setSets = vi.fn();
    const { result } = renderHook(() =>
      useContentSetActions({
        navigate: vi.fn() as never,
        setSets,
        setPerSetState: vi.fn(),
      }),
    );
    act(() =>
      result.current.setBulkDeleteLessonsTarget({
        entry: userSet(),
        filenames: ["01-intro.json", "02-body.json"],
      }),
    );
    await waitFor(() => expect(result.current.bulkDeleteLessonsPlan).not.toBeNull());
    await act(async () => {
      await result.current.handleConfirmBulkDeleteLessons(true);
    });
    // The single content write failed → NOTHING else ran: no set-list
    // mutation, no learner-data delete, no cache purge. The set is intact.
    expect(setSets).not.toHaveBeenCalled();
    expect(deleteLearningDataMock).not.toHaveBeenCalled();
    expect(purgeLessonMock).not.toHaveBeenCalled();
    expect(deleteSetMock).not.toHaveBeenCalled();
    // The dialog stays open for a retry.
    expect(result.current.bulkDeleteLessonsTarget).not.toBeNull();
  });
});
