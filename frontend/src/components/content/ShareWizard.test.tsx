/**
 * Tests for the community sharing wizard (Phase 64C).
 *
 * Pins: step navigation (1->4 + back), placement display (new set vs
 * existing), the duplicate scan outcomes (unique / similar / near-
 * duplicate + variation/supplement modes), and the share action +
 * celebration on the final step.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ShareWizard from "./ShareWizard";
import { CEFR_LEVELS } from "../../lib/content/language-options";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";

// App language is mutable per test (default "de") so the
// source-language-default tests can assert "app language wins".
const i18nMock = vi.hoisted(() => ({ lang: "de" }));
vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback: string) => fallback,
    lang: i18nMock.lang,
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

/** A single lesson whose JSON exceeds the create-file URL cap (a big
 *  theory body) but is otherwise shareable (1 card + 1 exercise). */
function oversizedLesson(): ContentLesson {
  return {
    id: "big",
    title: "Big Lesson",
    estimated_minutes: 10,
    cards: [{ id: "big-c0", front: "f", back: "b", tags: [] }],
    steps: [
      { id: "big-s", type: "theory", body: "x".repeat(20000) },
      {
        id: "big-ex",
        type: "exercise",
        exercise: {
          id: "big-ex",
          type: "free_text" as never,
          prompt: "p",
          card_ids: ["big-c0"],
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
  // window.open succeeds by default (returns truthy); a test overrides
  // it to return false to exercise the popup-blocked fallback.
  const openUrl = vi.fn((_url: string) => true);
  const downloadLesson = vi.fn();
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
    downloadLesson,
    ...over,
  };
  render(<ShareWizard {...props} />);
  // Return the EFFECTIVE download mock (an override in `over` wins).
  return { onShared, onClose, openUrl, downloadLesson: props.downloadLesson, props };
}

function advanceToStep4() {
  fireEvent.click(screen.getByTestId("share-wizard-next"));
  fireEvent.click(screen.getByTestId("share-wizard-next"));
  fireEvent.click(screen.getByTestId("share-wizard-next"));
}

beforeEach(() => {
  // Isolate the remembered author name between tests.
  localStorage.clear();
  // Default app language for the wizard's source default.
  i18nMock.lang = "de";
});

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
    // Small single lesson -> PR fast lane: create-file URL + PR-link.
    expect(openUrl.mock.calls[0][0]).toContain("/new/main?");
    expect(
      screen.getByTestId("share-wizard-pr-instructions"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-pr-link")).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
  });

  it("opens the GitHub create-file URL and does NOT download for a small lesson", () => {
    // Regression (P0): a small lesson must go straight to the PR
    // create-file URL — no download / save dialog.
    const { openUrl, downloadLesson } = renderWizard();
    advanceToStep4();
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0][0]).toContain("/new/main?");
    expect(downloadLesson).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("share-wizard-popup-blocked"),
    ).not.toBeInTheDocument();
  });

  it("shows a manual fallback link when the popup is blocked", () => {
    // Regression (P0): window.open blocked -> the user must still be
    // able to reach GitHub via a visible link.
    const { downloadLesson } = renderWizard({ openUrl: vi.fn((_url: string) => false) });
    advanceToStep4();
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    expect(
      screen.getByTestId("share-wizard-popup-blocked"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-pr-link")).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
    // PR path: still no download even when blocked.
    expect(downloadLesson).not.toHaveBeenCalled();
  });

  it("opens GitHub BEFORE downloading (gesture-safe order)", () => {
    // Regression (P0): the GitHub page must open before the download
    // consumes the user-activation, or the popup gets blocked.
    const order: string[] = [];
    const openUrl = vi.fn((_url: string) => {
      order.push("open");
      return true;
    });
    const downloadLesson = vi.fn(() => {
      order.push("download");
    });
    renderWizard({ lessons: [oversizedLesson()], openUrl, downloadLesson });
    advanceToStep4();
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    // Single lesson -> create-file (/new/) editor, not the upload page.
    expect(openUrl.mock.calls[0][0]).toContain("/new/main?");
    expect(order).toEqual(["open", "download"]);
  });

  it("single oversized lesson: create-file editor (not upload) + downloads for pasting", () => {
    // BUG (P0): a realistic single lesson whose JSON exceeds the URL cap
    // must still go through the create-file (/new/) flow — it creates the
    // new nested set directory + auto-forks — NOT the upload page (which
    // 404s on a not-yet-existing directory). The file downloads so the
    // user pastes it into the editor.
    const downloadLesson = vi.fn();
    const { openUrl } = renderWizard({
      lessons: [oversizedLesson()],
      downloadLesson,
    });
    advanceToStep4();
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    expect(openUrl.mock.calls[0][0]).toContain("/new/main?");
    expect(openUrl.mock.calls[0][0]).not.toContain("/upload/");
    expect(downloadLesson).toHaveBeenCalledTimes(1);
    // Not pre-filled -> paste instructions (not the small-lesson PR copy).
    expect(
      screen.getByTestId("share-wizard-paste-instructions"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("share-wizard-pr-instructions")).toBeNull();
    expect(
      screen.getByTestId("share-wizard-copy-pr-body"),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId("share-wizard-pr-body") as HTMLTextAreaElement)
        .value,
    ).toContain("New lesson");
  });

  it("multi-lesson set: upload page + downloads every lesson file", () => {
    // A multi-lesson set can't be a single create-file commit, so it
    // keeps the upload-page (drag-drop) flow and downloads each file.
    const downloadLesson = vi.fn();
    const { openUrl } = renderWizard({
      entry: entry({ lesson_count: 2 }),
      lessons: [
        lesson("a", ["w0", "w1", "w2"]),
        lesson("b", ["x0", "x1", "x2"]),
      ],
      downloadLesson,
    });
    advanceToStep4();
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    expect(openUrl.mock.calls[0][0]).toContain("/upload/main/");
    expect(downloadLesson).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTestId("share-wizard-upload-instructions"),
    ).toBeInTheDocument();
  });
});

