// The Dexie-mode regression test (issue #51) drives the storage-row-count
// effect down the Dexie branch, which opens IndexedDB. Provide an
// in-memory implementation so it resolves instead of throwing.
import "fake-indexeddb/auto";

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import { TestFeatureProvider } from "../../features/testFeatureProvider";
import type { UserSettings } from "../../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const apiGet = vi.fn();
const apiUpdate = vi.fn();
const apiUsersGet = vi.fn();
const apiUsersUpdate = vi.fn();
const apiSetKey = vi.fn();
const apiDeleteKey = vi.fn();
const apiTestKey = vi.fn();
const apiBackupKey = vi.fn();
const apiGetBackup = vi.fn();
const apiRestoreBackup = vi.fn();
const apiAvailableModels = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      users: {
        ...actual.api.users,
        get: (...args: unknown[]) => apiUsersGet(...args),
        update: (...args: unknown[]) => apiUsersUpdate(...args),
      },
      settings: {
        ...actual.api.settings,
        get: (...args: unknown[]) => apiGet(...args),
        update: (...args: unknown[]) => apiUpdate(...args),
        setApiKey: (...args: unknown[]) => apiSetKey(...args),
        deleteApiKey: (...args: unknown[]) => apiDeleteKey(...args),
        // ModelPicker fetches the provider model list on mount; mock it so the
        // settings page makes no real network connection in the unit run.
        getAvailableModels: (...args: unknown[]) => apiAvailableModels(...args),
        testApiKey: (...args: unknown[]) => apiTestKey(...args),
        backupApiKey: (...args: unknown[]) => apiBackupKey(...args),
        getApiKeyBackup: (...args: unknown[]) => apiGetBackup(...args),
        restoreApiKeyBackup: (...args: unknown[]) => apiRestoreBackup(...args),
      },
    },
  };
});

