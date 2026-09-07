/**
 * ContentActionButtons (#3006) — after the Erstellen tab landed, the action
 * row no longer carries "Neue Lektion erstellen".
 *
 * #1253 had moved five actions into the Import tab on the grounds that they
 * were "all import/creation-related". #3006 revises that for the creation
 * half: creating is its own tab now, so a button pointing at the neighbouring
 * tab would be noise. The four remaining actions stay (two are import, one is
 * export, one is navigation) — their placement is a separate decision.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import ContentActionButtons from "./ContentActionButtons";

function renderButtons() {
  return render(
    <ContentActionButtons onImportLesson={vi.fn()} navigate={vi.fn()} />,
  );
}

describe("ContentActionButtons after the create tab (#3006)", () => {
  it("no longer renders the create-lesson button", () => {
    renderButtons();
    expect(screen.queryByTestId("content-create-lesson")).toBeNull();
  });

  it("keeps the four remaining actions", () => {
    renderButtons();
    for (const id of [
      "content-import-lesson",
      "content-import-chat",
      "content-anki-export",
      "content-learning-path",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });
});
