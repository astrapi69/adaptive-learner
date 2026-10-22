/**
 * ContentShareDialog (#3812): the privacy note of the AI review before
 * sharing names the provider in the UI language. It must never show the raw
 * provider id ("anthropic") or the English "the AI provider" inside a
 * sentence of another language.
 */

import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UseContentSharingResult } from "../../../hooks/content/useContentSharing";

const catalog = vi.hoisted(
  (): Record<string, string> => ({
    "content.ai_validation.privacy":
      "Gesendet werden nur die Inhalte deiner Lektion (Karten, Texte, Übungen), kein Profil und kein Lernfortschritt. Wie bei jeder Anfrage erhält {provider} dabei unter anderem deine IP-Adresse und deinen API-Schlüssel.",
    "content.ai_validation.provider_fallback": "dein KI-Anbieter",
    "settings.provider_anthropic": "Anthropic Claude",
    "settings.provider_gemini": "Google Gemini",
  }),
);

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => catalog[key] ?? fallback ?? key,
    lang: "de",
  }),
}));

// The wizard itself is covered by its own tests; here it only has to render
// the AI section the dialog hands it.
vi.mock("./ShareWizard", () => ({
  default: ({ aiSection }: { aiSection?: ReactNode }) => <div>{aiSection}</div>,
}));

import ContentShareDialog from "./ContentShareDialog";

/** Render the dialog at the quality step, before the AI review runs. */
function renderPrivacyNote(activeProvider: string | null): HTMLElement {
  const share = {
    shareTarget: { id: "es-a1", title: "Spanisch A1" },
    shareResult: { ok: true, issues: [] },
    aiResult: null,
    aiRunning: false,
    aiConsent: false,
    setAiConsent: vi.fn(),
    appliedFixes: new Set<string>(),
  } as unknown as UseContentSharingResult;
  render(
    <ContentShareDialog
      share={share}
      knownSets={[]}
      repo="astrapi69/adaptive-learner-content"
      branch="main"
      hasKey
      activeProvider={activeProvider}
      navigate={vi.fn()}
      onEditUserSet={vi.fn()}
      onShared={vi.fn()}
    />,
  );
  return screen.getByTestId("content-ai-privacy");
}

describe("ContentShareDialog privacy note", () => {
  it("names the active provider by its label in the UI language", () => {
    const note = renderPrivacyNote("anthropic");
    expect(note).toHaveTextContent("erhält Anthropic Claude dabei unter anderem deine IP-Adresse");
    expect(note).not.toHaveTextContent(/\banthropic\b/);
  });

  it("uses the localized fallback when no provider is active", () => {
    const note = renderPrivacyNote(null);
    expect(note).toHaveTextContent("erhält dein KI-Anbieter dabei unter anderem deine IP-Adresse");
    expect(note).not.toHaveTextContent("the AI provider");
  });

  it.each([
    ["gemini", "erhält Google Gemini dabei"],
    // A provider without a label key keeps its id: there is no better name.
    ["mistral", "erhält mistral dabei"],
  ])("names provider %s as %j", (provider, expected) => {
    expect(renderPrivacyNote(provider)).toHaveTextContent(expected);
  });
});
