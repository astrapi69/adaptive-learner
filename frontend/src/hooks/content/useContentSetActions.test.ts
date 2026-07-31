/**
 * useContentSetActions (#896) — the downloaded-set delete + status flow
 * (#1300). Closes the coverage gap noted in #1349: the full
 * confirm-delete path (handler → contentLoader.deleteSet → optimistic list
 * removal) was previously untested, so a broken delete could regress unseen.
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useContentSetActions } from "./useContentSetActions";
import {
  dismissSet,
  isDismissedSet,
} from "../../lib/content/browse/dismissed-sets";
import { getSetStatus } from "../../lib/content/browse/set-status-store";
import type { ContentSetEntry } from "../../storage/types";

const deleteSetMock = vi.fn();
const deleteSetsMock = vi.fn();
const downloadSetMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      deleteSet: (...a: unknown[]) => deleteSetMock(...a),
      deleteSets: (...a: unknown[]) => deleteSetsMock(...a),
      downloadSet: (...a: unknown[]) => downloadSetMock(...a),
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
  localStorage.clear();
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

  it("persists a status change to the mode-agnostic store + optimistic list", () => {
    const target = entry({ id: "psych" });
    const { hook, getSets } = setup([target]);
    act(() => {
      hook.result.current.handleSetStatus(target, "deferred");
    });
    // Persisted to the browser-local store (works in BOTH storage modes —
    // the prior storage-layer call was a no-op in API mode).
    expect(getSetStatus("owner/repo", "psych")).toBe("deferred");
    // Optimistic list update.
    expect(getSets().find((s) => s.id === "psych")?.status).toBe("deferred");
  });
});

describe("bulk actions (#1351)", () => {
  it("handleBulkSetStatus persists ALL selected to the store + optimistic map", () => {
    const a = entry({ id: "a" });
    const b = entry({ id: "b" });
    const c = entry({ id: "c" });
    const { hook, getSets } = setup([a, b, c]);
    act(() => {
      hook.result.current.handleBulkSetStatus([a, b], "completed");
    });
    // Both selected sets persisted; the unselected one untouched.
    expect(getSetStatus("owner/repo", "a")).toBe("completed");
    expect(getSetStatus("owner/repo", "b")).toBe("completed");
    expect(getSetStatus("owner/repo", "c")).toBeNull();
    // Optimistic: only the selected rows changed status.
    const byId = Object.fromEntries(getSets().map((s) => [s.id, s.status]));
    expect(byId.a).toBe("completed");
    expect(byId.b).toBe("completed");
    expect(byId.c).not.toBe("completed");
  });

  it("handleConfirmBulkDelete deletes ALL targets in ONE batched call + removes them", async () => {
    deleteSetsMock.mockResolvedValue(undefined);
    const a = entry({ id: "a" });
    const b = entry({ id: "b" });
    const c = entry({ id: "c" });
    const { hook, getSets } = setup([a, b, c]);
    act(() => hook.result.current.setBulkDeleteTargets([a, c]));
    await act(async () => {
      await hook.result.current.handleConfirmBulkDelete();
    });
    expect(deleteSetsMock).toHaveBeenCalledTimes(1);
    expect(deleteSetsMock).toHaveBeenCalledWith([
      { source: "owner/repo", setId: "a" },
      { source: "owner/repo", setId: "c" },
    ]);
    // Both removed; the unselected one is kept (progress lives elsewhere).
    expect(getSets().map((s) => s.id)).toEqual(["b"]);
  });
});

describe("handleEditUserSet dispatch (#1740)", () => {
  function setupWithNavigate() {
    const navigate = vi.fn();
    const hook = renderHook(() =>
      useContentSetActions({
        navigate: navigate as never,
        setSets: vi.fn() as never,
        setPerSetState: vi.fn() as never,
      }),
    );
    return { hook, navigate };
  }

  it("routes an analysis-origin set back to its import page", () => {
    const { hook, navigate } = setupWithNavigate();
    const target = entry({
      source: "user-generated",
      id: "analysis-abc123",
      domain: "analysis",
    });
    act(() => hook.result.current.handleEditUserSet(target));
    expect(navigate).toHaveBeenCalledWith("/import/abc123");
  });

  it("routes a created/imported set to the pre-filled Lesson Creator", () => {
    const { hook, navigate } = setupWithNavigate();
    const target = entry({
      source: "user-generated",
      id: "created-my-lesson",
      domain: "imported",
    });
    act(() => hook.result.current.handleEditUserSet(target));
    expect(navigate).toHaveBeenCalledWith(
      "/create-lesson/edit/user-generated/created-my-lesson",
    );
  });

  it("targets a specific lesson via ?lesson= when a filename is passed (#2210)", () => {
    const { hook, navigate } = setupWithNavigate();
    const target = entry({
      source: "user-generated",
      id: "created-my-book",
      domain: "imported",
    });
    act(() => hook.result.current.handleEditUserSet(target, "kapitel-2.json"));
    expect(navigate).toHaveBeenCalledWith(
      "/create-lesson/edit/user-generated/created-my-book?lesson=kapitel-2.json",
    );
  });

  it("url-encodes the lesson filename in the query", () => {
    const { hook, navigate } = setupWithNavigate();
    const target = entry({
      source: "user-generated",
      id: "created-my-book",
      domain: "imported",
    });
    act(() => hook.result.current.handleEditUserSet(target, "kapitel 2.json"));
    expect(navigate).toHaveBeenCalledWith(
      "/create-lesson/edit/user-generated/created-my-book?lesson=kapitel%202.json",
    );
  });

  it("url-encodes the source and set id in the edit route", () => {
    const { hook, navigate } = setupWithNavigate();
    const target = entry({
      source: "user-generated",
      id: "created-a b/c",
      domain: "adaptive",
    });
    act(() => hook.result.current.handleEditUserSet(target));
    expect(navigate).toHaveBeenCalledWith(
      "/create-lesson/edit/user-generated/created-a%20b%2Fc",
    );
  });
});

describe("dismissal on delete/download (#1709)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("handleConfirmDeleteSet records the dismissal so Refresh keeps it deleted", async () => {
    deleteSetMock.mockResolvedValue(undefined);
    const target = entry({ id: "psych", source: "owner/repo" });
    const { hook } = setup([target]);
    act(() => hook.result.current.setDeleteSetTarget(target));
    await act(async () => {
      await hook.result.current.handleConfirmDeleteSet();
    });
    expect(isDismissedSet("owner/repo", "psych")).toBe(true);
  });

  it("a FAILED delete records no dismissal (the set is still there)", async () => {
    deleteSetMock.mockRejectedValue(new Error("boom"));
    const target = entry({ id: "psych", source: "owner/repo" });
    const { hook } = setup([target]);
    act(() => hook.result.current.setDeleteSetTarget(target));
    await act(async () => {
      await hook.result.current.handleConfirmDeleteSet();
    });
    expect(isDismissedSet("owner/repo", "psych")).toBe(false);
  });

  it("handleConfirmBulkDelete records a dismissal for EVERY target", async () => {
    deleteSetsMock.mockResolvedValue(undefined);
    const a = entry({ id: "a" });
    const c = entry({ id: "c" });
    const { hook } = setup([a, c]);
    act(() => hook.result.current.setBulkDeleteTargets([a, c]));
    await act(async () => {
      await hook.result.current.handleConfirmBulkDelete();
    });
    expect(isDismissedSet("owner/repo", "a")).toBe(true);
    expect(isDismissedSet("owner/repo", "c")).toBe(true);
  });

  it("handleDownload clears a stale dismissal (re-download revives the set)", async () => {
    const target = entry({ id: "psych", source: "owner/repo" });
    downloadSetMock.mockResolvedValue(entry({ id: "psych", cached_version: "1.0.0" }));
    dismissSet("owner/repo", "psych");
    const { hook } = setup([target]);
    await act(async () => {
      await hook.result.current.handleDownload(target);
    });
    expect(isDismissedSet("owner/repo", "psych")).toBe(false);
  });
});
