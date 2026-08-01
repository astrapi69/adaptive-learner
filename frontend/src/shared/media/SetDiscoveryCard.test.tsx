import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SetDiscoveryCard, { type SetDiscoveryCardLabels } from "./SetDiscoveryCard";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";

const LABELS: SetDiscoveryCardLabels = {
  download: "Download",
  downloading: "Downloading…",
  retry: "Retry",
  downloaded: "Already present",
  lessons: "15 lessons",
  cards: "450 cards",
  aiChecked: "AI-checked",
  trust: "Official",
  remove: "Remove",
  progress: "Downloading lessons",
  reviewGenerated: "Maschinell erstellt",
  reviewReviewed: "Durchgesehen",
};

function makeSet(over: Partial<SearchableSet> = {}): SearchableSet {
  return {
    id: "es-a1",
    name: "Spanisch A1",
    description: "Grundlagen",
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

describe("SetDiscoveryCard", () => {
  it("renders name, badges, counts and the AI-checked + trust badges", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.getByText("Spanisch A1")).toBeInTheDocument();
    expect(screen.getByTestId("set-discovery-card-language")).toHaveTextContent("DE → ES");
    expect(screen.getByTestId("set-discovery-card-level")).toHaveTextContent("A1");
    expect(screen.getByTestId("set-discovery-card-lessons")).toHaveTextContent("15 lessons");
    expect(screen.getByTestId("set-discovery-card-cards")).toHaveTextContent("450 cards");
    expect(screen.getByTestId("set-discovery-card-ai")).toHaveTextContent("AI-checked");
    expect(screen.getByTestId("set-discovery-card-trust")).toHaveTextContent("Official");
  });

  it("fires onDownload with the set when the button is clicked", () => {
    const onDownload = vi.fn();
    const set = makeSet();
    render(
      <SetDiscoveryCard
        set={set}
        isDownloaded={false}
        onDownload={onDownload}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    fireEvent.click(screen.getByTestId("set-discovery-card-download"));
    expect(onDownload).toHaveBeenCalledWith(set);
  });

  it("shows the downloaded badge instead of the button when downloaded", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.getByTestId("set-discovery-card-downloaded")).toHaveTextContent("Already present");
    expect(screen.queryByTestId("set-discovery-card-download")).toBeNull();
  });

  it("disables the button and shows the downloading label while in flight", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded={false}
        state="downloading"
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    const button = screen.getByTestId("set-discovery-card-download");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Downloading…");
  });

  it("shows the retry label after an error", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded={false}
        state="error"
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.getByTestId("set-discovery-card-download")).toHaveTextContent("Retry");
  });

  it("shows the per-lesson progress bar while downloading", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded={false}
        state="downloading"
        progress={{ current: 3, total: 15 }}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.getByTestId("set-discovery-card-progress")).toBeInTheDocument();
    expect(screen.getByTestId("set-discovery-card-progress-count")).toHaveTextContent("3 / 15");
  });

  it("shows a remove action on a downloaded set and fires onRemove", () => {
    const onRemove = vi.fn();
    const set = makeSet();
    render(
      <SetDiscoveryCard
        set={set}
        isDownloaded
        onDownload={() => {}}
        onRemove={onRemove}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    fireEvent.click(screen.getByTestId("set-discovery-card-remove"));
    expect(onRemove).toHaveBeenCalledWith(set);
  });

  it("hides the remove action when onRemove is omitted", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.queryByTestId("set-discovery-card-remove")).toBeNull();
  });

  it("hides the trust + AI badges when not applicable", () => {
    render(
      <SetDiscoveryCard
        set={makeSet({ trust_level: 0, ai_validated: false })}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.queryByTestId("set-discovery-card-trust")).toBeNull();
    expect(screen.queryByTestId("set-discovery-card-ai")).toBeNull();
  });

  it("renders the New badge when isNew + newLabel are given (#1337 f/u)", () => {
    render(
      <SetDiscoveryCard
        set={makeSet({ id: "fr-a1-from-el" })}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="EL → FR"
        labels={LABELS}
        isNew
        newLabel="New"
      />,
    );
    const badge = screen.getByTestId("set-discovery-card-new");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("New");
  });

  // --- EXP-048 #2321: Durchsichtsstand badge ---

  it("shows a neutral review badge for a generated set", () => {
    render(
      <SetDiscoveryCard
        set={makeSet({ review_status: "generated" })}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    const badge = screen.getByTestId("set-discovery-card-review");
    expect(badge).toHaveTextContent("Maschinell erstellt");
    // Neutral, not a warning: reuses the secondary-badge treatment.
    expect(badge).toHaveAttribute("data-review", "generated");
  });

  it("shows a review badge for a reviewed set", () => {
    render(
      <SetDiscoveryCard
        set={makeSet({ review_status: "reviewed" })}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    const badge = screen.getByTestId("set-discovery-card-review");
    expect(badge).toHaveTextContent("Durchgesehen");
    expect(badge).toHaveAttribute("data-review", "reviewed");
  });

  it("shows NO review badge for an authored set (absence is not a defect)", () => {
    render(
      <SetDiscoveryCard
        set={makeSet({ review_status: "authored" })}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
      />,
    );
    expect(screen.queryByTestId("set-discovery-card-review")).toBeNull();
  });

  it("hides the New badge when isNew is false", () => {
    render(
      <SetDiscoveryCard
        set={makeSet()}
        isDownloaded={false}
        onDownload={() => {}}
        languageLabel="DE → ES"
        labels={LABELS}
        newLabel="New"
      />,
    );
    expect(screen.queryByTestId("set-discovery-card-new")).toBeNull();
  });
});
