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
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Discover from "./Discover";
import { PAGE_CONTAINER_CLASSES } from "../../shared/layout/PageContainer";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";

const fetchAllIndicesMock = vi.fn();
const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();
const deleteSetMock = vi.fn();

// Mutable UI locale so a test can simulate the learner switching UI language
// (the source-language default follows it — #1343).
const i18n = vi.hoisted(() => ({ lang: "de" }));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: i18n.lang }),
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
    review_status: "authored",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  i18n.lang = "de"; // reset the mutable UI locale between tests

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

  it("opens the secondary filters when 'Filter' is clicked", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    // Filters now visible. The source-language facet no longer lives inside the
    // collapsible panel (#1699 — it is an always-visible chip); the secondary
    // facets (level/domain/…) still do.
    expect(screen.getByTestId("discover-filters")).toBeInTheDocument();
    expect(screen.getByTestId("discover-filters-level")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-filters-sourceLanguage")).toBeNull();
    // Mutual exclusion: the search field is hidden while filtering.
    expect(screen.queryByTestId("discover-search")).toBeNull();
  });

  it("narrows by the always-visible source-language chip (#1699)", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "de-es", name: "Spanish A1", source_language: "de", target_language: "es" }),
      makeSet({ id: "en-fr", name: "French A1", source_language: "en", target_language: "fr" }),
    ]);
    renderDiscover();
    // Default = UI locale "de" → only the de-source set is shown.
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    expect(screen.getByText("Spanish A1")).toBeInTheDocument();
    expect(screen.queryByText("French A1")).toBeNull();
    // Switch the language via the ALWAYS-VISIBLE chip — no panel to open.
    fireEvent.click(screen.getByTestId("discover-language-filter"));
    fireEvent.click(screen.getByTestId("discover-language-filter-en"));
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    expect(screen.getByText("French A1")).toBeInTheDocument();
    expect(screen.queryByText("Spanish A1")).toBeNull();
    expect(localStorage.getItem("adaptive-learner.discover_source_language")).toBe("en");
  });

  // --- EXP-048 #2324: empty state with exits ---

  it("offers a computed relaxation hint that clears just the blocking facet", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "es-a1", name: "Spanisch A1", source_language: "de", target_language: "es", level: "a1" }),
      makeSet({ id: "es-a2", name: "Spanisch A2", source_language: "de", target_language: "es", level: "a2" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    // Restrict to a target that has no set under de -> impossible via menu, so
    // restrict level to a1 AND search a non-matching string instead.
    fireEvent.change(screen.getByTestId("discover-filters-level"), { target: { value: "a1" } });
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    fireEvent.click(screen.getByTestId("discover-search-filter-search-btn"));
    fireEvent.change(screen.getByTestId("discover-search"), { target: { value: "zzznope" } });
    await waitFor(
      () => expect(screen.getByTestId("discover-empty-results")).toBeInTheDocument(),
      { timeout: 1000 },
    );
    // Clearing the query alone restores the one a1 set.
    const hint = screen.getByTestId("discover-empty-hint-query");
    expect(hint).toHaveTextContent("1");
    fireEvent.click(hint);
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
  });

  it("resets every added filter from the empty state, keeping the source language", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "es", name: "Spanisch", source_language: "de", target_language: "es", level: "a1" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    fireEvent.click(screen.getByTestId("discover-search-filter-search-btn"));
    fireEvent.change(screen.getByTestId("discover-search"), { target: { value: "zzznope" } });
    await waitFor(
      () => expect(screen.getByTestId("discover-empty-results")).toBeInTheDocument(),
      { timeout: 1000 },
    );
    fireEvent.click(screen.getByTestId("discover-empty-reset"));
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    // Source language stayed de (its own axis), so the de set is still shown.
    expect(screen.getByText("Spanisch")).toBeInTheDocument();
  });

  it("points to adding a source / creating a lesson when the library is empty", async () => {
    fetchAllIndicesMock.mockResolvedValue([]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-empty-none")).toBeInTheDocument());
    const pointer = screen.getByTestId("discover-empty-add-source");
    expect(pointer.querySelector('a[href="/add-repo"]')).not.toBeNull();
    expect(pointer.querySelector('a[href="/create-lesson"]')).not.toBeNull();
  });

  // --- EXP-048 #2323: active filters as removable marks ---

  it("shows an active panel facet as a permanently-visible removable mark", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "py", name: "Python", source_language: "de", target_language: "de", domain: "programming", level: "b1" }),
      makeSet({ id: "es", name: "Spanisch", source_language: "de", target_language: "es", domain: "language", level: "a1" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    // Restrict domain via the collapsible panel...
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    fireEvent.change(screen.getByTestId("discover-filters-domain"), {
      target: { value: "programming" },
    });
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    // ...and it appears as a removable mark, visible without the panel — the
    // fallback `t` returns the raw domain id here.
    const mark = screen.getByTestId("discover-active-filters-domain");
    expect(mark).toHaveTextContent("Domain: programming");
    // Removing the mark clears just that restriction.
    fireEvent.click(screen.getByTestId("discover-active-filters-remove-domain"));
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    expect(screen.queryByTestId("discover-active-filters-domain")).toBeNull();
  });

  it("marks an active search query and clears it via its mark", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("discover-search"), { target: { value: "French" } });
    await waitFor(
      () => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
      { timeout: 1000 },
    );
    expect(screen.getByTestId("discover-active-filters-query")).toHaveTextContent("French");
    fireEvent.click(screen.getByTestId("discover-active-filters-remove-query"));
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
  });

  it("shows no active-filter marks when only the source-language default is set", async () => {
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // The source-language default is its own always-visible control (#1699),
    // not a mark; with nothing else set, the marks row is absent.
    expect(screen.queryByTestId("discover-active-filters")).toBeNull();
  });

  // --- EXP-048 #2322: target-language facet ---

  it("filters by the always-visible target-language facet with counts", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "de-es", name: "Spanisch", source_language: "de", target_language: "es" }),
      makeSet({ id: "de-fr", name: "Franzoesisch", source_language: "de", target_language: "fr" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    // The target facet is ALWAYS visible (never behind the collapsible panel).
    expect(screen.getByTestId("discover-target-filter")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-filters")).toBeNull();
    fireEvent.click(screen.getByTestId("discover-target-filter"));
    fireEvent.click(screen.getByTestId("discover-target-filter-es"));
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    expect(screen.getByText("Spanisch")).toBeInTheDocument();
    expect(screen.queryByText("Franzoesisch")).toBeNull();
  });

  it("target options are scoped to the active source language and count-sorted", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "de-es1", source_language: "de", target_language: "es" }),
      makeSet({ id: "de-es2", source_language: "de", target_language: "es" }),
      makeSet({ id: "de-fr", source_language: "de", target_language: "fr" }),
      makeSet({ id: "en-ja", source_language: "en", target_language: "ja" }),
    ]);
    renderDiscover(); // de source default
    await waitFor(() => expect(screen.getByTestId("discover-target-filter")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-target-filter"));
    // ja belongs to an en-source set only, so it is NOT offered under de.
    expect(screen.queryByTestId("discover-target-filter-ja")).toBeNull();
    // es (2) and fr (1) are offered; es outranks fr by count.
    const es = screen.getByTestId("discover-target-filter-es");
    const fr = screen.getByTestId("discover-target-filter-fr");
    expect(es).toHaveTextContent("ES (2)");
    expect(fr).toHaveTextContent("FR (1)");
    expect(es.compareDocumentPosition(fr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // --- EXP-048 #2321: Durchsichtsstand reaches the end of the chain ---

  it("surfaces review_status at the END of the chain: badge on a generated card + the Durchsicht facet", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "ja-a1", name: "Japanisch A1", target_language: "ja", review_status: "generated" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    // The field survives loader → queryDiscoverSets → page → card and is READ
    // by the UI (not merely present on props): the badge renders.
    expect(screen.getByTestId("discover-card-ja-a1-review")).toHaveAttribute(
      "data-review",
      "generated",
    );
    // The Durchsicht facet is data-driven: it appears because the catalogue
    // carries a machine-origin set.
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    expect(screen.getByTestId("discover-filters-reviewStatus")).toBeInTheDocument();
  });

  it("hides the Durchsicht facet when every set is authored (no dead options)", async () => {
    // beforeEach seeds two authored sets.
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    expect(screen.queryByTestId("discover-filters-reviewStatus")).toBeNull();
    // ...and there is no review badge on an authored card.
    expect(screen.queryByTestId("discover-card-es-a1-review")).toBeNull();
  });

  it("filters to only reviewed machine sets via the Durchsicht facet", async () => {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "auth", name: "Handgeschrieben", target_language: "es", review_status: "authored" }),
      makeSet({ id: "rev", name: "Durchgesehen", target_language: "ja", review_status: "reviewed" }),
    ]);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"));
    fireEvent.click(screen.getByTestId("discover-search-filter-filter-btn"));
    fireEvent.change(screen.getByTestId("discover-filters-reviewStatus"), {
      target: { value: "reviewed" },
    });
    await waitFor(() => expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"));
    expect(screen.getByText("Durchgesehen")).toBeInTheDocument();
    expect(screen.queryByText("Handgeschrieben")).toBeNull();
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

// --- #1343: visible source-language filter (default = UI locale, persisted) ---

describe("Discover source-language filter (#1343)", () => {
  const KEY = "adaptive-learner.discover_source_language";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.content_view_mode", "grid");
    i18n.lang = "de";
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
  });

  function seedTwoSourceLanguages() {
    fetchAllIndicesMock.mockResolvedValue([
      makeSet({ id: "de-es", name: "Spanisch (de)", source_language: "de", target_language: "es" }),
      makeSet({ id: "en-fr", name: "French (en)", source_language: "en", target_language: "fr" }),
    ]);
  }

  it("shows the source-language filter WITHOUT opening the collapsible panel (#1699)", async () => {
    i18n.lang = "de";
    seedTwoSourceLanguages();
    renderDiscover();
    // The always-visible chip is present on first paint — the learner sees
    // THAT the list is filtered and WHAT to, never silently (#1343 / #1699).
    await waitFor(() =>
      expect(screen.getByTestId("discover-language-filter")).toBeInTheDocument(),
    );
    // Its label reflects the active language (the UI-locale default "de").
    expect(screen.getByTestId("discover-language-filter-label")).toHaveTextContent(
      "DE",
    );
    // ...and it does NOT depend on the collapsible filter panel being open.
    expect(screen.queryByTestId("discover-filters")).toBeNull();
  });

  it("defaults to the UI locale and shows only sets in that source language", async () => {
    i18n.lang = "de";
    seedTwoSourceLanguages();
    renderDiscover();
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
    );
    expect(screen.getByText("Spanisch (de)")).toBeInTheDocument();
    expect(screen.queryByText("French (en)")).toBeNull();
    // The locale default is NOT an explicit choice, so nothing is persisted.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("an explicit choice overrides the default and persists across a reload", async () => {
    i18n.lang = "de";
    seedTwoSourceLanguages();
    const first = renderDiscover();
    await waitFor(() => expect(screen.getByTestId("discover-page")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("discover-language-filter"));
    fireEvent.click(screen.getByTestId("discover-language-filter-en"));
    await waitFor(() => expect(screen.getByText("French (en)")).toBeInTheDocument());
    expect(localStorage.getItem(KEY)).toBe("en");
    first.unmount();

    // Reload: a fresh mount applies the persisted choice, not the locale default.
    renderDiscover();
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
    );
    expect(screen.getByText("French (en)")).toBeInTheDocument();
    expect(screen.queryByText("Spanisch (de)")).toBeNull();
  });

  it('"All languages" shows every set regardless of source language', async () => {
    i18n.lang = "de";
    seedTwoSourceLanguages();
    renderDiscover();
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("1 sets"),
    );
    fireEvent.click(screen.getByTestId("discover-language-filter"));
    fireEvent.click(screen.getByTestId("discover-language-filter-"));
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"),
    );
    expect(screen.getByText("Spanisch (de)")).toBeInTheDocument();
    expect(screen.getByText("French (en)")).toBeInTheDocument();
    // "All languages" is an explicit choice too (empty string, not null).
    expect(localStorage.getItem(KEY)).toBe("");
  });

  it("offers an escape link to All languages when the locale default is empty", async () => {
    i18n.lang = "ja"; // no ja-source set exists
    seedTwoSourceLanguages();
    renderDiscover();
    await waitFor(() =>
      expect(screen.getByTestId("discover-empty-results")).toBeInTheDocument(),
    );
    // The escape hint + link are shown, not a dead empty page.
    expect(screen.getByTestId("discover-empty-language")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("discover-show-all-languages"));
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"),
    );
    expect(localStorage.getItem(KEY)).toBe("");
  });

  it("follows the new UI language after a switch — the switch clears any explicit choice (#1347)", async () => {
    // NEW RULE (#1347, supersedes the prior "explicit choice survives a
    // language switch"): a UI-language change resets the content-language
    // filter to the new language, overriding even an explicit "All". The reset
    // itself lives in the single language choke point (`setLang` in `useI18n`,
    // covered by its own test); here we assert Discover's half - it follows the
    // new locale once that override has been cleared.
    seedTwoSourceLanguages();
    // Pre-switch: the user had explicitly chosen "All languages".
    localStorage.setItem(KEY, "");
    i18n.lang = "de";
    const first = renderDiscover();
    await waitFor(() =>
      expect(screen.getByTestId("discover-count")).toHaveTextContent("2 sets"),
    );
    first.unmount();

    // UI switches to English: setLang clears the override (emulated here), so
    // Discover follows the new locale — English — not the old "All".
    localStorage.removeItem(KEY);
    i18n.lang = "en";
    renderDiscover();
    await waitFor(() => expect(screen.getByText("French (en)")).toBeInTheDocument());
    expect(screen.queryByText("Spanisch (de)")).toBeNull();
    // The override was cleared, so nothing is persisted until a new choice.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("without a UI-language change, an explicit choice is untouched", async () => {
    seedTwoSourceLanguages();
    localStorage.setItem(KEY, "de");
    i18n.lang = "de";
    const first = renderDiscover();
    await waitFor(() => expect(screen.getByText("Spanisch (de)")).toBeInTheDocument());
    expect(screen.queryByText("French (en)")).toBeNull();
    first.unmount();
    // Reload (no language change): the stored choice still applies.
    renderDiscover();
    await waitFor(() => expect(screen.getByText("Spanisch (de)")).toBeInTheDocument());
    expect(localStorage.getItem(KEY)).toBe("de");
  });
});

describe("shared page container (#1380)", () => {
  it("renders the page inside the shared PageContainer, with no deviating wrapper", async () => {
    renderDiscover();
    const main = await screen.findByTestId("discover-page");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("data-slot", "page-container");
    // Exact match: the canonical container set only — Discover no
    // longer runs full-viewport-width (the dead ``page`` class).
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });

  it("renders the loading state inside the same shared container", () => {
    fetchAllIndicesMock.mockImplementation(() => new Promise(() => {}));
    renderDiscover();
    const main = screen.getByTestId("discover-loading");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });
});
