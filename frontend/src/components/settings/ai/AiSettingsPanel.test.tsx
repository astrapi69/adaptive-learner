/**
 * Regression test for #1183: the encrypted key-vault export/import
 * (EXP-038, `.alk`) lives ONLY on the Data tab. The AI tab carries a
 * single reference button that navigates to it — never a second export
 * form. (This reverses the #1182 placement.)
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AiSettingsPanel from "./AiSettingsPanel";
import type { UserSettings } from "../../../types";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

vi.mock("../../../storage", () => ({
  resolveStorageMode: () => "dexie",
  getStorage: () => ({ settings: { exportApiKeys: async () => ({}) } }),
}));

vi.mock("../../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u-1" }),
}));

vi.mock("../../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

// Keep the panel's key/model machinery inert — this test is about the
// key-export link, not the key-row behaviour (covered elsewhere).
vi.mock("../../../hooks/settings/useAiKeySettings", () => ({
  useAiKeySettings: () => ({
    busy: null,
    keyDrafts: { anthropic: "", openai: "", gemini: "" },
    setKeyDrafts: vi.fn(),
    modelDrafts: { anthropic: "", openai: "", gemini: "" },
    setModelDrafts: vi.fn(),
    testResults: {},
    backupAvailable: {},
    handleProviderChange: vi.fn(),
    handleSaveKey: vi.fn(),
    handleRestoreBackup: vi.fn(),
    handleTestKey: vi.fn(),
    handleSaveModel: vi.fn(),
    handleClearModel: vi.fn(),
    handleDeleteKey: vi.fn(),
  }),
}));

// Stub the overview table but keep its Import affordance wired, so we can
// assert AiSettingsPanel passes onOpenKeyImport down to it (#1765).
vi.mock("./ConfiguredProvidersTable", () => ({
  default: ({ onImportKeys }: { onImportKeys: () => void }) => (
    <button type="button" data-testid="configured-providers-import" onClick={onImportKeys}>
      Import
    </button>
  ),
}));
vi.mock("./ApiKeyRow", () => ({ default: () => null }));
vi.mock("./ModelPicker", () => ({ ModelPicker: () => null }));

const settings = {
  user_id: "u-1",
  active_provider: "anthropic",
  model_override_anthropic: "",
  model_override_openai: "",
  model_override_gemini: "",
  has_anthropic_key: false,
  has_openai_key: false,
  has_gemini_key: false,
} as unknown as UserSettings;

function renderPanel(onOpenKeyExport = vi.fn(), onOpenKeyImport = vi.fn()) {
  render(
    <AiSettingsPanel
      settings={settings}
      onSettingsChange={vi.fn()}
      active={true}
      onOpenKeyExport={onOpenKeyExport}
      onOpenKeyImport={onOpenKeyImport}
    />,
  );
  return { onOpenKeyExport, onOpenKeyImport };
}

describe("AiSettingsPanel — key-export link (#1183)", () => {
  it("shows the key-export reference button, not an export form", () => {
    renderPanel();
    expect(screen.getByTestId("ai-key-export-link")).toBeInTheDocument();
    // No second export entry point on the AI tab.
    expect(screen.queryByTestId("key-vault-section")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("key-vault-export-pass"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("key-vault-export-button"),
    ).not.toBeInTheDocument();
  });

  it("navigates to the export (Data tab) when the button is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenKeyExport } = renderPanel();
    await user.click(screen.getByTestId("ai-key-export-link"));
    expect(onOpenKeyExport).toHaveBeenCalledTimes(1);
  });
});

describe("AiSettingsPanel — key-import link from providers overview (#1765)", () => {
  it("fires onOpenKeyImport when the providers Import button is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenKeyImport } = renderPanel();
    await user.click(screen.getByTestId("configured-providers-import"));
    expect(onOpenKeyImport).toHaveBeenCalledTimes(1);
  });
});
