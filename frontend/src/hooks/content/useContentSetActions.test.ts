/**
 * useContentSetActions (#896) — the downloaded-set delete + status flow
 * (#1300). Closes the coverage gap noted in #1349: the full
 * confirm-delete path (handler → contentLoader.deleteSet → optimistic list
 * removal) was previously untested, so a broken delete could regress unseen.
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useContentSetActions } from "./useContentSetActions";
import type { ContentSetEntry } from "../../storage/types";

const deleteSetMock = vi.fn();
const setSetStatusMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      deleteSet: (...a: unknown[]) => deleteSetMock(...a),
      setSetStatus: (...a: unknown[]) => setSetStatusMock(...a),
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
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  } as ContentSetEntry;
}

function setup(initial: ContentSetEntry[]) {
  let sets = initial;
  const setSets = vi.fn((updater: unknown) => {
    sets = typeof updater === "function" ? (updater as (p: ContentSetEntry[]) => ContentSetEntry[])(sets) : (updater as ContentSetEntry[]);
  });
  const hook = renderHook(() =>
    useContentSetActions({
      navigate: vi.fn(),
      setSets: setSets as never,
      setPerSetState: vi.fn() as never,
    }),
  );
  return { hook, setSets, getSets: () => sets };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleConfirmDeleteSet (#1349)", () => {
  it("calls contentLoader.deleteSet(source, id) and removes the row from the list", async () => {
    deleteSetMock.mockResolvedValue(undefined);
    const target = entry({ id: "psych", source: "owner/repo" });
    const other = entry({ id: "keep", source: "owner/repo" });
    const { hook, getSets } = setup([target, other]);

    act(() => hook.result.current.setDeleteSetTarget(target));
    await act(async () => {
      await hook.result.current.handleConfirmDeleteSet();
    });

    expect(deleteSetMock).toHaveBeenCalledWith("owner/repo", "psych");
    // Optimistic removal keeps every OTHER set.
    const remaining = getSets().map((s) => s.id);
    expect(remaining).toEqual(["keep"]);
  });

  it("keeps the row (and re-opens nothing) when the delete throws", async () => {
    deleteSetMock.mockRejectedValue(new Error("boom"));
    const target = entry({ id: "psych" });
    const { hook, getSets } = setup([target]);
    act(() => hook.result.current.setDeleteSetTarget(target));
    await act(async () => {
      await hook.result.current.handleConfirmDeleteSet();
    });
    // A failed delete must NOT drop the row from the list.
    expect(getSets().map((s) => s.id)).toEqual(["psych"]);
  });

  it("bulk status change persists via setSetStatus for the set", async () => {
    setSetStatusMock.mockResolvedValue(undefined);
    const target = entry({ id: "psych" });
    const { hook } = setup([target]);
    await act(async () => {
      await hook.result.current.handleSetStatus(target, "deferred");
    });
    await waitFor(() =>
      expect(setSetStatusMock).toHaveBeenCalledWith("owner/repo", "psych", "deferred"),
    );
  });
});
