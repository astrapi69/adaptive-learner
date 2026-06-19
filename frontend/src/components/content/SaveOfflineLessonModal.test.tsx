import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import SaveOfflineLessonModal from "./SaveOfflineLessonModal";
import type { ConversationAnalysisResult } from "../../types/domain";

const saveUserSet = vi.fn();
vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: { saveUserSet: (...a: unknown[]) => saveUserSet(...a) },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: unknown) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mutable app language so a test can simulate a German UI.
const i18nState = vi.hoisted(() => ({ lang: "en" }));
vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: i18nState.lang,
  }),
}));

const ANALYSIS: ConversationAnalysisResult = {
  topic: "Spanish travel",
  summary: "Ordering food.",
  vocabulary: [
    {
      word: "la cuenta",
      translation: "the bill",
      example: "La cuenta, por favor.",
    },
    { word: "el agua", translation: "the water", example: "Quiero el agua." },
    {
      word: "la calle",
      translation: "the street",
      example: "La calle esta cerca.",
    },
    { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
  ],
};

function renderModal(props: Record<string, unknown> = {}) {
  return render(
    <SaveOfflineLessonModal
      open
      analysis={ANALYSIS}
      conversationId="c1"
      conversationTitle="Chat"
      language="es"
      onCancel={() => {}}
      onSaved={() => {}}
      {...props}
    />,
  );
}

describe("SaveOfflineLessonModal", () => {
  beforeEach(() => {
    saveUserSet.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    i18nState.lang = "en";
  });

  it("defaults source_language to the app language, not 'en' (German UI)", () => {
    // Regression: a German grammar chat was landing at en -> de because
    // the source defaulted to "en" instead of the active UI language.
    i18nState.lang = "de";
    renderModal({
      analysis: { topic: "Deutsche Grammatik", summary: "Faelle und Artikel." },
      // The learner's stored content language is unset upstream and
      // coalesces to "en" — the modal must NOT use that as the source.
      language: "en",
    });
    const source = screen.getByTestId(
      "save-lesson-source-lang",
    ) as HTMLSelectElement;
    expect(source.value).toBe("de");
  });

  it("inherits the import-time language pair when provided (no guessing)", () => {
    // C4 — the modal must use the pair captured at import, not guess
    // from the topic / app language.
    i18nState.lang = "de";
    renderModal({
      analysis: { topic: "Etwas", summary: "x" },
      language: "en",
      sourceLanguage: "de",
      targetLanguage: "fr",
    });
    expect(
      (screen.getByTestId("save-lesson-source-lang") as HTMLSelectElement).value,
    ).toBe("de");
    expect(
      (screen.getByTestId("save-lesson-target-lang") as HTMLSelectElement).value,
    ).toBe("fr");
  });

  it("falls back to guessing when the import has no language pair", () => {
    // Old import without languages -> source = app language, target =
    // detected from the topic.
    i18nState.lang = "de";
    renderModal({
      analysis: { topic: "Französisch A1", summary: "x" },
      language: "en",
    });
    expect(
      (screen.getByTestId("save-lesson-source-lang") as HTMLSelectElement).value,
    ).toBe("de");
    expect(
      (screen.getByTestId("save-lesson-target-lang") as HTMLSelectElement).value,
    ).toBe("fr");
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });
    expect(
      screen.queryByTestId("save-offline-lesson-modal"),
    ).not.toBeInTheDocument();
  });

  it("shows a preview summary and seeds the title from the topic", () => {
    renderModal();
    expect(screen.getByTestId("save-offline-lesson-modal")).toBeInTheDocument();
    expect(
      (screen.getByTestId("save-lesson-title-input") as HTMLInputElement).value,
    ).toBe("Spanish travel");
    expect(screen.getByTestId("save-lesson-summary").textContent).toMatch(
      /exercises/,
    );
  });

  it("saves the generated lesson and calls onSaved", async () => {
    saveUserSet.mockResolvedValue({
      source: "user-generated",
      id: "analysis-c1",
    });
    const onSaved = vi.fn();
    renderModal({ onSaved });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.set_id).toBe("analysis-c1");
    expect(arg.origin).toBe("analysis");
    // The splitter may produce 1 or more parts depending on step count.
    const lessons = arg.lessons as Array<{title: string}>;
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    // All part titles start with the base lesson title.
    expect(lessons[0].title).toMatch(/^Spanish travel/);
    expect(onSaved).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("uses the edited title when saving", async () => {
    saveUserSet.mockResolvedValue({});
    renderModal();
    fireEvent.change(screen.getByTestId("save-lesson-title-input"), {
      target: { value: "My custom title" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as { title: string };
    expect(arg.title).toBe("My custom title");
  });

  it("passes a distinct language pair, CEFR level, and title_native (EXP-018 fix)", async () => {
    saveUserSet.mockResolvedValue({});
    renderModal({ analysis: { ...ANALYSIS, user_level: "intermediate" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.target_language).toBeTruthy();
    expect(arg.source_language).toBeTruthy();
    expect(arg.target_language).not.toBe(arg.source_language);
    expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(arg.level);
    expect(arg.level).toBe("B1"); // intermediate -> B1
    expect(arg.title_native).toBeTruthy();
  });

  it("shows a non-blocking hint when there are too few exercises to share (#795)", () => {
    renderModal({
      analysis: {
        topic: "French grammar",
        summary: "s",
        vocabulary: [{ word: "a", translation: "b" }],
      },
    });
    // Too few exercises for a shareable lesson → the hint is shown,
    // but it no longer blocks Save: the lesson still has theory steps,
    // so it is a legitimate offline knowledge lesson.
    expect(
      screen.getByTestId("save-lesson-not-enough-data"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-lesson-save")).not.toBeDisabled();
  });

  it("saves a theory-only lesson (no exercises, #795)", async () => {
    // A grammar / AI-explanation chat with no vocabulary produces a
    // theory-only lesson. It must still be saveable — the Save button
    // is enabled as long as there is at least one step.
    saveUserSet.mockResolvedValue({});
    renderModal({
      analysis: {
        topic: "German cases explained",
        summary: "Nominative, accusative, dative, genitive.",
        // no vocabulary -> theory-only lesson
      },
    });
    const saveBtn = screen.getByTestId("save-lesson-save");
    expect(saveBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as {
      lessons: Array<{ steps: unknown[] }>;
    };
    expect(arg.lessons.length).toBeGreaterThanOrEqual(1);
  });

  it("allows saving a same-language lesson (grammar / native study)", async () => {
    // German grammar for German speakers is a legitimate offline
    // lesson. Setting source == target shows an informational hint
    // but must NOT disable Save (bugfix: same-language was a hard
    // block, defeating native-language grammar lessons).
    saveUserSet.mockResolvedValue({});
    renderModal();
    fireEvent.change(screen.getByTestId("save-lesson-target-lang"), {
      target: { value: "de" },
    });
    fireEvent.change(screen.getByTestId("save-lesson-source-lang"), {
      target: { value: "de" },
    });
    // The hint is shown...
    expect(
      screen.getByTestId("save-lesson-same-language"),
    ).toBeInTheDocument();
    // ...but the Save button is NOT disabled (the lesson still has
    // enough exercises from the default ANALYSIS fixture).
    const saveBtn = screen.getByTestId("save-lesson-save");
    expect(saveBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.source_language).toBe("de");
    expect(arg.target_language).toBe("de");
  });

  it("stamps a knowledge content domain on the lessons when source == target", async () => {
    // A same-language lesson (German grammar for German speakers) is
    // non-language ("knowledge") content. The stamp lets the Share Wizard
    // inherit the same-language pair as intentional domain content instead
    // of repairing it as a legacy en/en mistake.
    saveUserSet.mockResolvedValue({});
    renderModal();
    fireEvent.change(screen.getByTestId("save-lesson-target-lang"), {
      target: { value: "de" },
    });
    fireEvent.change(screen.getByTestId("save-lesson-source-lang"), {
      target: { value: "de" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as {
      lessons: Array<{ domain?: string }>;
    };
    expect(arg.lessons.length).toBeGreaterThanOrEqual(1);
    expect(arg.lessons.every((l) => l.domain === "knowledge")).toBe(true);
  });

  it("leaves the content domain unset for a normal language pair", async () => {
    // source (app language) != target -> a language lesson, no content
    // domain stamped (the set lands in the normal source->target tree).
    saveUserSet.mockResolvedValue({});
    renderModal(); // es content, source app-lang (en) != target
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as {
      lessons: Array<{ domain?: string }>;
    };
    expect(arg.lessons.some((l) => l.domain === "knowledge")).toBe(false);
  });
});
