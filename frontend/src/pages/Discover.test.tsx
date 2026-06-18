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
import { beforeEach, describe, expect, it, vi } from "vitest";

import Discover from "./Discover";
import type { SearchableSet } from "../lib/content/search-index-loader";

const fetchAllIndicesMock = vi.fn();
const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();
const deleteSetMock = vi.fn();

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "en" }),
}));

vi.mock("../lib/content/language-names", () => ({
  languageDisplayName: (code: string) => code.toUpperCase(),
}));

vi.mock("../lib/content/discover-repos", () => ({
  collectDiscoveryRepos: vi.fn(async () => [{ url: "owner/repo", branch: "main" }]),
}));

vi.mock("../lib/content/search-index-loader", async (orig) => ({
  ...(await orig<typeof import("../lib/content/search-index-loader")>()),
  fetchAllIndices: (...args: unknown[]) => fetchAllIndicesMock(...args),
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      deleteSet: deleteSetMock,
    },
  }),
}));

vi.mock("../utils/notify", () => ({
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
  fetchAllIndicesMock.mockResolvedValue([
    makeSet({ id: "es-a1", name: "Spanish A1", target_language: "es" }),
    makeSet({ id: "fr-a1", name: "French A1", target_language: "fr", lesson_count: 10 }),
  ]);
  listSetsMock.mockResolvedValue({ sets: [], sources: [] });
});

describe("Discover page", () => {
  it("loads indices and renders one card per set", async () => {
    render(<Discover />);
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
    render(<Discover />);
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    expect(screen.getByTestId("discover-card-es-a1-downloaded")).toBeInTheDocument();
    // The other set is still downloadable.
    expect(screen.getByTestId("discover-card-fr-a1-download")).toBeInTheDocument();
  });

  it("downloads a set via contentLoader.downloadSet(repo_url, id)", async () => {
    downloadSetMock.mockResolvedValue({});
    render(<Discover />);
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

  it("removes a downloaded set via deleteSet, keeping it re-downloadable", async () => {
    deleteSetMock.mockResolvedValue(undefined);
    listSetsMock.mockResolvedValue({
      sets: [{ source: "owner/repo", id: "es-a1", cached_version: "1.0.0" }],
      sources: [],
    });
    render(<Discover />);
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
    render(<Discover />);
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
    render(<Discover />);
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
    render(<Discover />);
    await waitFor(() => expect(screen.getByTestId("discover-empty-none")).toBeInTheDocument());
  });
});
