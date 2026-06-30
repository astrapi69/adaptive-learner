/**
 * Tests for the Discover ("Inhalte entdecken") page (EXP-034 / DIS-05).
 *
 * Renders against mocked discovery-repo assembly + index loader + storage so
 * neither the network nor Dexie runs. Pins: loading → results, the
 * already-downloaded badge, filtering, the empty-results state, and that the
 * download button calls ``contentLoader.downloadSet(repo_url, id)``.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Discover from "./Discover";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";

const fetchAllIndicesMock = vi.fn();
const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();
const deleteSetMock = vi.fn();

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "en" }),
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
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      deleteSet: deleteSetMock,
    },
  }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

function makeSet(over: Partial<SearchableSet>): SearchableSet {
  return {
    id: "es-a1",
    name: "Spanish A1",
    description: "Basics",
    source_language: "de",
    target_language: "es",
    level: "a1",
    domain: "language",
    lesson_count: 15,
    card_count: 450,
    tags: [],
    ai_validated: true,
    trust_level: 3,
    book: null,
    updated_at: null,
    repo_url: "owner/repo",
    repo_name: "owner/repo",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // #1262 — the global content-view default is now "list" (#1257). These
  // tests assert the card GRID, so pin grid; the list view + default are
  // covered by the dedicated tests below.
  localStorage.setItem("adaptive-learner.content_view_mode", "grid");
  fetchAllIndicesMock.mockResolvedValue([
    makeSet({ id: "es-a1", name: "Spanish A1", target_language: "es" }),
    makeSet({ id: "fr-a1", name: "French A1", target_language: "fr", lesson_count: 10 }),
  ]);
  listSetsMock.mockResolvedValue({ sets: [], sources: [] });
});

function renderDiscover() {
  return render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  );
}

describe("Discover page", () => {
  it("loads indices and renders one card per set", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    expect(screen.getByText("Spanish A1")).toBeInTheDocument();
    expect(screen.getByText("French A1")).toBeInTheDocument();
    expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets");
  });

  it("marks an already-downloaded set with the present badge", async () => {
    listSetsMock.mockResolvedValue({
      sets: [{ source: "owner/repo", id: "es-a1", cached_version: "1.0.0" }],
      sources: [],
    });
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    expect(screen.getByTestId("discover-card-es-a1-downloaded")).toBeInTheDocument();
    // The other set is still downloadable.
    expect(screen.getByTestId("discover-card-fr-a1-download")).toBeInTheDocument();
  });

  it("downloads a set via contentLoader.downloadSet(repo_url, id)", async () => {
    downloadSetMock.mockResolvedValue({});
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-card-fr-a1-download"));
    await waitFor(() =>
      expect(downloadSetMock).toHaveBeenCalledWith(
        "owner/repo",
        "fr-a1",
        expect.any(Function),
      ),
    );
    // After success the card flips to the present badge.
    await waitFor(() =>
      expect(screen.getByTestId("discover-card-fr-a1-downloaded")).toBeInTheDocument(),
    );
    // A per-lesson progress callback was threaded into downloadSet (DIS-06).
    expect(typeof downloadSetMock.mock.calls[0][2]).toBe("function");
  });

  it("shows a 'Go to Content Browser' link only after a download (#772)", async () => {
    downloadSetMock.mockResolvedValue({});
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // No back-link before any download.
    expect(screen.queryByTestId("discover-to-content")).toBeNull();
    fireEvent.click(screen.getByTestId("discover-card-fr-a1-download"));
    await waitFor(() =>
      expect(screen.getByTestId("discover-to-content")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("discover-to-content").querySelector("a")).toHaveAttribute(
      "href",
      "/content?tab=my",
    );
  });

  it("removes a downloaded set via deleteSet, keeping it re-downloadable", async () => {
    deleteSetMock.mockResolvedValue(undefined);
    listSetsMock.mockResolvedValue({
      sets: [{ source: "owner/repo", id: "es-a1", cached_version: "1.0.0" }],
      sources: [],
    });
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    expect(screen.getByTestId("discover-card-es-a1-downloaded")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("discover-card-es-a1-remove"));
    await waitFor(() => expect(deleteSetMock).toHaveBeenCalledWith("owner/repo", "es-a1"));
    // The set returns to a downloadable state (index entry stays).
    await waitFor(() =>
      expect(screen.getByTestId("discover-card-es-a1-download")).toBeInTheDocument(),
    );
  });

  it("filters by the search field (debounced) and shows the no-results state", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("discover-search"), {
      target: { value: "zzzznomatch" },
    });
    await waitFor(
      () => expect(screen.getByTestId("discover-empty-results")).toBeInTheDocument(),
      { timeout: 1000 },
    );
  });

  it("filters down to a single set on a matching query", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("discover-search"), { target: { value: "French" } });
    await waitFor(
      () => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
      { timeout: 1000 },
    );
    expect(screen.getByText("French A1")).toBeInTheDocument();
    expect(screen.queryByText("Spanish A1")).toBeNull();
  });

  it("shows the no-content empty state when no indices return sets", async () => {
    fetchAllIndicesMock.mockResolvedValue([]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-empty-none")).toBeInTheDocument());
  });

  // --- #1246: compact Search/Filter toggle bar ---

  it("keeps the filters collapsed by default, showing only the search field", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // Both toggle buttons + the search field are present.
    expect(screen.getByTestId("discover-search-filter-search-btn")).toBeInTheDocument();
    expect(screen.getByTestId("discover-search-filter-filter-btn")).toBeInTheDocument();
    expect(screen.getByTestId("discover-search")).toBeInTheDocument();
    // The filter dropdowns take no space until requested.
    expect(screen.queryByTestId("discover-filters")).toBeNull();
    expect(screen.getByTestId("discover-search-filter-filter-btn")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the filters with their current values when 'Filter' is clicked", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    // Filters now visible; defaults reflect the active (empty = All) values.
    expect(screen.getByTestId("discover-filters")).toBeInTheDocument();
    expect(screen.getByTestId("discover-filters-language")).toHaveValue("");
    // Mutual exclusion: the search field is hidden while filtering.
    expect(screen.queryByTestId("discover-search")).toBeNull();
  });

  it("a chosen filter keeps narrowing the list after the panel collapses", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    // Open filters and narrow to Spanish (target=es).
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    fireEvent.change(screen.getByTestId("discover-filters-language"), {
      target: { value: "es" },
    });
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    // Collapse the panel via 'Search' — the filter stays applied.
    fireEvent.click(screen.getByTestId("discover-search-filter-search-btn"));
    expect(screen.queryByTestId("discover-filters")).toBeNull();
    expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets");
    expect(screen.getByText("Spanish A1")).toBeInTheDocument();
    expect(screen.queryByText("French A1")).toBeNull();
    // The search field is back and still runs prompt (debounced) search.
    fireEvent.change(screen.getByTestId("discover-search"), { target: { value: "zzzznomatch" } });
    await waitFor(
      () => expect(screen.getByTestId("discover-empty-results")).toBeInTheDocument(),
      { timeout: 1000 },
    );
  });

  // --- #1251: info button replaces the permanent subtitle ---

  it("hides the subtitle behind an info button and reveals the Discover-specific text on click", async () => {
    localStorage.clear();
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // The explanatory subtitle is NOT permanently shown.
    expect(screen.queryByTestId("discover-info-text")).toBeNull();
    const button = screen.getByTestId("discover-info-button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    // A fresh visitor sees the gentle blink.
    expect(button).toHaveAttribute("data-blink", "true");
    // Click -> the Discover-specific text expands inline.
    fireEvent.click(button);
    expect(screen.getByTestId("discover-info-text")).toHaveTextContent(
      "Find learning material before you download it.",
    );
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).not.toHaveAttribute("data-blink", "true");
    localStorage.clear();
  });

  // --- #1262: grid/list view toggle (global preference) ---

  it("renders the grid/list toggle and switches between grid and list", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // Seeded grid (beforeEach): the card grid is shown.
    expect(screen.getByTestId("discover-results")).toBeInTheDocument();
    expect(screen.getByTestId("content-view-toggle")).toBeInTheDocument();

    // Switch to the list view.
    fireEvent.click(screen.getByTestId("content-view-list"));
    await waitFor(() => expect(screen.getByTestId("discover-list-view")).toBeInTheDocument());
    expect(screen.queryByTestId("discover-results")).toBeNull();
    // The toggle writes the shared global preference.
    expect(localStorage.getItem("adaptive-learner.content_view_mode")).toBe("list");

    // ...and back to grid.
    fireEvent.click(screen.getByTestId("content-view-grid"));
    await waitFor(() => expect(screen.getByTestId("discover-results")).toBeInTheDocument());
    expect(screen.queryByTestId("discover-list-view")).toBeNull();
  });

  it("defaults to the list view for a fresh user (#1257)", async () => {
    localStorage.clear();
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    expect(screen.getByTestId("discover-list-view")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-results")).toBeNull();
    expect(screen.getByTestId("content-view-list")).toHaveAttribute("aria-pressed", "true");
  });

  it("list rows show the language code for a language set, only the title for a knowledge set", async () => {
    localStorage.setItem("adaptive-learner.content_view_mode", "list");
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "es-a1", name: "Spanish A1", source_language: "de", target_language: "es" }),
      makeSet({
        id: "psy-1",
        name: "Psychology 101",
        domain: "psychology",
        source_language: "de",
        target_language: "de",
      }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-list-view")).toBeInTheDocument());
    // Language set: shows the de→es code.
    expect(screen.getByTestId("discover-list-es-a1-langs")).toHaveTextContent("de→es");
    // Knowledge set: title only, no language code.
    expect(screen.getByText("Psychology 101")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-list-psy-1-langs")).toBeNull();
  });

  it("downloads a set from the list row", async () => {
    localStorage.setItem("adaptive-learner.content_view_mode", "list");
    downloadSetMock.mockResolvedValue({});
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-list-view")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-list-fr-a1-download"));
    await waitFor(() =>
      expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "fr-a1", expect.any(Function)),
    );
    await waitFor(() =>
      expect(screen.getByTestId("discover-list-fr-a1-downloaded")).toBeInTheDocument(),
    );
  });
});
