import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import type { UserSettings } from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

const apiGet = vi.fn();
const apiUpdate = vi.fn();
const apiSetKey = vi.fn();
const apiDeleteKey = vi.fn();
vi.mock("../api/client", async () => {
  const actual =
    await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      settings: {
        ...actual.api.settings,
        get: (...args: unknown[]) => apiGet(...args),
        update: (...args: unknown[]) => apiUpdate(...args),
        setApiKey: (...args: unknown[]) => apiSetKey(...args),
        deleteApiKey: (...args: unknown[]) => apiDeleteKey(...args),
      },
    },
  };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const BASE: UserSettings = {
  id: "us-1",
  user_id: "u-1",
  language: "de",
  active_provider: "anthropic",
  has_anthropic_key: false,
  has_openai_key: false,
  has_gemini_key: false,
  model_override_anthropic: null,
  model_override_openai: null,
  model_override_gemini: null,
  key_source_anthropic: "none",
  key_source_openai: "none",
  key_source_gemini: "none",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

function renderSettings(initialEntry = "/settings") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Settings />
    </MemoryRouter>,
  );
}

describe("Settings page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    apiGet.mockReset();
    apiUpdate.mockReset();
    apiSetKey.mockReset();
    apiDeleteKey.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /onboarding when user_id is missing", async () => {
    localStorage.removeItem("adaptive-learner.user_id");
    renderSettings();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
        replace: true,
      });
    });
  });

  it("renders the three sections after loading", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-language")).toBeInTheDocument();
    expect(screen.getByTestId("settings-provider")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-row-anthropic")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-row-openai")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-row-gemini")).toBeInTheDocument();
  });

  it("renders the tab bar with General active by default", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // General panel sections are visible; AI panel is hidden.
    expect(screen.getByTestId("settings-section-ui")).toBeVisible();
    expect(screen.getByTestId("settings-model-overrides")).not.toBeVisible();
  });

  it("switching tabs reveals that tab's panel", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-ai"));
    expect(screen.getByTestId("settings-tab-ai")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("settings-model-overrides")).toBeVisible();
    // The General Interface section is now hidden.
    expect(screen.getByTestId("settings-section-ui")).not.toBeVisible();
    // Learning panel hosts the feedback section.
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-section-feedback")).toBeVisible();
  });

  it("scopes the Help browser to the Help tab (regression for the leak)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Default General tab: the help browser must NOT be visible.
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
    // Another non-help tab keeps it hidden.
    fireEvent.click(screen.getByTestId("settings-tab-ai"));
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
    // Only the Help tab reveals it.
    fireEvent.click(screen.getByTestId("settings-tab-help"));
    expect(screen.getByTestId("settings-help-section")).toBeVisible();
  });

  it("opens the tab from the ?tab= URL param (deep link)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-data")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
    // General sections are hidden when a deep link opens another tab.
    expect(screen.getByTestId("settings-section-ui")).not.toBeVisible();
  });

  it("falls back to General for an unknown ?tab= value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=bogus");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changing the language calls update + flips i18n provider", async () => {
    apiGet.mockResolvedValue(BASE);
    apiUpdate.mockResolvedValue({ ...BASE, language: "en" });
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.change(screen.getByTestId("settings-language"), {
        target: { value: "en" },
      });
    });
    await waitFor(() => {
      expect(apiUpdate).toHaveBeenCalledWith("u-1", { language: "en" });
    });
    expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
  });

  it("changing the provider calls update", async () => {
    apiGet.mockResolvedValue(BASE);
    apiUpdate.mockResolvedValue({ ...BASE, active_provider: "openai" });
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.change(screen.getByTestId("settings-provider"), {
        target: { value: "openai" },
      });
    });
    await waitFor(() => {
      expect(apiUpdate).toHaveBeenCalledWith("u-1", {
        active_provider: "openai",
      });
    });
  });

  it("Save key is disabled until the draft is non-empty", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const save = screen.getByTestId(
      "api-key-save-anthropic",
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: "sk-xxx" },
    });
    expect(save.disabled).toBe(false);
  });

  it("Save key posts the encrypted-write body and clears the draft", async () => {
    apiGet.mockResolvedValue(BASE);
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: "sk-xxx" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    await waitFor(() => {
      expect(apiSetKey).toHaveBeenCalledWith("u-1", {
        provider: "anthropic",
        key: "sk-xxx",
      });
    });
    // After success the status flips to "set" and a Delete
    // button is rendered.
    await screen.findByTestId("api-key-delete-anthropic");
    expect(
      (screen.getByTestId("api-key-input-anthropic") as HTMLInputElement).value,
    ).toBe("");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("Delete key fires only after window.confirm", async () => {
    apiGet.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    apiDeleteKey.mockResolvedValue(BASE);
    // happy-dom doesn't ship window.confirm; install a stub
    // before vi.spyOn would otherwise reject for "function
    // undefined".
    const confirmStub = vi.fn().mockReturnValue(true);
    (window as unknown as { confirm: typeof confirmStub }).confirm =
      confirmStub;
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-delete-anthropic"));
    });
    expect(confirmStub).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiDeleteKey).toHaveBeenCalledWith("u-1", "anthropic");
    });
  });

  it("Delete key cancellation does NOT call the API", async () => {
    apiGet.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    const confirmStub = vi.fn().mockReturnValue(false);
    (window as unknown as { confirm: typeof confirmStub }).confirm =
      confirmStub;
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("api-key-delete-anthropic"));
    expect(confirmStub).toHaveBeenCalled();
    expect(apiDeleteKey).not.toHaveBeenCalled();
  });

  it("renders an error state when /settings GET fails", async () => {
    const { ApiError } = await import("../api/client");
    apiGet.mockRejectedValue(new ApiError(500, "DB down"));
    renderSettings();
    await screen.findByTestId("settings-error");
    expect(screen.getByTestId("settings-error").textContent).toContain(
      "DB down",
    );
  });

  // --- v0.2.0: Active-provider visual feedback ---------------------

  it("renders the Active badge next to the active provider's API-key row", async () => {
    apiGet.mockResolvedValue({ ...BASE, active_provider: "openai" });
    renderSettings();
    await screen.findByTestId("settings");
    // Active badge appears on the openai row.
    expect(screen.getByTestId("api-key-active-openai")).toBeInTheDocument();
    // NOT on the anthropic / gemini rows.
    expect(
      screen.queryByTestId("api-key-active-anthropic"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("api-key-active-gemini"),
    ).not.toBeInTheDocument();
  });

  it("renders the missing-key warning when the active provider has no key", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      active_provider: "openai",
      has_openai_key: false,
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-warning-openai")).toBeInTheDocument();
  });

  it("hides the missing-key warning when the active provider has a key", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      active_provider: "openai",
      has_openai_key: true,
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(
      screen.queryByTestId("api-key-warning-openai"),
    ).not.toBeInTheDocument();
  });

  it("non-active providers without keys do NOT get the warning", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      active_provider: "anthropic",
      has_anthropic_key: true,
      has_openai_key: false, // no key, but openai is not active
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(
      screen.queryByTestId("api-key-warning-openai"),
    ).not.toBeInTheDocument();
    // The Active badge is on anthropic, not openai.
    expect(screen.getByTestId("api-key-active-anthropic")).toBeInTheDocument();
  });

  // --- v0.4.0: model overrides -------------------------------------------

  it("renders the model-override section with one row per provider", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-model-overrides")).toBeInTheDocument();
    for (const provider of ["anthropic", "openai", "gemini"]) {
      expect(
        screen.getByTestId(`model-override-row-${provider}`),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId(`model-picker-input-${provider}`),
      ).toBeInTheDocument();
    }
  });

  it("model input seeds from the persisted override on load", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      model_override_anthropic: "claude-sonnet-4-20250514",
    });
    renderSettings();
    await screen.findByTestId("settings");
    const input = screen.getByTestId(
      "model-picker-input-anthropic",
    ) as HTMLInputElement;
    expect(input.value).toBe("claude-sonnet-4-20250514");
    // Status badge reads as "override active".
    expect(
      screen.getByTestId("model-override-status-anthropic").textContent,
    ).toBeTruthy();
  });

  it("Save model PATCH only fires for the dirty provider", async () => {
    apiGet.mockResolvedValue(BASE);
    apiUpdate.mockResolvedValue({
      ...BASE,
      model_override_anthropic: "claude-sonnet-4-20250514",
    });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("model-picker-input-anthropic"), {
      target: { value: "claude-sonnet-4-20250514" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("model-override-save-anthropic"));
    });
    await waitFor(() => {
      expect(apiUpdate).toHaveBeenCalledWith("u-1", {
        model_override_anthropic: "claude-sonnet-4-20250514",
      });
    });
  });

  it("Save button is disabled when the draft equals the persisted value", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      model_override_anthropic: "claude-sonnet-4-20250514",
    });
    renderSettings();
    await screen.findByTestId("settings");
    const save = screen.getByTestId(
      "model-override-save-anthropic",
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("Use default sends empty-string to clear the override", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      model_override_anthropic: "claude-sonnet-4-20250514",
    });
    apiUpdate.mockResolvedValue({
      ...BASE,
      model_override_anthropic: null,
    });
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.click(screen.getByTestId("model-override-clear-anthropic"));
    });
    await waitFor(() => {
      expect(apiUpdate).toHaveBeenCalledWith("u-1", {
        model_override_anthropic: "",
      });
    });
  });

  it("Use default button is hidden when no override is set", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(
      screen.queryByTestId("model-override-clear-anthropic"),
    ).not.toBeInTheDocument();
  });

  it("renders the Phase 10F storage-mode section with both radios", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-storage-mode")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-api")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-dexie")).toBeInTheDocument();
    expect(screen.getByTestId("storage-mode-warning")).toBeInTheDocument();
  });

  it("api mode is the default selection on a fresh browser", async () => {
    localStorage.removeItem("adaptive-learner.storage_mode");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const apiRadio = screen.getByTestId("storage-mode-api") as HTMLInputElement;
    const dexieRadio = screen.getByTestId(
      "storage-mode-dexie",
    ) as HTMLInputElement;
    expect(apiRadio.checked).toBe(true);
    expect(dexieRadio.checked).toBe(false);
  });

  it("clicking the dexie radio persists the choice + toasts a reload reminder", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const dexieRadio = screen.getByTestId(
      "storage-mode-dexie",
    ) as HTMLInputElement;
    fireEvent.click(dexieRadio);
    expect(localStorage.getItem("adaptive-learner.storage_mode")).toBe("dexie");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Reload/i));
  });
});

