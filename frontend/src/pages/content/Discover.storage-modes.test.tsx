/**
 * EXP-048 Stufe 1 — both storage modes, one test each.
 *
 * Discovery reads the search index (``fetchAllIndices``) the SAME way in both
 * modes; the storage backing (``getStorage()``) is used only for the
 * downloaded-set list and the download itself. This file proves the Stufe-1
 * surface (Durchsichtsstand badge + facet, target-language facet, active-filter
 * marks) renders and the download routes through the mode's own
 * ``contentLoader`` in BOTH the API (server/SQLite) and Dexie (IndexedDB,
 * GH-Pages, no backend) backings — so no mode-specific path can silently
 * diverge (the exact gap lessons/content-storage.md warns about).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Discover from "./Discover";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";

const fetchAllIndicesMock = vi.fn();

// Two independent contentLoader backings — same IStorageService surface, one
// per storage mode — so a test can prove the download reaches the RIGHT one.
const backings = vi.hoisted(() => ({
  api: {
    listSets: vi.fn(),
    downloadSet: vi.fn(),
    deleteSet: vi.fn(),
  },
  dexie: {
    listSets: vi.fn(),
    downloadSet: vi.fn(),
    deleteSet: vi.fn(),
  },
  current: "api" as "api" | "dexie",
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "de" }),
}));
vi.mock("../../lib/content/language/language-names", () => ({
  languageDisplayName: (code: string) => code.toUpperCase(),
}));
vi.mock("../../lib/content/repos/discover-repos", () => ({
  collectDiscoveryRepos: vi.fn(async () => [{ url: "owner/repo", branch: "main" }]),
}));
vi.mock("../../lib/content/repos/search-index-loader", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/repos/search-index-loader")>()),
  fetchAllIndices: (...args: unknown[]) => fetchAllIndicesMock(...args),
}));
vi.mock("../../storage", () => ({
  getStorage: () => ({ contentLoader: backings[backings.current] }),
}));
vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

function makeSet(over: Partial<SearchableSet>): SearchableSet {
  return {
    id: "ja-a1",
    name: "Japanisch A1",
    description: "",
    source_language: "de",
    target_language: "ja",
    level: "a1",
    domain: "language",
    lesson_count: 12,
    card_count: 200,
    tags: [],
    ai_validated: false,
    trust_level: 3,
    book: null,
    updated_at: null,
    repo_url: "owner/repo",
    repo_name: "owner/repo",
    review_status: "generated",
    ...over,
  };
}

function renderDiscover() {
  return render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  );
}

describe.each(["api", "dexie"] as const)(
  "Discover Stufe-1 surface in %s storage mode",
  (mode) => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      localStorage.setItem("adaptive-learner.content_view_mode", "grid");
      backings.current = mode;
      backings[mode].listSets.mockResolvedValue({ sets: [], sources: [] });
      backings[mode].downloadSet.mockResolvedValue({});
      fetchAllIndicesMock.mockResolvedValue([
        makeSet({ id: "ja-a1", name: "Japanisch A1", target_language: "ja", review_status: "generated" }),
        makeSet({ id: "es-a1", name: "Spanisch A1", target_language: "es", review_status: "authored" }),
      ]);
    });

    it("renders the review badge + target facet and downloads via this mode's contentLoader", async () => {
      renderDiscover();
      await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());

      // Durchsichtsstand badge reaches the card (identical in both modes).
      expect(screen.getByTestId("discover-card-ja-a1-review")).toHaveAttribute(
        "data-review",
        "generated",
      );
      expect(screen.queryByTestId("discover-card-es-a1-review")).toBeNull();
      // Target-language facet is present.
      expect(screen.getByTestId("discover-target-filter")).toBeInTheDocument();

      // The download routes through THIS mode's backing, and not the other's.
      fireEvent.click(screen.getByTestId("discover-card-ja-a1-download"));
      await waitFor(() =>
        expect(backings[mode].downloadSet).toHaveBeenCalledWith(
          "owner/repo",
          "ja-a1",
          expect.any(Function),
        ),
      );
      const other = mode === "api" ? "dexie" : "api";
      expect(backings[other].downloadSet).not.toHaveBeenCalled();
    });

    it("applies the entry preset (language vs knowledge) identically in this mode", async () => {
      fetchAllIndicesMock.mockResolvedValue([
        makeSet({ id: "es-a1", name: "Spanisch A1", target_language: "es", domain: "language" }),
        makeSet({ id: "psy", name: "Psychologie", source_language: "de", target_language: "de", domain: "psychology" }),
      ]);
      renderDiscover();
      // Default entry "language" shows only the language pair, in both modes.
      await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
      expect(screen.getByText("Spanisch A1")).toBeInTheDocument();
      expect(screen.queryByText("Psychologie")).toBeNull();
      // Switching to the knowledge entry shows the knowledge set instead.
      fireEvent.click(screen.getByTestId("discover-entry-filter"));
      fireEvent.click(screen.getByTestId("discover-entry-filter-knowledge"));
      await waitFor(() => expect(screen.getByText("Psychologie")).toBeInTheDocument());
      expect(screen.queryByText("Spanisch A1")).toBeNull();
    });

    it("offers the language-pair matrix and presets both axes on selection, in this mode (EXP-048 #2337)", async () => {
      renderDiscover();
      await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
      // Two populated pairs (de→ja, de→es) => the matrix is shown; no pair is
      // active until one is chosen.
      expect(screen.getByTestId("discover-pair-matrix")).toBeInTheDocument();
      expect(screen.getByTestId("discover-pair-matrix-de-es")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      // Selecting de→es presets both language axes at once: only Spanisch A1 stays.
      fireEvent.click(screen.getByTestId("discover-pair-matrix-de-es"));
      await waitFor(() =>
        expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
      );
      expect(screen.getByText("Spanisch A1")).toBeInTheDocument();
      expect(screen.queryByText("Japanisch A1")).toBeNull();
      expect(screen.getByTestId("discover-pair-matrix-de-es")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  },
);