// Issue #51 — drive resolveStorageMode() without touching the real
// storage factory (so the page still loads via the mocked api client).
// Mutated per-test; defaults to "api" so every existing test is
// unaffected.
const storageState = vi.hoisted(() => ({ mode: "api" as "api" | "dexie" }));
vi.mock("../../storage", async () => {
  const actual = await vi.importActual<typeof import("../../storage")>("../../storage");
  return { ...actual, resolveStorageMode: () => storageState.mode };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../utils/notify", () => ({
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
          avatar: null,
  key_source_anthropic: "none",
  key_source_openai: "none",
  key_source_gemini: "none",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

// A format-valid Anthropic key (sk-ant- prefix, >= 90 chars) so the
// C1 format gate lets Save enable.
const VALID_ANTHROPIC_KEY = "sk-ant-" + "a".repeat(95);

function renderSettings(initialEntry = "/settings") {
  return render(
    <TestFeatureProvider context={{ mode: storageState.mode }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Settings />
      </MemoryRouter>
    </TestFeatureProvider>,
  );
}

describe("Settings page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    apiGet.mockReset();
    apiUpdate.mockReset();
    apiUsersGet.mockReset();
    apiUsersUpdate.mockReset();
    // #579 — the active learner the profile section edits.
    apiUsersGet.mockResolvedValue({ id: "u-1", name: "Ada Lovelace", language: "de" });
    apiUsersUpdate.mockImplementation((_id: string, body: { name?: string }) =>
      Promise.resolve({ id: "u-1", name: body.name ?? "Ada Lovelace", language: "de" }),
    );
    apiSetKey.mockReset();
    apiDeleteKey.mockReset();
    apiTestKey.mockReset();
    apiBackupKey.mockReset();
    apiGetBackup.mockReset();
    apiRestoreBackup.mockReset();
    // C4 defaults: a key tests OK and a backup roundtrips. Tests that
    // exercise the failure path override apiTestKey per-test.
    apiTestKey.mockResolvedValue({ success: true, kind: "ok" });
    apiBackupKey.mockResolvedValue(BASE);
    apiGetBackup.mockResolvedValue({ has: false, tested_at: null });
    apiRestoreBackup.mockResolvedValue(BASE);
    toastSuccess.mockReset();
    toastError.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
    storageState.mode = "api";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #335 (supersedes #51) — Sync needs a reachable backend; in Dexie
  // mode (GitHub Pages / PWA-only, no backend) the controls are
  // replaced by a visible desktop-only notice, never hidden.
  it("renders the Sync section in the Data tab when a backend is available (API mode)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-sync")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-sync-desktop-only")).not.toBeInTheDocument();
  });

  it("replaces the Sync controls with a desktop-only notice in Dexie mode", async () => {
    storageState.mode = "dexie";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    // The Data panel still renders (Backup stays available)...
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
    expect(screen.getByTestId("settings-backup")).toBeInTheDocument();
    // ...the Sync controls are gone, but the section header stays
    // visible with the desktop-only notice (#335: disabled, not hidden).
    expect(screen.queryByTestId("settings-sync")).not.toBeInTheDocument();
    const notice = screen.getByTestId("settings-sync-desktop-only");
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent("Sync");
  });

  // #1451 — the Data tab sections follow a FIXED causal order:
  // source (content repos) -> sync -> what results (cache) ->
  // securing (backup/export) -> reversible cleanup (orphaned data) ->
  // irreversible danger zone LAST. Pinned by relative DOM order so a
  // future edit cannot silently regress it (e.g. put the danger zone
  // above Sync). "Install app" moved to the General tab in #1455 (it
  // configures HOW the app runs, not WHAT it stores).
  it("orders the Data-tab sections causally (content repos first, danger zone last) (#1451)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-data");
    // Section-root testids in their intended causal order.
    const CAUSAL_ORDER = [
      "content-repo-section",
      "settings-sync",
      "settings-section-cache",
      "settings-backup",
      "key-vault-section",
      "export-section",
      "settings-section-orphaned",
      "settings-danger-zone",
    ];
    // Collect the section roots present, in DOM order (de-duped: a
    // section root's own testid, not the nested ones it contains).
    const seen = new Set<string>();
    const domOrder = Array.from(panel.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && CAUSAL_ORDER.includes(id))
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
    const expected = CAUSAL_ORDER.filter((id) => domOrder.includes(id));
    expect(domOrder).toEqual(expected);
    // Headline invariants (causality + safety).
    expect(domOrder[0]).toBe("content-repo-section");
    expect(domOrder[domOrder.length - 1]).toBe("settings-danger-zone");
    expect(domOrder.indexOf("content-repo-section")).toBeLessThan(
      domOrder.indexOf("settings-sync"),
    );
  });

  // #1459 — the Learning tab sections follow a FIXED causal order
  // (same principle as the #1451 Data-tab pin): foundation (profile,
  // source languages) -> in-lesson flow (mode, direction, hints,
  // matching effect, interaction toggles, voice) -> practice &
  // follow-up (review, SRS, summary) -> motivation (feedback,
  // missions) -> reminders -> rare housekeeping LAST (paused
  // retention, max lesson size). Pinned by relative DOM order so a
  // future edit cannot silently regress it.
  it("orders the Learning-tab sections causally (profile first, housekeeping last) (#1459)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-learning");
    // Section-root testids in their intended causal order.
    const CAUSAL_ORDER = [
      "settings-section-profile",
      "settings-section-source-languages",
      "settings-section-lesson-mode",
      "settings-section-direction-strategy",
      "settings-section-hints",
      "settings-section-matching-resolve",
      "settings-section-interaction",
      "settings-section-voice",
      "settings-section-review",
      "settings-section-srs",
      "settings-section-summary-sections",
      "settings-section-feedback",
      "settings-section-missions",
      "settings-section-reminders",
      "settings-section-paused-retention",
      "settings-section-max-lesson-size",
    ];
    // Collect the section roots present, in DOM order (de-duped: a
    // section root's own testid, not the nested ones it contains).
    const seen = new Set<string>();
    const domOrder = Array.from(panel.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && CAUSAL_ORDER.includes(id))
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
    // Voice hides itself when the environment supports neither TTS nor
    // STT (happy-dom does not), so compare against the present subset —
    // but require every other section explicitly, so a silently dropped
    // section cannot make the relative-order assertion vacuously pass.
    const ALWAYS_PRESENT = CAUSAL_ORDER.filter((id) => id !== "settings-section-voice");
    ALWAYS_PRESENT.forEach((id) => expect(domOrder).toContain(id));
    expect(domOrder).toEqual(CAUSAL_ORDER.filter((id) => domOrder.includes(id)));
    // Headline invariants: the in-lesson interaction toggles sit with
    // the lesson-flow block (before Review), review and SRS are
    // adjacent, and housekeeping is last.
    expect(domOrder.indexOf("settings-section-interaction")).toBeLessThan(
      domOrder.indexOf("settings-section-review"),
    );
    expect(domOrder.indexOf("settings-section-srs")).toBe(
      domOrder.indexOf("settings-section-review") + 1,
    );
    expect(domOrder[domOrder.length - 1]).toBe("settings-section-max-lesson-size");
  });

  // #1455 — "Install app" lives in the GENERAL tab (it configures HOW
  // the app runs: standalone window, homescreen, starts without network),
  // not in Data (WHAT the app stores). The section stays mounted on both
  // tabs' URLs (panels are hidden, not unmounted), so the assertions
  // check containment + visibility, not existence.
  it("hosts the Install-app section in the General tab, not in Data (#1455)", async () => {
    storageState.mode = "api";
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=general");
    await screen.findByTestId("settings");
    const install = screen.getByTestId("settings-install-section");
    // Not a descendant of the Data panel anymore.
    expect(
      screen.getByTestId("settings-panel-data").contains(install),
    ).toBe(false);
    // Visible on the General tab...
    expect(install).toBeVisible();
    // ...hidden when another tab is active.
    fireEvent.click(screen.getByTestId("settings-tab-data"));
    expect(screen.getByTestId("settings-install-section")).not.toBeVisible();
    // The install button keeps its visible-but-disabled behavior at the
    // new mount point (no browser install offer in happy-dom -> disabled).
    fireEvent.click(screen.getByTestId("settings-tab-general"));
    const button = screen.getByTestId(
      "settings-install-button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute("aria-current", "page");
    // General panel sections are visible; AI panel is hidden.
    expect(screen.getByTestId("settings-section-ui")).toBeVisible();
    expect(screen.getByTestId("settings-model-overrides")).not.toBeVisible();
  });

  it("switching tabs reveals that tab's panel", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-tab-ai"));
    expect(screen.getByTestId("settings-tab-ai")).toHaveAttribute("aria-current", "page");
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

  it("splits Help (glossary) and About into separate tabs", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Help tab: glossary visible, About panel hidden.
    fireEvent.click(screen.getByTestId("settings-tab-help"));
    expect(screen.getByTestId("settings-help-section")).toBeVisible();
    expect(screen.getByTestId("settings-panel-about")).not.toBeVisible();
    // About tab: About panel visible, glossary hidden.
    fireEvent.click(screen.getByTestId("settings-tab-about"));
    expect(screen.getByTestId("settings-panel-about")).toBeVisible();
    expect(screen.getByTestId("settings-help-section")).not.toBeVisible();
  });

  it("moves the swipe-gesture toggle to the Learning tab", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // Not on the General tab anymore.
    expect(screen.getByTestId("settings-gestures-toggle")).not.toBeVisible();
    // Visible on the Learning tab.
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-gestures-toggle")).toBeVisible();
  });

  it("opens the tab from the ?tab= URL param (deep link)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=data");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-data")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
    // General sections are hidden when a deep link opens another tab.
    expect(screen.getByTestId("settings-section-ui")).not.toBeVisible();
  });

  it("falls back to General for an unknown ?tab= value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings("/settings?tab=bogus");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-tab-general")).toHaveAttribute("aria-current", "page");
  });

  it("changing the language calls update + flips i18n provider", async () => {
    apiGet.mockResolvedValue(BASE);
    apiUpdate.mockResolvedValue({ ...BASE, language: "en" });
    renderSettings();
    await screen.findByTestId("settings");
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-language-trigger"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-language-option-en"));
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

  it("renders each API-key input as a non-password field that opts out of autofill (#767)", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    for (const provider of ["anthropic", "openai", "gemini"]) {
      const input = screen.getByTestId(`api-key-input-${provider}`);
      // type="text" (not "password") so the browser password manager
      // does not offer to autofill an API key.
      expect(input).toHaveAttribute("type", "text");
      expect(input).not.toHaveAttribute("type", "password");
      expect(input).toHaveAttribute("autocomplete", "off");
      expect(input).toHaveAttribute("data-1p-ignore");
      expect(input).toHaveAttribute("data-lpignore", "true");
      expect(input).toHaveAttribute("data-bwignore", "true");
      expect(input).toHaveAttribute("data-form-type", "other");
      // No <form> wrapper (form tags add to autofill detection).
      expect(input.closest("form")).toBeNull();
    }
  });

  it("Save key is disabled until the draft is a valid-format key", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const save = screen.getByTestId("api-key-save-anthropic") as HTMLButtonElement;
    const input = screen.getByTestId("api-key-input-anthropic");
    // Empty -> disabled.
    expect(save.disabled).toBe(true);
    // Wrong format -> still disabled + a format error is shown.
    fireEvent.change(input, { target: { value: "sk-xxx" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId("api-key-format-error-anthropic")).toBeInTheDocument();
    // Valid format -> enabled + checkmark.
    fireEvent.change(input, { target: { value: VALID_ANTHROPIC_KEY } });
    expect(save.disabled).toBe(false);
    expect(screen.getByTestId("api-key-format-ok-anthropic")).toBeInTheDocument();
  });

  it("Save key posts the encrypted-write body and clears the draft", async () => {
    apiGet.mockResolvedValue(BASE);
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    await waitFor(() => {
      expect(apiSetKey).toHaveBeenCalledWith("u-1", {
        provider: "anthropic",
        key: VALID_ANTHROPIC_KEY,
      });
    });
    // After success the status flips to "set" and a Delete
    // button is rendered.
    await screen.findByTestId("api-key-delete-anthropic");
    expect((screen.getByTestId("api-key-input-anthropic") as HTMLInputElement).value).toBe("");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("Delete key fires only after window.confirm", async () => {
    apiGet.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    apiDeleteKey.mockResolvedValue(BASE);
    // happy-dom doesn't ship window.confirm; install a stub
    // before vi.spyOn would otherwise reject for "function
    // undefined".
    const confirmStub = vi.fn().mockReturnValue(true);
    (window as unknown as { confirm: typeof confirmStub }).confirm = confirmStub;
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
    (window as unknown as { confirm: typeof confirmStub }).confirm = confirmStub;
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("api-key-delete-anthropic"));
    expect(confirmStub).toHaveBeenCalled();
    expect(apiDeleteKey).not.toHaveBeenCalled();
  });

  it("renders an error state when /settings GET fails", async () => {
    const { ApiError } = await import("../../api/client");
    apiGet.mockRejectedValue(new ApiError(500, "DB down"));
    renderSettings();
    await screen.findByTestId("settings-error");
    expect(screen.getByTestId("settings-error").textContent).toContain("DB down");
  });

  // --- v0.2.0: Active-provider visual feedback ---------------------

  it("renders the Active badge next to the active provider's API-key row", async () => {
    apiGet.mockResolvedValue({ ...BASE, active_provider: "openai" });
    renderSettings();
    await screen.findByTestId("settings");
    // Active badge appears on the openai row.
    expect(screen.getByTestId("api-key-active-openai")).toBeInTheDocument();
    // NOT on the anthropic / gemini rows.
    expect(screen.queryByTestId("api-key-active-anthropic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("api-key-active-gemini")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("api-key-warning-openai")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("api-key-warning-openai")).not.toBeInTheDocument();
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
      expect(screen.getByTestId(`model-override-row-${provider}`)).toBeInTheDocument();
      expect(screen.getByTestId(`model-picker-input-${provider}`)).toBeInTheDocument();
    }
  });

  it("model input seeds from the persisted override on load", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      model_override_anthropic: "claude-sonnet-4-20250514",
    });
    renderSettings();
    await screen.findByTestId("settings");
    const input = screen.getByTestId("model-picker-input-anthropic") as HTMLInputElement;
    expect(input.value).toBe("claude-sonnet-4-20250514");
    // Status badge reads as "override active".
    expect(screen.getByTestId("model-override-status-anthropic").textContent).toBeTruthy();
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
    const save = screen.getByTestId("model-override-save-anthropic") as HTMLButtonElement;
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
    expect(screen.queryByTestId("model-override-clear-anthropic")).not.toBeInTheDocument();
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
    const dexieRadio = screen.getByTestId("storage-mode-dexie") as HTMLInputElement;
    expect(apiRadio.checked).toBe(true);
    expect(dexieRadio.checked).toBe(false);
  });

  it("clicking the dexie radio persists the choice + toasts a reload reminder", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const dexieRadio = screen.getByTestId("storage-mode-dexie") as HTMLInputElement;
    fireEvent.click(dexieRadio);
    expect(localStorage.getItem("adaptive-learner.storage_mode")).toBe("dexie");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Reload/i));
  });

  // --- #579: editable display name in Settings > Profile ----------------
  // Dexie-mode persistence of users.update({name}) is covered by
  // dexie-storage.test.ts; the Settings component uses the same
  // mode-agnostic getStorage().users.update path in both modes.
  it("shows the current display name in the username field", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
  });

  it("edits + saves the name via users.update and updates the avatar initials", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "Grace Hopper" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() =>
      expect(apiUsersUpdate).toHaveBeenCalledWith("u-1", { name: "Grace Hopper" }),
    );
    // No avatar set -> the InitialsAvatar fallback reflects the new name live.
    await waitFor(() =>
      expect(screen.getByTestId("avatar-preview-initials")).toHaveTextContent("GH"),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("trims whitespace and caps the saved name at 50 chars", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "   " + "x".repeat(60) + "   " } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() =>
      expect(apiUsersUpdate).toHaveBeenCalledWith("u-1", { name: "x".repeat(50) }),
    );
  });

  it("rejects an empty name: no save, shows an error", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    expect(screen.getByTestId("settings-username-error")).toBeInTheDocument();
    expect(apiUsersUpdate).not.toHaveBeenCalled();
  });

  it("fires the profile-updated signal on save (live NavAvatar refresh)", async () => {
    apiGet.mockResolvedValue(BASE);
    const onSignal = vi.fn();
    window.addEventListener("adaptive-learner:profile-updated", onSignal);
    renderSettings();
    const input = (await screen.findByTestId(
      "settings-username-input",
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Ada Lovelace"));
    fireEvent.change(input, { target: { value: "Linus" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-username-save"));
    });
    await waitFor(() => expect(onSignal).toHaveBeenCalled());
    window.removeEventListener("adaptive-learner:profile-updated", onSignal);
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

  it("renders the gesture toggle in the Learning tab", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    // The toggle lives in the Learning panel (moved from General/Interface).
    expect(screen.getByTestId("settings-gestures-toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("settings-gestures-toggle")).toBeVisible();
  });

  it("flipping the toggle persists the new value", async () => {
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
    const initial = toggle.checked;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(!initial);
    expect(localStorage.getItem("adaptive-learner.gestures_enabled")).toBe(String(!initial));
  });

  it("initialises from the persisted value (true)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "true");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("initialises from the persisted value (false)", async () => {
    localStorage.setItem("adaptive-learner.gestures_enabled", "false");
    apiGet.mockResolvedValue(BASE);
    renderSettings();
    await screen.findByTestId("settings");
    const toggle = screen.getByTestId("settings-gestures-toggle") as HTMLInputElement;
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
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(/Settings/);
    // No externally-managed banner.
    expect(screen.queryByTestId("api-key-external-anthropic")).not.toBeInTheDocument();
    // Save + input are enabled.
    expect(screen.getByTestId("api-key-input-anthropic")).not.toBeDisabled();
  });

  it("renders 'Key from: secrets.yaml' badge + keeps the field EDITABLE (app writes the file)", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: false,
      key_source_anthropic: "secrets_yaml",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(/secrets\.yaml/);
    // Informational note (not the read-only "externally managed" env hint).
    expect(screen.queryByTestId("api-key-external-anthropic")).not.toBeInTheDocument();
    expect(screen.getByTestId("api-key-info-anthropic")).toHaveTextContent(/secrets\.yaml/);
    // Field stays editable so the user can overwrite the stored key.
    expect(screen.getByTestId("api-key-input-anthropic")).not.toBeDisabled();
    // Save enables once the draft is non-empty.
    const input = screen.getByTestId("api-key-input-anthropic") as HTMLInputElement;
    fireEvent.change(input, { target: { value: VALID_ANTHROPIC_KEY } });
    expect(screen.getByTestId("api-key-save-anthropic")).not.toBeDisabled();
  });

  it("shows the Remove button for a secrets.yaml key (editable source)", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: true,
      key_source_anthropic: "secrets_yaml",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-delete-anthropic")).toBeInTheDocument();
  });

  it("renders 'Key from: environment' badge + env-var hint when externally managed", async () => {
    apiGet.mockResolvedValue({
      ...BASE,
      has_openai_key: false,
      key_source_openai: "env",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-openai")).toHaveTextContent(/environment/);
    // Env hint substitutes the OPENAI provider name.
    expect(screen.getByTestId("api-key-external-openai")).toHaveTextContent(/OPENAI/);
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
    expect(screen.queryByTestId("api-key-warning-anthropic")).not.toBeInTheDocument();
    expect(screen.getByTestId("api-key-external-anthropic")).toBeInTheDocument();
  });

  it("hides the Remove button when externally managed via env var (even if has_*_key is true)", async () => {
    // An env-var-sourced key cannot be removed from the UI — the
    // user must unset the environment variable. The Remove button
    // is hidden to avoid a no-op that wouldn't change the resolver.
    apiGet.mockResolvedValue({
      ...BASE,
      has_anthropic_key: true,
      key_source_anthropic: "env",
    });
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.queryByTestId("api-key-delete-anthropic")).not.toBeInTheDocument();
  });

  it("renders 'No key configured' when source is none and no key stored", async () => {
    apiGet.mockResolvedValue({ ...BASE }); // all sources default "none"
    renderSettings();
    await screen.findByTestId("settings");
    expect(screen.getByTestId("api-key-source-anthropic")).toHaveTextContent(/No key/);
  });
});

describe("Settings — API-key test, rollback + restore (Phase 65)", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiSetKey.mockReset();
    apiTestKey.mockReset();
    apiBackupKey.mockReset();
    apiGetBackup.mockReset();
    apiRestoreBackup.mockReset();
    // #1133 — a successful live test auto-saves the drafted key, so the test
    // path runs persistKey -> setApiKey. Resolve it (the default undefined made
    // ensureUsableActiveProvider throw on `undefined`, and the test result fell
    // through to the "network" outcome — a false "Connection failed").
    apiSetKey.mockResolvedValue(BASE);
    apiBackupKey.mockResolvedValue(BASE);
    apiGetBackup.mockResolvedValue({ has: false, tested_at: null });
    apiRestoreBackup.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    toastSuccess.mockReset();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });

  it("Test button shows a success result", async () => {
    apiGet.mockResolvedValue(BASE);
    apiTestKey.mockResolvedValue({ success: true, kind: "ok" });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-test-anthropic"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("api-key-test-result-anthropic")).toHaveTextContent(/works/i);
    });
  });

  it("persists the key even when the live test fails (advisory, non-blocking) (#793)", async () => {
    apiGet.mockResolvedValue(BASE);
    apiTestKey.mockResolvedValue({ success: false, kind: "invalid" });
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    // The key is persisted up-front; a failing live test must NOT block it.
    await waitFor(() => {
      expect(apiSetKey).toHaveBeenCalled();
    });
    // A failing key is never backed up as last-known-good.
    expect(apiBackupKey).not.toHaveBeenCalled();
    // No blocking rollback panel — the failing result is surfaced instead.
    expect(
      screen.queryByTestId("api-key-rollback-anthropic"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("api-key-test-result-anthropic"),
    ).toHaveTextContent(/invalid|expired/i);
  });

  it("a successful Save persists the key AND backs it up", async () => {
    apiGet.mockResolvedValue(BASE);
    apiTestKey.mockResolvedValue({ success: true, kind: "ok" });
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    await waitFor(() => {
      expect(apiSetKey).toHaveBeenCalled();
    });
    expect(apiBackupKey).toHaveBeenCalledWith("u-1", {
      provider: "anthropic",
      key: VALID_ANTHROPIC_KEY,
    });
  });

  it("shows no restore link after a failed test when no backup exists (#793)", async () => {
    apiGet.mockResolvedValue(BASE);
    apiTestKey.mockResolvedValue({ success: false, kind: "invalid" });
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    apiGetBackup.mockResolvedValue({ has: false, tested_at: null });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    await waitFor(() => {
      expect(apiSetKey).toHaveBeenCalled();
    });
    expect(apiBackupKey).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("api-key-restore-link-anthropic"),
    ).not.toBeInTheDocument();
  });

  it("offers a standalone restore link when a failed save has a backup, and restores it (#793)", async () => {
    apiGet.mockResolvedValue(BASE);
    apiTestKey.mockResolvedValue({ success: false, kind: "invalid" });
    apiSetKey.mockResolvedValue({ ...BASE, has_anthropic_key: true });
    apiGetBackup.mockResolvedValue({
      has: true,
      tested_at: "2026-06-01T00:00:00Z",
    });
    renderSettings();
    await screen.findByTestId("settings");
    fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
      target: { value: VALID_ANTHROPIC_KEY },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("api-key-save-anthropic"));
    });
    const restore = await screen.findByTestId("api-key-restore-link-anthropic");
    // The restore re-tests after restoring; let that pass.
    apiTestKey.mockResolvedValue({ success: true, kind: "ok" });
    await act(async () => {
      fireEvent.click(restore);
    });
    await waitFor(() => {
      expect(apiRestoreBackup).toHaveBeenCalledWith("u-1", "anthropic");
    });
  });
});
