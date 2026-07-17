/**
 * Tests for the Settings AI-tab "Configured AI providers" overview
 * (#810, test button #813).
 *
 * Pins:
 * - Three configured providers → three rows, each "Active" with a masked
 *   preview shown.
 * - An empty provider → "Empty" status, no delete/test button, an
 *   "Add key" affordance.
 * - The masked preview renders exactly the first 4 + last 4 chars.
 * - The active provider is highlighted + its radio is checked.
 * - Edit / Delete / Test / set-active actions fire their callbacks.
 * - The Test button shows a spinner while testing, renders the inline
 *   result (ok / invalid / network), auto-hides success after 10s, and
 *   is disabled + backend-only for a CORS-blocked provider in Dexie mode.
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfiguredProvidersTable from "./ConfiguredProvidersTable";
import type { AIProvider } from "../../../lib/constants";
import type { ApiKeyTestResult } from "../../../storage/types";
import type { UserSettings } from "../../../types/domain";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

function settings(over: Partial<UserSettings> = {}): UserSettings {
  return {
    id: "us-1",
    user_id: "u-1",
    language: "en",
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
    key_preview_anthropic: null,
    key_preview_openai: null,
    key_preview_gemini: null,
    created_at: "2026-06-19T00:00:00Z",
    updated_at: "2026-06-19T00:00:00Z",
    ...over,
  };
}

const NO_RESULTS: Record<AIProvider, ApiKeyTestResult | null> = {
  anthropic: null,
  openai: null,
  gemini: null,
};

const noop = () => {};

interface RenderOpts {
  settings?: UserSettings;
  mode?: "api" | "dexie";
  busy?: string | null;
  testResults?: Record<AIProvider, ApiKeyTestResult | null>;
  onSetActive?: (p: AIProvider) => void;
  onEdit?: (p: AIProvider) => void;
  onDelete?: (p: AIProvider) => void;
  onTest?: (p: AIProvider) => void;
  onImportKeys?: () => void;
}

function renderTable(opts: RenderOpts = {}) {
  return render(
    <ConfiguredProvidersTable
      settings={opts.settings ?? settings()}
      mode={opts.mode ?? "api"}
      busy={opts.busy ?? null}
      testResults={opts.testResults ?? NO_RESULTS}
      onSetActive={opts.onSetActive ?? noop}
      onEdit={opts.onEdit ?? noop}
      onDelete={opts.onDelete ?? noop}
      onTest={opts.onTest ?? noop}
      onImportKeys={opts.onImportKeys ?? noop}
    />,
  );
}

const configured = (over: Partial<UserSettings> = {}) =>
  settings({
    has_anthropic_key: true,
    key_source_anthropic: "settings",
    key_preview_anthropic: "sk-a…WXYZ",
    ...over,
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("ConfiguredProvidersTable — key import link (#1765)", () => {
  it("renders an Import button that fires onImportKeys", () => {
    const onImportKeys = vi.fn();
    renderTable({ onImportKeys });
    const button = screen.getByTestId("configured-providers-import");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onImportKeys).toHaveBeenCalledTimes(1);
  });
});

describe("ConfiguredProvidersTable", () => {
  it("shows all three providers as Active with masked previews when configured", () => {
    renderTable({
      settings: settings({
        has_anthropic_key: true,
        has_openai_key: true,
        has_gemini_key: true,
        key_source_anthropic: "settings",
        key_source_openai: "settings",
        key_source_gemini: "settings",
        key_preview_anthropic: "sk-a…WXYZ",
        key_preview_openai: "sk-p…1234",
        key_preview_gemini: "AIza…7f3k",
      }),
    });

    for (const provider of ["anthropic", "openai", "gemini"] as const) {
      expect(screen.getByTestId(`provider-overview-row-${provider}`)).toBeInTheDocument();
      expect(screen.getByTestId(`provider-overview-status-${provider}`)).toHaveTextContent(
        "Active",
      );
    }
    expect(screen.getByTestId("provider-overview-preview-gemini")).toHaveTextContent("AIza…7f3k");
    expect(screen.getByTestId("provider-overview-preview-anthropic")).toHaveTextContent(
      "sk-a…WXYZ",
    );
  });

  it("shows Empty + Add affordance and no delete/test button for an unconfigured provider", () => {
    renderTable();

    expect(screen.getByTestId("provider-overview-status-openai")).toHaveTextContent("Empty");
    expect(screen.getByTestId("provider-overview-preview-openai")).toHaveTextContent("—");
    expect(screen.queryByTestId("provider-overview-delete-openai")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provider-overview-test-openai")).not.toBeInTheDocument();
    expect(screen.getByTestId("provider-overview-edit-openai")).toHaveAccessibleName(/Add key/i);
  });

  it("highlights the active provider and checks its radio", () => {
    renderTable({
      settings: settings({
        active_provider: "gemini",
        has_gemini_key: true,
        key_source_gemini: "settings",
        key_preview_gemini: "AIza…7f3k",
      }),
    });

    expect(screen.getByTestId("provider-overview-active-gemini")).toBeChecked();
    expect(screen.getByTestId("provider-overview-active-anthropic")).not.toBeChecked();
    expect(screen.getByTestId("provider-overview-badge-gemini")).toBeInTheDocument();
  });

  it("fires onEdit, onDelete, onTest and onSetActive callbacks", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onTest = vi.fn();
    const onSetActive = vi.fn();
    renderTable({ settings: configured(), onEdit, onDelete, onTest, onSetActive });

    fireEvent.click(screen.getByTestId("provider-overview-edit-anthropic"));
    expect(onEdit).toHaveBeenCalledWith("anthropic");

    fireEvent.click(screen.getByTestId("provider-overview-test-anthropic"));
    expect(onTest).toHaveBeenCalledWith("anthropic");

    fireEvent.click(screen.getByTestId("provider-overview-delete-anthropic"));
    expect(onDelete).toHaveBeenCalledWith("anthropic");

    fireEvent.click(screen.getByTestId("provider-overview-active-openai"));
    expect(onSetActive).toHaveBeenCalledWith("openai");
  });

  it("shows a spinner + disables the Test button while testing", () => {
    renderTable({ settings: configured(), busy: "test-anthropic" });
    const btn = screen.getByTestId("provider-overview-test-anthropic");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Testing…");
  });

  it("renders a green 'Connection ok' result on success", () => {
    renderTable({
      settings: configured(),
      testResults: { ...NO_RESULTS, anthropic: { success: true, kind: "ok" } },
    });
    const result = screen.getByTestId("provider-overview-test-result-anthropic");
    expect(result).toHaveTextContent("Connection ok");
    expect(result).toHaveClass("text-success");
  });

  it("renders 'Key invalid' on a 401 result and 'Network error' offline", () => {
    const { rerender } = renderTable({
      settings: configured(),
      testResults: { ...NO_RESULTS, anthropic: { success: false, kind: "invalid" } },
    });
    expect(screen.getByTestId("provider-overview-test-result-anthropic")).toHaveTextContent(
      "Key invalid",
    );
    expect(screen.getByTestId("provider-overview-test-result-anthropic")).toHaveClass("text-error");

    rerender(
      <ConfiguredProvidersTable
        settings={configured()}
        mode="api"
        busy={null}
        testResults={{ ...NO_RESULTS, anthropic: { success: false, kind: "network" } }}
        onSetActive={noop}
        onEdit={noop}
        onDelete={noop}
        onTest={noop}
        onImportKeys={noop}
      />,
    );
    expect(screen.getByTestId("provider-overview-test-result-anthropic")).toHaveTextContent(
      "Network error",
    );
  });

  it("auto-hides the success result after 10 seconds", () => {
    vi.useFakeTimers();
    renderTable({
      settings: configured(),
      testResults: { ...NO_RESULTS, anthropic: { success: true, kind: "ok" } },
    });
    expect(screen.getByTestId("provider-overview-test-result-anthropic")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(
      screen.queryByTestId("provider-overview-test-result-anthropic"),
    ).not.toBeInTheDocument();
  });

  it("disables Test + shows the backend-only tooltip for a CORS-blocked provider in Dexie mode", async () => {
    const statusModule = await import("../../../lib/providers/aiProviderStatus");
    const spy = vi
      .spyOn(statusModule, "isDesktopOnlyProvider")
      .mockImplementation((p) => p === "openai");

    renderTable({
      settings: configured({
        has_openai_key: true,
        key_source_openai: "settings",
        key_preview_openai: "sk-p…1234",
      }),
      mode: "dexie",
    });

    expect(screen.getByTestId("provider-overview-status-openai")).toHaveTextContent("Desktop only");
    const btn = screen.getByTestId("provider-overview-test-openai");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleName(/Only testable with the backend/i);
    spy.mockRestore();
  });
});