describe("ShareWizard: author credit (64C-2)", () => {
  it("stamps the credit onto the shared lesson and remembers the name", async () => {
    const { openUrl } = renderWizard();
    // Enter a name in step 1; the show-name toggle auto-checks.
    fireEvent.change(screen.getByTestId("share-wizard-author-name"), {
      target: { value: "Maria S." },
    });
    expect(screen.getByTestId("share-wizard-author-show")).toBeChecked();
    // 1 -> 2 -> 3 -> 4 -> share
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-step-2");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-share"));

    const url = openUrl.mock.calls[0][0] as string;
    const value = new URL(url).searchParams.get("value") ?? "";
    expect(value).toContain("contributed_by");
    expect(value).toContain("Maria S.");
    // Name remembered for next time.
    expect(localStorage.getItem("adaptive-learner.contributor-name")).toBe(
      "Maria S.",
    );
  });

  it("omits the credit when no name is entered", async () => {
    const { openUrl } = renderWizard();
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-step-2");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-share"));
    const url = openUrl.mock.calls[0][0] as string;
    const value = new URL(url).searchParams.get("value") ?? "";
    expect(value).not.toContain("contributed_by");
  });
});

/** An empty lesson: no exercises, no cards (the BUG B scenario — an
 *  old analysis-to-lesson generator failure that saved anyway). */
function emptyLesson(): ContentLesson {
  return {
    id: "empty",
    title: "Empty",
    estimated_minutes: 0,
    cards: [],
    steps: [{ id: "empty-theory", type: "theory", body: "intro" }],
  };
}

