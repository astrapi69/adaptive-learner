/**
 * ShareWizard — automated GitHub PR path (token-configured).
 *
 * When a GitHub token is configured, step 4 creates the pull request
 * PROGRAMMATICALLY via getStorage().github.createLessonPr (fork +
 * commit + PR) instead of opening a pre-filled URL. Pins: the
 * automated success path + args, the friendly error + manual fallback,
 * and the no-token degradation to the URL flow.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/client";
import ShareWizard from "./ShareWizard";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback: string) => fallback,
    lang: "de",
  }),
}));

const emitCelebration = vi.fn();
vi.mock("../../../lib/praise/celebration-bus", () => ({
  emitCelebration: (e: unknown) => emitCelebration(e),
}));

const githubMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  createLessonPr: vi.fn(),
}));
vi.mock("../../../storage", () => ({
  getStorage: () => ({ github: githubMock }),
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "main",
    id: "mine",
    title: "Konjugation",
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

function lesson(): ContentLesson {
  return {
    id: "mine",
    title: "Konjugation",
    estimated_minutes: 10,
    cards: [{ id: "c0", front: "f0", back: "b0", tags: [] }],
    steps: [
      {
        id: "ex",
        type: "exercise",
        exercise: {
          id: "ex",
          type: "free_text" as never,
          prompt: "p",
          card_ids: ["c0"],
          distractors: [],
        },
      },
    ],
  };
}

const okValidation = { ok: true, issues: [], warnings: [] };

function renderWizard(
  over: Partial<React.ComponentProps<typeof ShareWizard>> = {},
) {
  const onShared = vi.fn();
  const openUrl = vi.fn((_url: string) => true);
  const downloadLesson = vi.fn();
  render(
    <ShareWizard
      entry={entry()}
      lessons={[lesson()]}
      validation={okValidation}
      checking={false}
      knownSets={[]}
      existingFilenames={[]}
      loadSimilarLessons={vi.fn(async () => [])}
      validationMessage={(i: { code: string }) => i.code}
      repo="astrapi69/adaptive-learner-content"
      branch="main"
      onShared={onShared}
      onClose={vi.fn()}
      openUrl={openUrl}
      downloadLesson={downloadLesson}
      {...over}
    />,
  );
  return { onShared, openUrl, downloadLesson };
}

async function advanceToStep4() {
  for (let i = 0; i < 3; i += 1) {
    fireEvent.click(await screen.findByTestId("share-wizard-next"));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  githubMock.getStatus.mockResolvedValue({ configured: true, source: "browser" });
  githubMock.createLessonPr.mockResolvedValue({
    url: "https://github.com/astrapi69/adaptive-learner-content/pull/42",
    number: 42,
    manifestUpdated: false,
  });
});

describe("ShareWizard automated PR path", () => {
  it("creates the PR programmatically and shows the created message", async () => {
    const { onShared, openUrl } = renderWizard();
    // Wait for the token status to load (configured: true).
    await waitFor(() => expect(githubMock.getStatus).toHaveBeenCalled());
    await advanceToStep4();
    fireEvent.click(await screen.findByTestId("share-wizard-share"));

    await waitFor(() =>
      expect(screen.getByTestId("share-wizard-pr-created")).toBeInTheDocument(),
    );
    // Programmatic flow: no pre-filled-URL window.open.
    expect(openUrl).not.toHaveBeenCalled();
    expect(githubMock.createLessonPr).toHaveBeenCalledTimes(1);
    const args = githubMock.createLessonPr.mock.calls[0][0];
    expect(args.upstream).toBe("astrapi69/adaptive-learner-content");
    expect(args.baseBranch).toBe("main");
    expect(args.branchName).toMatch(/^add-konjugation-\d{4}-\d{2}-\d{2}$/);
    expect(args.filePath).toContain("/lessons/");
    expect(args.fileContent).toContain('"id": "mine"');
    expect(onShared).toHaveBeenCalledWith(
      "https://github.com/astrapi69/adaptive-learner-content/pull/42",
      "Konjugation",
    );
    expect(emitCelebration).toHaveBeenCalled();
  });

  it("surfaces a friendly error and offers a manual fallback", async () => {
    githubMock.createLessonPr.mockRejectedValue(
      new ApiError(403, "no repo scope"),
    );
    const { openUrl } = renderWizard();
    await waitFor(() => expect(githubMock.getStatus).toHaveBeenCalled());
    await advanceToStep4();
    fireEvent.click(await screen.findByTestId("share-wizard-share"));

    await waitFor(() =>
      expect(screen.getByTestId("share-wizard-pr-error")).toBeInTheDocument(),
    );
    // The manual-fallback button runs the URL flow.
    fireEvent.click(screen.getByTestId("share-wizard-pr-fallback"));
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the URL flow when no token is configured", async () => {
    githubMock.getStatus.mockResolvedValue({
      configured: false,
      source: "none",
    });
    const { openUrl } = renderWizard();
    await waitFor(() => expect(githubMock.getStatus).toHaveBeenCalled());
    await advanceToStep4();
    // The no-token hint is shown on the confirm step.
    expect(screen.getByTestId("share-wizard-no-token")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("share-wizard-share"));
    expect(githubMock.createLessonPr).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledTimes(1);
  });
});
