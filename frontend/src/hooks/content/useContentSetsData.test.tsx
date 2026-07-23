/**
 * useContentSetsData (#1709) — reproduction + regression pins for the
 * "Refresh restores deleted sets" bug.
 *
 * ``loadSets`` re-reads the full source catalogue, so a set the user
 * explicitly deleted came back on every Refresh (bundled sets can never be
 * purged from the build, and repo sets are re-advertised by the manifest).
 * The fix: a deleted set is recorded as *dismissed* (lib/content/repos/
 * dismissed-sets) and is filtered out of "Meine Inhalte" while it is not
 * cached; a cached (re-downloaded) set always wins over the record, and
 * never-dismissed catalogue entries keep appearing so the Refresh's sync
 * purpose (new sets show up) stays intact.
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useContentSetsData } from "./useContentSetsData";
import { dismissSet } from "../../lib/content/browse/dismissed-sets";
import type { ContentSetEntry } from "../../storage/types";

const listSetsMock = vi.fn();
const getAiValidationCacheMock = vi.fn(async (..._a: unknown[]) => null);

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: (...a: unknown[]) => listSetsMock(...a),
      getAiValidationCache: (...a: unknown[]) => getAiValidationCacheMock(...a),
    },
  }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "de" }),
}));

vi.mock("../../lib/content/repos/content-repos", () => ({
  readUserRepos: vi.fn(async () => []),
  userRepoSource: (owner: string, repo: string) => `${owner}/${repo}`,
}));

vi.mock("../../lib/content/repos/recommended-repos", () => ({
  fetchRecommendedRepos: vi.fn(async () => []),
  recommendedSource: () => null,
}));

vi.mock("../../lib/content/media/book-recommendations", () => ({
  fetchBookRecommendations: vi.fn(async () => ({})),
}));

vi.mock("../../lib/content/media/media-loader", () => ({
  fetchMediaResources: vi.fn(async () => []),
}));

vi.mock("../../lib/content/media/book-companion", () => ({
  fetchBookCompanion: vi.fn(async () => null),
  isFetchableSource: () => false,
}));

vi.mock("../../lib/content/placement/contribution-history", () => ({
  listContributions: () => [],
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: "es-a1-from-de",
    title: "Spanisch A1",
    language: "es",
    target_language: "es",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 15,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  } as ContentSetEntry;
}

describe("useContentSetsData — dismissed sets stay deleted across Refresh (#1709)", () => {
  beforeEach(() => {
    localStorage.clear();
    listSetsMock.mockReset();
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
  });

  it("filters a dismissed, uncached set out of the list (deleted stays deleted)", async () => {
    const deleted = entry({ id: "es-a1-from-de", cached_version: null });
    listSetsMock.mockResolvedValue({ sets: [deleted], sources: [] });
    dismissSet(deleted.source, deleted.id);

    const { result } = renderHook(() => useContentSetsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sets).toEqual([]);
  });

  it("keeps a NEW catalogue set visible (Refresh still surfaces new sets)", async () => {
    const fresh = entry({ id: "fr-a1-from-de", cached_version: null });
    listSetsMock.mockResolvedValue({ sets: [fresh], sources: [] });

    const { result } = renderHook(() => useContentSetsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sets.map((s) => s.id)).toEqual(["fr-a1-from-de"]);
  });

  it("a re-downloaded (cached) set wins over its old dismissal record", async () => {
    const revived = entry({ id: "es-a1-from-de", cached_version: "1.0.0" });
    listSetsMock.mockResolvedValue({ sets: [revived], sources: [] });
    dismissSet(revived.source, revived.id);

    const { result } = renderHook(() => useContentSetsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sets.map((s) => s.id)).toEqual(["es-a1-from-de"]);
  });

  it("stays filtered on an explicit Refresh (handleRefresh re-runs loadSets)", async () => {
    const deleted = entry({ id: "es-a1-from-de", cached_version: null });
    const fresh = entry({ id: "fr-a1-from-de", cached_version: null });
    listSetsMock.mockResolvedValue({ sets: [deleted, fresh], sources: [] });
    dismissSet(deleted.source, deleted.id);

    const { result } = renderHook(() => useContentSetsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleRefresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(result.current.sets.map((s) => s.id)).toEqual(["fr-a1-from-de"]);
  });

  it("filters a set the manifest marks visibility: hidden out of My Content (#1707)", async () => {
    const hidden = entry({
      id: "graded-quiz-demo-from-de",
      cached_version: "1.0.0",
      visibility: "hidden",
    });
    const visible = entry({ id: "fr-a1-from-de", visibility: "visible" });
    const noField = entry({ id: "es-a1-from-de", visibility: undefined });
    listSetsMock.mockResolvedValue({
      sets: [hidden, visible, noField],
      sources: [],
    });

    const { result } = renderHook(() => useContentSetsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The hidden fixture is dropped even though it is cached; a visible set and
    // a set with no visibility field (absent ⇒ visible) both survive.
    expect(result.current.sets.map((s) => s.id).sort()).toEqual([
      "es-a1-from-de",
      "fr-a1-from-de",
    ]);
  });
});
