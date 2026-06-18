/** Tests for the EXP-034 / DIS-07 "Available" Content-Browser search group. */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AvailableContentResults from "./AvailableContentResults";
import type { SearchableSet } from "../../lib/content/search-index-loader";

const fetchAllIndicesMock = vi.fn();
const downloadSetMock = vi.fn();

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "en" }),
}));

vi.mock("../../lib/content/discover-repos", () => ({
  collectDiscoveryRepos: vi.fn(async () => [{ url: "owner/repo", branch: "main" }]),
}));

vi.mock("../../lib/content/search-index-loader", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/search-index-loader")>()),
  fetchAllIndices: (...args: unknown[]) => fetchAllIndicesMock(...args),
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({ contentLoader: { downloadSet: downloadSetMock } }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

function makeSet(over: Partial<SearchableSet>): SearchableSet {
  return {
    id: "es-a1",
    name: "Spanish A1",
    description: "",
    source_language: "de",
    target_language: "es",
    level: "a1",
    domain: "language",
    lesson_count: 15,
    card_count: 450,
    tags: [],
    ai_validated: false,
    trust_level: 0,
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
    makeSet({ id: "fr-a1", name: "French A1", target_language: "fr" }),
  ]);
});

describe("AvailableContentResults", () => {
  it("renders nothing for a too-short query", async () => {
    const { container } = render(
      <AvailableContentResults query="a" downloadedSets={[]} onDownloaded={() => {}} />,
    );
    await waitFor(() => expect(fetchAllIndicesMock).toHaveBeenCalled());
    expect(container.querySelector("[data-testid='content-available-results']")).toBeNull();
  });

  it("lists index sets matching the query that are not downloaded", async () => {
    render(
      <AvailableContentResults query="French" downloadedSets={[]} onDownloaded={() => {}} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("content-available-results")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("content-available-results-set-fr-a1")).toBeInTheDocument();
    expect(screen.queryByTestId("content-available-results-set-es-a1")).toBeNull();
  });

  it("excludes already-downloaded sets from the available group", async () => {
    render(
      <AvailableContentResults
        query="Spanish"
        downloadedSets={[{ source: "owner/repo", id: "es-a1", cached_version: "1.0.0" }]}
        onDownloaded={() => {}}
      />,
    );
    // es-a1 matches the query but is downloaded → no available results → null.
    await waitFor(() => expect(fetchAllIndicesMock).toHaveBeenCalled());
    expect(screen.queryByTestId("content-available-results")).toBeNull();
  });

  it("prompts then downloads on confirm, calling onDownloaded", async () => {
    downloadSetMock.mockResolvedValue({});
    const onDownloaded = vi.fn();
    render(
      <AvailableContentResults query="French" downloadedSets={[]} onDownloaded={onDownloaded} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("content-available-results-download-fr-a1")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("content-available-results-download-fr-a1"));
    // Prompt opens.
    await waitFor(() =>
      expect(screen.getByTestId("content-available-results-dialog-confirm")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("content-available-results-dialog-confirm"));
    await waitFor(() => expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "fr-a1"));
    await waitFor(() => expect(onDownloaded).toHaveBeenCalled());
  });
});
