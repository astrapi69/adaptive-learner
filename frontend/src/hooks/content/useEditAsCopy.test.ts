/**
 * useEditAsCopy (EXP-046 item 3 / #2654) — "Als Kopie bearbeiten": forking
 * a downloaded (read-only) set into a user-generated copy and handing the
 * new entry to the caller's routing. Covers the happy path (fork + hand
 * off to onForked) and the id-collision edge (nextCopySetId), the two
 * cases named in the issue's Vitest requirement. Tested directly against
 * this hook (not through the whole useContentSetActions), per the
 * "individually testable without reconstructing the whole context" rule —
 * ``fetchSetLessons`` and ``onForked`` are injected mocks, no dependency on
 * the rest of the set-actions surface.
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditAsCopy } from "./useEditAsCopy";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";

const listSetsMock = vi.fn();
const saveUserSetMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: (...a: unknown[]) => listSetsMock(...a),
      saveUserSet: (...a: unknown[]) => saveUserSetMock(...a),
    },
  }),
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: {
    success: (...a: unknown[]) => notifySuccess(...a),
    error: (...a: unknown[]) => notifyError(...a),
    warning: vi.fn(),
  },
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

function setup() {
  const onForked = vi.fn();
  const fetchSetLessons = vi.fn().mockResolvedValue([lesson("01")]);
  const hook = renderHook(() => useEditAsCopy({ fetchSetLessons, onForked }));
  return { hook, onForked, fetchSetLessons };
}

beforeEach(() => {
  vi.clearAllMocks();
  listSetsMock.mockResolvedValue({ sets: [] });
});

describe("requestEditAsCopy / handleConfirmEditAsCopy (#2654)", () => {
  it("does nothing until requested", () => {
    const { hook } = setup();
    expect(hook.result.current.editAsCopyTarget).toBeNull();
  });

  it("opens the confirm target on request", () => {
    const { hook } = setup();
    const target = entry();
    act(() => hook.result.current.requestEditAsCopy(target));
    expect(hook.result.current.editAsCopyTarget).toBe(target);
  });

  it("forks the set (origin imported, id suffixed -copy like the other fork paths) and hands off to onForked", async () => {
    const forked = entry({ source: "user-generated", id: "psych-copy", domain: "imported" });
    saveUserSetMock.mockResolvedValue(forked);
    const { hook, onForked, fetchSetLessons } = setup();
    const target = entry({ id: "psych" });
    act(() => hook.result.current.requestEditAsCopy(target));

    await act(async () => {
      await hook.result.current.handleConfirmEditAsCopy();
    });

    expect(fetchSetLessons).toHaveBeenCalledWith(target);
    // Same convention as CreateLesson's "Als Kopie speichern" (#1740): the
    // fork never reuses the bare id, even though the downloaded original
    // lives under a different `source` and could never literally collide.
    expect(saveUserSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        set_id: "psych-copy",
        title: "Psychologie",
        origin: "imported",
        // #2655 — the fork stamps variation_of on every lesson (ids are
        // never remapped on this path, so the unchanged id IS the
        // original lesson's id).
        lessons: [{ ...lesson("01"), variation_of: "01" }],
        // The source entry carries no attribution/contributed_by in this
        // fixture, so nothing is carried forward.
        attribution: null,
      }),
    );
    expect(onForked).toHaveBeenCalledWith(forked);
    expect(notifySuccess).toHaveBeenCalled();
    // Closes the confirmation after a successful fork.
    expect(hook.result.current.editAsCopyTarget).toBeNull();
  });

  it("#2655 — carries the source set's attribution forward unchanged on fork", async () => {
    const forked = entry({ source: "user-generated", id: "psych-copy", domain: "imported" });
    saveUserSetMock.mockResolvedValue(forked);
    const { hook, fetchSetLessons } = setup();
    const target = entry({
      id: "psych",
      attribution: { author: "Original Author", derived_from: [{ author: "Earlier Author" }] },
    });
    act(() => hook.result.current.requestEditAsCopy(target));

    await act(async () => {
      await hook.result.current.handleConfirmEditAsCopy();
    });

    expect(fetchSetLessons).toHaveBeenCalledWith(target);
    expect(saveUserSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attribution: {
          author: "Original Author",
          derived_from: [{ author: "Earlier Author" }],
        },
      }),
    );
  });

  it("#2655 — synthesizes attribution from a lesson's contributed_by when the source set has none", async () => {
    const forked = entry({ source: "user-generated", id: "psych-copy", domain: "imported" });
    saveUserSetMock.mockResolvedValue(forked);
    const onForked = vi.fn();
    const fetchSetLessons = vi.fn().mockResolvedValue([
      { ...lesson("01"), contributed_by: "Jane Doe" },
    ]);
    const hook = renderHook(() => useEditAsCopy({ fetchSetLessons, onForked }));
    const target = entry({ id: "psych" });
    act(() => hook.result.current.requestEditAsCopy(target));

    await act(async () => {
      await hook.result.current.handleConfirmEditAsCopy();
    });

    expect(saveUserSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attribution: { author: "Jane Doe" },
      }),
    );
  });

  it("escalates to -copy-2 when the learner already forked this set once", async () => {
    listSetsMock.mockResolvedValue({
      sets: [entry({ source: "user-generated", id: "psych-copy" })],
    });
    saveUserSetMock.mockResolvedValue(
      entry({ source: "user-generated", id: "psych-copy-2", domain: "imported" }),
    );
    const { hook } = setup();
    act(() => hook.result.current.requestEditAsCopy(entry({ id: "psych" })));

    await act(async () => {
      await hook.result.current.handleConfirmEditAsCopy();
    });

    expect(saveUserSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ set_id: "psych-copy-2" }),
    );
  });

  it("keeps the confirm target open and surfaces an error when the save fails", async () => {
    saveUserSetMock.mockRejectedValue(new Error("disk full"));
    const { hook, onForked } = setup();
    const target = entry();
    act(() => hook.result.current.requestEditAsCopy(target));

    await act(async () => {
      await hook.result.current.handleConfirmEditAsCopy();
    });

    expect(notifyError).toHaveBeenCalled();
    expect(onForked).not.toHaveBeenCalled();
    expect(hook.result.current.editAsCopyTarget).toBe(target);
  });
});
