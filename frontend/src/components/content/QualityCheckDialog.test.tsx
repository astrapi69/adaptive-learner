import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import QualityCheckDialog from "./QualityCheckDialog";
import type { ContentSetEntry } from "../../storage/types";

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listLessons: listLessonsMock,
      getLesson: getLessonMock,
    },
  }),
}));

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

const ENTRY: ContentSetEntry = {
  source: "bundled:x",
  branch: "main",
  id: "es-a1",
  title: "Spanish A1",
  language: "es",
  target_language: "es",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1",
  lesson_count: 1,
  description: null,
  tags: [],
  cover_image: null,
  cached_version: "1",
  update_available: false,
};

beforeEach(() => {
  listLessonsMock.mockReset();
  getLessonMock.mockReset();
  listLessonsMock.mockResolvedValue({
    set_id: "es-a1",
    source: "bundled:x",
    version: "1",
    lessons: ["01.json"],
  });
});

describe("QualityCheckDialog (EXP-032)", () => {
  it("renders nothing when no entry is selected", () => {
    const { container } = render(
      <QualityCheckDialog entry={null} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("reports accent, article, and duplicate findings", async () => {
    getLessonMock.mockResolvedValue({
      id: "01",
      title: "Lektion 1",
      cards: [
        { id: "c1", front: "la libro", back: "das Buch" },
        { id: "c2", front: "cafe", back: "Kaffee" },
        { id: "c3", front: "uno", back: "eins" },
        { id: "c4", front: "uno", back: "eins" },
      ],
    });
    render(<QualityCheckDialog entry={ENTRY} onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId("quality-check-report")).toBeInTheDocument(),
    );
    // 3 cards carry issues: c1 (article), c2 (accent), c4 (duplicate of c3).
    expect(screen.getByTestId("validation-report-item-c1")).toBeInTheDocument();
    expect(screen.getByTestId("validation-report-item-c2")).toBeInTheDocument();
    expect(screen.getByTestId("validation-report-item-c4")).toBeInTheDocument();
    expect(screen.getByText(/el libro/)).toBeInTheDocument();
    expect(screen.getByText(/café/)).toBeInTheDocument();
  });

  it("shows the all-clean state for a correct set", async () => {
    getLessonMock.mockResolvedValue({
      id: "01",
      title: "Lektion 1",
      cards: [{ id: "c1", front: "el libro", back: "das Buch" }],
    });
    render(<QualityCheckDialog entry={ENTRY} onClose={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("validation-report-all-ok"),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a friendly error when loading fails", async () => {
    listLessonsMock.mockRejectedValue(new Error("boom"));
    render(<QualityCheckDialog entry={ENTRY} onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId("quality-check-error")).toBeInTheDocument(),
    );
  });
});
