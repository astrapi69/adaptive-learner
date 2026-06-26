/**
 * Regression test for #1181: the encrypted key-vault export/import
 * (EXP-038, `.alk`) must render on the AI tab — next to the API keys it
 * carries — not only on the Data tab where a learner managing keys never
 * looks. Heavy collaborators (the key-settings hook, the key/model rows)
 * are mocked; this test only pins the placement.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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

// Keep the panel's key/model machinery inert — this test is about
// placement, not the key-row behaviour (covered elsewhere).
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

vi.mock("./ConfiguredProvidersTable", () => ({ default: () => null }));
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

describe("AiSettingsPanel — key-vault placement (#1181)", () => {
  it("renders the key vault on the AI tab", () => {
    render(
      <AiSettingsPanel
        settings={settings}
        onSettingsChange={vi.fn()}
        active={true}
      />,
    );
    expect(screen.getByTestId("key-vault-section")).toBeInTheDocument();
  });
});
