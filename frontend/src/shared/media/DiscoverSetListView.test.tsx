/**
 * Tests for DiscoverSetListView (#1262) — the compact list alternative
 * to the Discover card grid. Presentational + props-driven: pins the
 * language-vs-knowledge row, the download/remove actions, and the
 * per-state button.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DiscoverSetListView, { type DiscoverListLabels } from "./DiscoverSetListView";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";
import type { SetDiscoveryDownloadState } from "./SetDiscoveryCard";

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

const LABELS: DiscoverListLabels = {
  download: "Download",
  downloading: "Downloading…",
  retry: "Retry",
  downloaded: "Already present",
  remove: "Remove",
  lessons: (n) => `${n} lessons`,
  newBadge: "New",
  reviewGenerated: "Maschinell erstellt",
  reviewReviewed: "Durchgesehen",
};

function renderList(
  sets: SearchableSet[],
  opts: Partial<{
    isDownloaded: (s: SearchableSet) => boolean;
    stateFor: (s: SearchableSet) => SetDiscoveryDownloadState;
    canRemove: (s: SearchableSet) => boolean;
    isNew: (s: SearchableSet) => boolean;
    onDownload: (s: SearchableSet) => void;
    onRemove: (s: SearchableSet) => void;
  }> = {},
) {
  const onDownload = opts.onDownload ?? vi.fn();
  const onRemove = opts.onRemove ?? vi.fn();
  render(
    <DiscoverSetListView
      sets={sets}
      keyFor={(s) => `${s.repo_url}#${s.id}`}
      isDownloaded={opts.isDownloaded ?? (() => false)}
      stateFor={opts.stateFor ?? (() => "idle")}
      canRemove={opts.canRemove ?? (() => true)}
      isNew={opts.isNew ?? (() => false)}
      onDownload={onDownload}
      onRemove={onRemove}
      labels={LABELS}
    />,
  );
  return { onDownload, onRemove };
}

describe("DiscoverSetListView", () => {
  it("renders one row per set with the title", () => {
    renderList([makeSet({}), makeSet({ id: "fr-a1", name: "French A1" })]);
    expect(screen.getByTestId("discover-list-view")).toBeInTheDocument();
    expect(screen.getByText("Spanish A1")).toBeInTheDocument();
    expect(screen.getByText("French A1")).toBeInTheDocument();
  });

  it("shows the language pair for a language set, not for a knowledge set", () => {
    renderList([
      makeSet({ id: "es-a1", source_language: "de", target_language: "es" }),
      makeSet({
        id: "psy-1",
        name: "Psychology",
        domain: "psychology",
        source_language: "de",
        target_language: "de",
      }),
    ]);
    expect(screen.getByTestId("discover-list-es-a1-langs")).toHaveTextContent("de→es");
    expect(screen.queryByTestId("discover-list-psy-1-langs")).toBeNull();
  });

  it("calls onDownload from an idle row", () => {
    const { onDownload } = renderList([makeSet({ id: "fr-a1" })]);
    fireEvent.click(screen.getByTestId("discover-list-fr-a1-download"));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("disables the button while downloading", () => {
    renderList([makeSet({ id: "fr-a1" })], { stateFor: () => "downloading" });
    expect(screen.getByTestId("discover-list-fr-a1-download")).toBeDisabled();
  });

  it("shows Retry on error", () => {
    renderList([makeSet({ id: "fr-a1" })], { stateFor: () => "error" });
    expect(screen.getByTestId("discover-list-fr-a1-download")).toHaveTextContent("Retry");
  });

  it("shows the present badge + a Remove button for a downloaded, removable set", () => {
    const { onRemove } = renderList([makeSet({ id: "es-a1" })], {
      isDownloaded: () => true,
    });
    expect(screen.getByTestId("discover-list-es-a1-downloaded")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("discover-list-es-a1-remove"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("hides Remove for a downloaded official set (canRemove false)", () => {
    renderList([makeSet({ id: "es-a1" })], {
      isDownloaded: () => true,
      canRemove: () => false,
    });
    expect(screen.getByTestId("discover-list-es-a1-downloaded")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-list-es-a1-remove")).toBeNull();
  });

  it("renders a New badge for a set flagged new, and none otherwise (#1337 f/u)", () => {
    renderList([makeSet({ id: "fr-a1-from-el" }), makeSet({ id: "es-a1" })], {
      isNew: (s) => s.id === "fr-a1-from-el",
    });
    const badge = screen.getByTestId("discover-list-fr-a1-from-el-new");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("New");
    expect(screen.queryByTestId("discover-list-es-a1-new")).toBeNull();
  });

  it("shows the review badge for generated/reviewed rows, none for authored (EXP-048 #2321)", () => {
    renderList([
      makeSet({ id: "gen", review_status: "generated" }),
      makeSet({ id: "rev", review_status: "reviewed" }),
      makeSet({ id: "auth", review_status: "authored" }),
    ]);
    expect(screen.getByTestId("discover-list-gen-review")).toHaveTextContent(
      "Maschinell erstellt",
    );
    expect(screen.getByTestId("discover-list-rev-review")).toHaveTextContent(
      "Durchgesehen",
    );
    expect(screen.queryByTestId("discover-list-auth-review")).toBeNull();
  });

  it("keeps a long title truncating instead of overflowing the row (#1380)", () => {
    const longTitle =
      "Ein extrem langer Set-Titel der auf schmalen Containern niemals " +
      "über den Rand laufen darf sondern mit Ellipsis abgeschnitten wird";
    renderList([makeSet({ id: "long", name: longTitle })]);
    const row = screen.getByTestId("discover-list-long");
    const title = screen.getByText(longTitle);
    // The title is the single flexible column and truncates (overflow-
    // hidden + ellipsis + nowrap — implies min-width:0 on a flex child);
    // every trailing meta/action element refuses to shrink.
    expect(title).toHaveClass("flex-1");
    expect(title).toHaveClass("truncate");
    const trailing = Array.from(row.children).filter((el) => el !== title);
    expect(trailing.length).toBeGreaterThan(0);
    for (const el of trailing) {
      expect(el.className).toContain("shrink-0");
    }
  });
});
