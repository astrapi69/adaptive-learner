/**
 * AiPrivacyNote (#3812): the note under an AI check says what the request
 * sends and links the privacy policy on the docs site in the learner's
 * language, so the details are one click away at the moment of deciding.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const i18n = { lang: "en" };
vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, fallback: string) =>
      key === "content.ai_privacy_link" ? "Privacy policy" : fallback,
    lang: i18n.lang,
  }),
}));

import AiPrivacyNote from "./AiPrivacyNote";

const NOTE =
  "Only your cards are sent. Your AI provider also receives your IP address and your API key.";

beforeEach(() => {
  i18n.lang = "en";
});

describe("AiPrivacyNote", () => {
  it("shows the note and a privacy policy link that opens in a new tab", () => {
    render(<AiPrivacyNote text={NOTE} testId="ai-note" className="text-xs" />);
    const note = screen.getByTestId("ai-note");
    expect(note).toHaveTextContent(NOTE);
    expect(note).toHaveClass("text-xs");
    const link = screen.getByTestId("ai-note-link");
    expect(link).toHaveTextContent("Privacy policy");
    expect(link.getAttribute("href")).toBe(
      "https://astrapi69.github.io/adaptive-learner/docs/en/legal/privacy/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(note).toContainElement(link);
  });

  it.each([
    ["de", "https://astrapi69.github.io/adaptive-learner/docs/legal/privacy/"],
    [
      "ja",
      "https://astrapi69.github.io/adaptive-learner/docs/ja/legal/privacy/",
    ],
    [
      "ko",
      "https://astrapi69.github.io/adaptive-learner/docs/en/legal/privacy/",
    ],
  ])(
    "links the %s privacy policy (German at the root, no docs locale falls back to English)",
    (lang, href) => {
      i18n.lang = lang;
      render(<AiPrivacyNote text={NOTE} testId="ai-note" />);
      expect(screen.getByTestId("ai-note-link").getAttribute("href")).toBe(
        href,
      );
    },
  );
});
