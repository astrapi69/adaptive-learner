/**
 * Tests for the community sharing wizard (Phase 64C).
 *
 * Pins: step navigation (1->4 + back), placement display (new set vs
 * existing), the duplicate scan outcomes (unique / similar / near-
 * duplicate + variation/supplement modes), and the share action +
 * celebration on the final step.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShareWizard from "./ShareWizard";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const emitCelebration = vi.fn();
vi.mock("../../lib/praise/celebration-bus", () => ({
  emitCelebration: (e: unknown) => emitCelebration(e),
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "main",
    id: "mine",
    title: "Konjugation Präteritum",
    title_native: null,
    language: "fr",
    target_language: "fr",
    source_language: "de",
    level: "A1",
    domain: "analysis",
    version: "1.0.0",
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  };
}

function lesson(id: string, fronts: string[]): ContentLesson {
  return {
    id,
    title: id,
    estimated_minutes: 10,
    cards: fronts.map((f, i) => ({ id: `${id}-c${i}`, front: f, back: `m${i}`, tags: [] })),
    steps: [
      {
        id: `${id}-ex`,
        type: "exercise",
        exercise: {
          id: `${id}-ex`,
          type: "free_text" as never,
          prompt: "p",
          card_ids: [`${id}-c0`],
          distractors: [],
        },
      },
    ],
  };
}

const okValidation = { ok: true, issues: [], warnings: [] };

function renderWizard(over: Partial<React.ComponentProps<typeof ShareWizard>> = {}) {
  const onShared = vi.fn();
  const onClose = vi.fn();
  const openUrl = vi.fn();
  const props = {
    entry: entry(),
    lessons: [lesson("mine", ["word0", "word1", "word2"])],
    validation: okValidation,
    checking: false,
    knownSets: [] as ContentSetEntry[],
    existingFilenames: [] as string[],
    loadSimilarLessons: vi.fn(async () => [] as ContentLesson[]),
    validationMessage: (i: { code: string }) => i.code,
    repo: "astrapi69/adaptive-learner-content",
    branch: "main",
    onShared,
    onClose,
    openUrl,
    ...over,
  };
  render(<ShareWizard {...props} />);
  return { onShared, onClose, openUrl, props };
}

describe("ShareWizard: placement (step 1)", () => {
  it("shows the tree placement and a new-set message when no set exists", () => {
    renderWizard();
    expect(screen.getByTestId("share-wizard-step-1")).toBeInTheDocument();
    const placement = screen.getByTestId("share-wizard-placement");
    expect(placement).toHaveTextContent("DE → FR → A1");
    expect(placement).toHaveTextContent("sets/de/fr-a1/lessons/");
    expect(screen.getByTestId("share-wizard-newset")).toBeInTheDocument();
  });

  it("shows the existing-lesson count when the set already exists", () => {
    renderWizard({
      knownSets: [entry({ id: "fr-a1-from-de", source: "github" })],
      existingFilenames: ["01-a.json", "02-b.json", "15-o.json"],
    });
    // 3 files present (count), but auto-numbering uses max+1 = 16.
    expect(screen.getByTestId("share-wizard-existing")).toHaveTextContent("3");
    // Auto-numbered filename uses the lesson title + max+1 = 16.
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "16-mine.json",
    );
  });
});

describe("ShareWizard: duplicate scan (step 2)", () => {
  it("reports a unique lesson when no candidates match", async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(await screen.findByTestId("share-wizard-unique")).toBeInTheDocument();
  });

  it("flags a near-duplicate and offers supplement + variation", async () => {
    const candidate = lesson("orig", ["word0", "word1", "word2"]); // 100% overlap
    renderWizard({ loadSimilarLessons: vi.fn(async () => [candidate]) });
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(await screen.findByTestId("share-wizard-duplicate")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-mode-supplement")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-mode-variation")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-mode-full")).toBeInTheDocument();
  });
});

describe("ShareWizard: navigation", () => {
  it("advances 1 -> 4 and supports Back", async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId("share-wizard-next")); // -> 2
    await screen.findByTestId("share-wizard-step-2");
    fireEvent.click(screen.getByTestId("share-wizard-next")); // -> 3
    expect(screen.getByTestId("share-wizard-step-3")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("share-wizard-back")); // -> 2
    expect(screen.getByTestId("share-wizard-step-2")).toBeInTheDocument();
  });

  it("Close calls onClose at any step", () => {
    const { onClose } = renderWizard();
    fireEvent.click(screen.getByTestId("share-wizard-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ShareWizard: share + celebration (step 4)", () => {
  it("shares, opens the URL, records the contribution, and celebrates", async () => {
    const { onShared, openUrl } = renderWizard();
    // 1 -> 2 -> 3 -> 4
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-step-2");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(screen.getByTestId("share-wizard-step-4")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("share-wizard-share"));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0][0]).toContain("github.com");
    expect(onShared).toHaveBeenCalledWith(
      expect.stringContaining("github.com"),
      "Konjugation Präteritum",
    );
    expect(emitCelebration).toHaveBeenCalledWith({ type: "confetti" });
    expect(screen.getByTestId("share-wizard-celebration")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-issue-link")).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
  });
});
