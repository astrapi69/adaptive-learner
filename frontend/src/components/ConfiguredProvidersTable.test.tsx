/**
 * Tests for the Settings AI-tab "Configured AI providers" overview (#810).
 *
 * Pins:
 * - Three configured providers → three rows, each "Active" with a masked
 *   preview shown.
 * - An empty provider → "Empty" status, no delete button, an "Add key"
 *   affordance.
 * - The masked preview renders exactly the first 4 + last 4 chars.
 * - The active provider is highlighted + its radio is checked.
 * - Edit / Delete / set-active actions fire their callbacks.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConfiguredProvidersTable from "./ConfiguredProvidersTable";
import type { UserSettings } from "../types/domain";

vi.mock("../hooks/ui/useI18n", () => ({
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

const noop = () => {};

describe("ConfiguredProvidersTable", () => {
  it("shows all three providers as Active with masked previews when configured", () => {
    render(
      <ConfiguredProvidersTable
        settings={settings({
          has_anthropic_key: true,
          has_openai_key: true,
          has_gemini_key: true,
          key_source_anthropic: "settings",
          key_source_openai: "settings",
          key_source_gemini: "settings",
          key_preview_anthropic: "sk-a…WXYZ",
          key_preview_openai: "sk-p…1234",
          key_preview_gemini: "AIza…7f3k",
        })}
        mode="api"
        busy={null}
        onSetActive={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

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

  it("shows Empty + an Add affordance and no delete button for an unconfigured provider", () => {
    render(
      <ConfiguredProvidersTable
        settings={settings()}
        mode="api"
        busy={null}
        onSetActive={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByTestId("provider-overview-status-openai")).toHaveTextContent("Empty");
    expect(screen.getByTestId("provider-overview-preview-openai")).toHaveTextContent("—");
    expect(screen.queryByTestId("provider-overview-delete-openai")).not.toBeInTheDocument();
    // Edit/Add button is always present; its accessible name is the Add variant.
    expect(screen.getByTestId("provider-overview-edit-openai")).toHaveAccessibleName(
      /Add key/i,
    );
  });

  it("highlights the active provider and checks its radio", () => {
    render(
      <ConfiguredProvidersTable
        settings={settings({ active_provider: "gemini", has_gemini_key: true, key_source_gemini: "settings", key_preview_gemini: "AIza…7f3k" })}
        mode="api"
        busy={null}
        onSetActive={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByTestId("provider-overview-active-gemini")).toBeChecked();
    expect(screen.getByTestId("provider-overview-active-anthropic")).not.toBeChecked();
    expect(screen.getByTestId("provider-overview-badge-gemini")).toBeInTheDocument();
  });

  it("fires onEdit, onDelete and onSetActive callbacks", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onSetActive = vi.fn();
    render(
      <ConfiguredProvidersTable
        settings={settings({ has_anthropic_key: true, key_source_anthropic: "settings", key_preview_anthropic: "sk-a…WXYZ" })}
        mode="api"
        busy={null}
        onSetActive={onSetActive}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTestId("provider-overview-edit-anthropic"));
    expect(onEdit).toHaveBeenCalledWith("anthropic");

    fireEvent.click(screen.getByTestId("provider-overview-delete-anthropic"));
    expect(onDelete).toHaveBeenCalledWith("anthropic");

    fireEvent.click(screen.getByTestId("provider-overview-active-openai"));
    expect(onSetActive).toHaveBeenCalledWith("openai");
  });

  it("marks a CORS-blocked provider Desktop only in Dexie mode", async () => {
    // No provider is CORS-blocked today, so drive the branch by spying on
    // the desktop-only predicate. This keeps the rendered status honest
    // (data-driven) while still covering the desktop_only render path.
    const statusModule = await import("../lib/aiProviderStatus");
    const spy = vi
      .spyOn(statusModule, "isDesktopOnlyProvider")
      .mockImplementation((p) => p === "openai");

    render(
      <ConfiguredProvidersTable
        settings={settings({ has_openai_key: true, key_source_openai: "settings", key_preview_openai: "sk-p…1234" })}
        mode="dexie"
        busy={null}
        onSetActive={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByTestId("provider-overview-status-openai")).toHaveTextContent(
      "Desktop only",
    );
    spy.mockRestore();
  });
});
