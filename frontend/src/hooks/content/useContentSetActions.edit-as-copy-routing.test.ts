/**
 * EXP-046 item 3 / #2654 — the ONE thing the standalone ``useEditAsCopy``
 * unit test can't see: that ``useContentSetActions`` wires its ``onForked``
 * to the real ``handleEditUserSet`` routing, not a stub. Everything else
 * (fork mechanics, id collision, error handling) is covered directly on
 * ``useEditAsCopy.test.ts``; this file pins only the composition seam.
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useContentSetActions } from "./useContentSetActions";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
const saveUserSetMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listLessons: (...a: unknown[]) => listLessonsMock(...a),
      getLesson: (...a: unknown[]) => getLessonMock(...a),
      listSets: (...a: unknown[]) => listSetsMock(...a),
      saveUserSet: (...a: unknown[]) => saveUserSetMock(...a),
    },
  }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "de" }),
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "owner/repo",
    branch: "main",
    id: "psych",
    title: "Psychologie",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
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

function lesson(id: string): ContentLesson {
  return { id, title: `Lesson ${id}`, steps: [] } as unknown as ContentLesson;
}

beforeEach(() => {
  vi.clearAllMocks();
  listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
  getLessonMock.mockResolvedValue(lesson("01"));
  listSetsMock.mockResolvedValue({ sets: [] });
});

it("routes into the lesson editor for the freshly-forked copy (#2654)", async () => {
  saveUserSetMock.mockResolvedValue(
    entry({ source: "user-generated", id: "psych-copy", domain: "imported" }),
  );
  const navigate = vi.fn();
  const hook = renderHook(() =>
    useContentSetActions({
      navigate: navigate as never,
      setSets: vi.fn() as never,
      setPerSetState: vi.fn() as never,
    }),
  );

  act(() => hook.result.current.requestEditAsCopy(entry({ id: "psych" })));
  await act(async () => {
    await hook.result.current.handleConfirmEditAsCopy();
  });

  expect(navigate).toHaveBeenCalledWith(
    `/create-lesson/edit/${encodeURIComponent("user-generated")}/${encodeURIComponent("psych-copy")}`,
  );
});