describe("ShareWizard: editable metadata + gating (step 1)", () => {
  it("blocks an empty lesson (0 exercises/cards) and offers regenerate", () => {
    // BUG B: a lesson saved with no exercises must not be shareable.
    const onRegenerate = vi.fn();
    renderWizard({ lessons: [emptyLesson()], onRegenerate });
    expect(screen.getByTestId("share-wizard-empty")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-step1-errors")).toHaveTextContent(
      "no exercises",
    );
    // Continue is blocked.
    expect(screen.getByTestId("share-wizard-next")).toBeDisabled();
    // Regenerate is wired through.
    fireEvent.click(screen.getByTestId("share-wizard-regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("blocks a non-CEFR 'imported' level until a real level is chosen", () => {
    // BUG C: an "imported" level is never valid for the community tree.
    renderWizard({ entry: entry({ level: "imported" }) });
    // estimateLevel pre-fills a CEFR default, so the trigger never shows
    // the bad "imported" value (nor the "— Select level —" clear item).
    const level = screen.getByTestId("share-wizard-edit-level");
    expect(level).not.toHaveTextContent("imported");
    expect(level.textContent ?? "").toMatch(
      // eslint-disable-next-line security/detect-non-literal-regexp -- CEFR_LEVELS is a fixed internal constant
      new RegExp(`\\b(${(CEFR_LEVELS as readonly string[]).join("|")})\\b`),
    );
  });

  it("blocks Continue when no CEFR level is selected", async () => {
    // BUG C: the user can explicitly clear the level via the "— Select
    // level —" item; an empty level then blocks sharing — a lesson must
    // declare a real CEFR band before it can be shared.
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByTestId("share-wizard-edit-level"));
    await user.click(await screen.findByRole("option", { name: /Select level/i }));
    expect(screen.getByTestId("share-wizard-step1-errors")).toHaveTextContent(
      "CEFR",
    );
    expect(screen.getByTestId("share-wizard-next")).toBeDisabled();
  });

  it("lets the user correct source, target and level (old bad lesson)", async () => {
    // BUG A: an old lesson saved before the source-language fix has
    // source == target == "en" and a bad level. The user fixes it here.
    const user = userEvent.setup();
    renderWizard({
      entry: entry({
        source_language: "en",
        target_language: "en",
        language: "en",
        level: "imported",
      }),
    });
    const source = screen.getByTestId("share-wizard-edit-source");
    const target = screen.getByTestId("share-wizard-edit-target");
    // Defaults already repaired the source==target collision.
    expect(source.textContent).not.toBe(target.textContent);
    // The user sets a clean DE -> ES B1 pair.
    await user.click(source);
    await user.click(await screen.findByRole("option", { name: "German (de)" }));
    await user.click(target);
    await user.click(await screen.findByRole("option", { name: "Spanish (es)" }));
    await user.click(screen.getByTestId("share-wizard-edit-level"));
    await user.click(await screen.findByRole("option", { name: "B1" }));
    // No blocking errors -> Continue enabled, placement reflects edits.
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "DE → ES → B1",
    );
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "sets/de/es-b1/lessons/",
    );
  });

  it("allows source == target as knowledge (non-language) domain content", async () => {
    // v1.54.0 domain-aware sharing: a same-language lesson is NOT blocked;
    // it ships as non-language content (the validator + content-repo CI
    // allow source == target for domain != language). A hint explains it.
    const user = userEvent.setup();
    renderWizard(); // default source de, target fr
    await user.click(screen.getByTestId("share-wizard-edit-target"));
    // now source == target == de
    await user.click(await screen.findByRole("option", { name: "German (de)" }));
    expect(screen.getByTestId("share-wizard-domain-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("share-wizard-step1-errors")).toBeNull();
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
  });

  it("inherits a same-language pair for explicit non-language domain content", () => {
    // IMPORT-LANG-PIPELINE-SELECT-MIGRATION-01: a lesson saved with
    // source == target == de AND an explicit knowledge domain (German
    // grammar for German speakers, stamped at save time) is intentional
    // domain content. The wizard INHERITS the pair verbatim — no en/en
    // collision repair — and ships it as knowledge content. (Contrast the
    // "changing the languages" test below: a same-language pair WITHOUT a
    // content domain is still repaired as a legacy mistake.)
    i18nMock.lang = "de";
    const knowledgeLesson: ContentLesson = {
      ...lesson("mine", ["wort0", "wort1", "wort2"]),
      domain: "knowledge",
    };
    renderWizard({
      entry: entry({ source_language: "de", target_language: "de" }),
      lessons: [knowledgeLesson],
    });
    const source = screen.getByTestId("share-wizard-edit-source");
    const target = screen.getByTestId("share-wizard-edit-target");
    // Both inherited as German (de) — the pair is NOT reset.
    expect(source).toHaveTextContent("German");
    expect(target).toHaveTextContent("German");
    // Shipped as knowledge content: the hint shows, no blocking errors.
    expect(screen.getByTestId("share-wizard-domain-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("share-wizard-step1-errors")).toBeNull();
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
  });

  it("inherits the same-language domain pair when lessons load AFTER mount", async () => {
    // Regression (Dexie release gate): the share page mounts the wizard
    // with an EMPTY lessons array and fetches the lessons asynchronously
    // (Content.handleShare), so the pair useState initializers can't see
    // the lesson's content domain at mount and a same-language pair
    // collapses to the placeholder. Once the knowledge-domain lesson
    // arrives, the effect must re-apply the inherited de -> de pair.
    i18nMock.lang = "de";
    const knowledgeLesson: ContentLesson = {
      ...lesson("mine", ["wort0", "wort1", "wort2"]),
      domain: "knowledge",
    };
    const baseProps = {
      entry: entry({ source_language: "de", target_language: "de" }),
      validation: okValidation,
      checking: false,
      knownSets: [] as ContentSetEntry[],
      existingFilenames: [] as string[],
      loadSimilarLessons: vi.fn(async () => [] as ContentLesson[]),
      validationMessage: (i: { code: string }) => i.code,
      repo: "astrapi69/adaptive-learner-content",
      branch: "main",
      onShared: vi.fn(),
      onClose: vi.fn(),
      openUrl: vi.fn((_url: string) => true),
      downloadLesson: vi.fn(),
    };
    // Mount with no lessons yet: the same-language pair has no domain
    // signal, so the target collapses to the placeholder.
    const { rerender } = render(<ShareWizard {...baseProps} lessons={[]} />);
    expect(screen.getByTestId("share-wizard-edit-target")).toHaveTextContent(
      /Select a language/i,
    );
    // Lessons arrive (async) carrying the knowledge domain.
    rerender(<ShareWizard {...baseProps} lessons={[knowledgeLesson]} />);
    await waitFor(() =>
      expect(screen.getByTestId("share-wizard-edit-target")).toHaveTextContent(
        "German",
      ),
    );
    expect(screen.getByTestId("share-wizard-edit-source")).toHaveTextContent(
      "German",
    );
    expect(screen.getByTestId("share-wizard-domain-hint")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
  });

  // --- BUG (recurring): source ALWAYS defaults to the app language ---

  it("inherits a valid lesson source language different from the target", () => {
    // v1.54.0: the import pipeline sets languages correctly, so a valid
    // source != target is TRUSTED (inherited), not overridden by the app
    // language. (English-for-French lesson shared by a German user.)
    i18nMock.lang = "de";
    renderWizard({ entry: entry({ source_language: "en", target_language: "fr" }) });
    // The trigger renders the selected option's text ("English (en)").
    expect(screen.getByTestId("share-wizard-edit-source")).toHaveTextContent(
      "English",
    );
  });

  it("overrides an old lesson's bad 'en' source with the app language", () => {
    // The exact recurring report: lesson saved with source==target=="en"
    // from before the source-language fix; app is German. The form must
    // show "de", never the stale "en".
    i18nMock.lang = "de";
    renderWizard({
      entry: entry({
        source_language: "en",
        target_language: "en",
        language: "en",
      }),
    });
    const source = screen.getByTestId("share-wizard-edit-source");
    expect(source).toHaveTextContent("German");
    expect(source).not.toHaveTextContent("English");
  });

  it("changing the languages to a valid distinct pair enables Continue", async () => {
    // Old pre-pipeline lesson with source == target == "de": source
    // falls back to the app language (de), the target collides and
    // defaults empty -> blocked until the user picks a real target.
    i18nMock.lang = "de";
    renderWizard({
      entry: entry({ source_language: "de", target_language: "de" }),
      lessons: [lesson("mine", ["word0", "word1", "word2"])],
    });
    const user = userEvent.setup();
    const target = screen.getByTestId("share-wizard-edit-target");
    // de target collides with de source -> empty -> placeholder shown.
    expect(target).toHaveTextContent(/Select a language/i);
    expect(screen.getByTestId("share-wizard-next")).toBeDisabled();
    // Pick a real, different target -> the gate re-runs and enables.
    await user.click(target);
    await user.click(await screen.findByRole("option", { name: "French (fr)" }));
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
  });

  it("a source dropdown change updates the placement immediately", async () => {
    // Reactivity pin: the placement breadcrumb recomputes from form
    // state the moment the source dropdown changes.
    const user = userEvent.setup();
    i18nMock.lang = "de";
    renderWizard(); // de -> fr
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "DE → FR",
    );
    await user.click(screen.getByTestId("share-wizard-edit-source"));
    await user.click(await screen.findByRole("option", { name: "Spanish (es)" }));
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "ES → FR",
    );
  });

  it("a same-language lesson validates as domain content (step 3 ok)", async () => {
    // The recomputed validator must NOT raise same_source_target for a
    // source == target lesson (it's treated as a non-language domain).
    renderWizard({
      entry: entry({
        source_language: "de",
        target_language: "de",
        title_native: "Grammatik",
      }),
      lessons: [
        // A fully shareable same-language lesson (>=5 exercises, 2 types).
        {
          id: "g",
          title: "Grammatik",
          estimated_minutes: 10,
          cards: [
            { id: "c1", front: "der Tisch", back: "der Tisch", tags: [] },
            { id: "c2", front: "die Lampe", back: "die Lampe", tags: [] },
            { id: "c3", front: "das Buch", back: "das Buch", tags: [] },
          ],
          steps: [
            { id: "t", type: "theory", body: "Artikel" },
            {
              id: "e1",
              type: "exercise",
              exercise: {
                id: "e1",
                type: "free_text" as never,
                prompt: "p",
                card_ids: ["c1"],
                accept: ["der Tisch", "Tisch"],
                distractors: ["x"],
              },
            },
            {
              id: "e2",
              type: "exercise",
              exercise: {
                id: "e2",
                type: "matching" as never,
                prompt: "m",
                card_ids: ["c1", "c2", "c3"],
                pairs: [
                  { left: "der Tisch", right: "der Tisch" },
                  { left: "die Lampe", right: "die Lampe" },
                  { left: "das Buch", right: "das Buch" },
                ],
                distractors: [],
              },
            },
            {
              id: "e3",
              type: "exercise",
              exercise: {
                id: "e3",
                type: "free_text" as never,
                prompt: "p",
                card_ids: ["c2"],
                accept: ["die Lampe", "Lampe"],
                distractors: ["y"],
              },
            },
            {
              id: "e4",
              type: "exercise",
              exercise: {
                id: "e4",
                type: "matching" as never,
                prompt: "m",
                card_ids: ["c1", "c2", "c3"],
                pairs: [
                  { left: "der Tisch", right: "der Tisch" },
                  { left: "die Lampe", right: "die Lampe" },
                  { left: "das Buch", right: "das Buch" },
                ],
                distractors: [],
              },
            },
            {
              id: "e5",
              type: "exercise",
              exercise: {
                id: "e5",
                type: "free_text" as never,
                prompt: "p",
                card_ids: ["c3"],
                accept: ["das Buch", "Buch"],
                distractors: ["z"],
              },
            },
          ],
        },
      ],
    });
    // Set target = source so it's same-language domain content.
    const user = userEvent.setup();
    await user.click(screen.getByTestId("share-wizard-edit-target"));
    await user.click(await screen.findByRole("option", { name: "German (de)" }));
    expect(screen.getByTestId("share-wizard-domain-hint")).toBeInTheDocument();
    expect(screen.getByTestId("share-wizard-next")).not.toBeDisabled();
    // Advance to the quality step — no same_source_target issue.
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(screen.getByTestId("share-wizard-quality-ok")).toBeInTheDocument();
  });
});