describe("Settings — gesture toggle (Phase 23E)", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiGet.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the gesture toggle in the Interface section", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-section-ui")).toBeInTheDocument();
    expect(screen.getByTestId("settings-gestures-toggle")).toBeInTheDocument();
  });

  it("flipping the toggle persists the new value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId(
      "settings-gestures-toggle",
    ) as HTMLInputElement;
    const initial = toggle.checked;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(!initial);
    expect(localStorage.getItem("adaptive-learner.gestures_enabled")).toBe(
      String(!initial),
    );
  });

  it("initialises from the persisted value (true)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "true");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId(
      "settings-gestures-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("initialises from the persisted value (false)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "false");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId(
      "settings-gestures-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });
});

describe("Settings — per-provider key source (Phase 34)", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiUpdate.mockReset();
    apiSetKey.mockReset();
    apiDeleteKey.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });

  it("renders 'Key from: Settings' badge when source is settings", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: true,
      key_source_anthropic: "settings",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(
      /Settings/,
    );
    // No externally-managed banner.
    expect(
      screen.queryByTestId("api-key-external-anthropic"),
    ).not.toBeInTheDocument();
    // Save + input are enabled.
    expect(screen.getByTestId("api-key-input-anthropic")).not.toBeDisabled();
  });

  it("renders 'Key from: secrets.yaml' badge + disables Save when externally managed", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: false,
      key_source_anthropic: "secrets_yaml",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(
      /secrets\.yaml/,
    );
    expect(screen.getByTestId("api-key-external-anthropic")).toHaveTextContent(
      /secrets\.yaml/,
    );
    expect(screen.getByTestId("api-key-save-anthropic")).toBeDisabled();
    expect(screen.getByTestId("api-key-input-anthropic")).toBeDisabled();
  });

  it("renders 'Key from: environment' badge + env-var hint when externally managed", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_openai_key: false,
      key_source_openai: "env",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-openai")).toHaveTextContent(
      /environment/,
    );
    // Env hint substitutes the OPENAI provider name.
    expect(screen.getByTestId("api-key-external-openai")).toHaveTextContent(
      /OPENAI/,
    );
    expect(screen.getByTestId("api-key-save-openai")).toBeDisabled();
  });

  it("suppresses the active-provider 'missing key' warning when key is externally managed", async () => {
    // Anthropic is the active provider AND has no key —
    // but it's externally managed (env), so the existing
    // "save a key" warning should NOT render. The
    // externally-managed banner replaces it.
    apiGet.mockResolvedValue({
      ...BASE,
      active_provider: "anthropic",
      has_anthropic_key: false,
      key_source_anthropic: "env",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(
      screen.queryByTestId("api-key-warning-anthropic"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("api-key-external-anthropic"),
    ).toBeInTheDocument();
  });

  it("hides the Remove button when externally managed (even if has_*_key is true)", async () => {
    // Edge: the DB column had a key from a previous UI
    // configuration, but secrets.yaml has overridden it.
    // Removing the DB column would have no user-visible
    // effect (the resolver still picks the yaml key), so we
    // hide the Remove button to avoid the confusing dance.
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: true,
      key_source_anthropic: "secrets_yaml",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(
      screen.queryByTestId("api-key-delete-anthropic"),
    ).not.toBeInTheDocument();
  });

  it("renders 'No key configured' when source is none and no key stored", async () => {
    apiGet.mockResolvedValue({ ...BASE }); // all sources default "none"
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(
      /No key/,
    );
  });
});
