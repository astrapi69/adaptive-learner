/** Tests for the installed-plugins card (#3055, PLUGINFORGE-LIFECYCLE-UI-01). */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/client";
import type { PluginInspection } from "../../../api/client-core";
import { TestFeatureProvider } from "../../../features/testFeatureProvider";
import type { StorageMode } from "../../../storage/types";

const healthMock = vi.fn();
const inspectMock = vi.fn();
vi.mock("../../../storage", () => ({
  getStorage: () => ({ plugins: { health: healthMock, inspect: inspectMock } }),
}));
const notifyError = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: { success: vi.fn(), error: (...args: unknown[]) => notifyError(...args) },
}));

import PluginLifecycleSection from "./PluginLifecycleSection";

function inspection(
  name: string,
  over: Partial<PluginInspection["state"]> = {},
  version = "1.2.0",
): PluginInspection {
  return {
    name,
    version,
    target_application: "adaptive_learner",
    state: {
      activated: true,
      activated_at: "2026-05-23T18:00:00",
      last_config_change: null,
      source: "entry_point",
      filter_reason: null,
      load_error: null,
      ...over,
    },
  };
}

function renderCard(mode: StorageMode = "api") {
  return render(
    <TestFeatureProvider context={{ mode, hasAiKey: true }}>
      <PluginLifecycleSection />
    </TestFeatureProvider>,
  );
}

beforeEach(() => {
  healthMock.mockReset();
  inspectMock.mockReset();
  notifyError.mockReset();
  inspectMock.mockImplementation(async (name: string) => inspection(name));
});

describe("PluginLifecycleSection (#3055)", () => {
  it("lists every active plugin sorted by name with version, source and activation time", async () => {
    healthMock.mockResolvedValue({ zeta: { status: "ok" }, alpha: { status: "ok" } });
    renderCard();
    expect(screen.getByTestId("settings-plugins-lifecycle-loading")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("plugin-lifecycle-row-alpha")).toBeInTheDocument();
    });
    expect(inspectMock.mock.calls.map((call) => call[0])).toEqual(["alpha", "zeta"]);
    const rows = screen.getAllByTestId(/^plugin-lifecycle-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "plugin-lifecycle-row-alpha",
      "plugin-lifecycle-row-zeta",
    ]);
    const alpha = screen.getByTestId("plugin-lifecycle-row-alpha");
    expect(alpha).toHaveTextContent("alpha");
    expect(alpha).toHaveTextContent("1.2.0");
    expect(alpha).toHaveTextContent("Package");
    expect(alpha).toHaveTextContent("2026");
    expect(screen.queryByTestId("settings-plugins-lifecycle-loading")).toBeNull();
  });

  it("marks a load error, a discovery filter and a config change after activation", async () => {
    healthMock.mockResolvedValue({ broken: {}, filtered: {}, changed: {}, quiet: {} });
    inspectMock.mockImplementation(async (name: string) => {
      if (name === "broken") return inspection(name, { load_error: "ImportError: x" });
      if (name === "filtered") return inspection(name, { filter_reason: "target mismatch" });
      if (name === "changed") {
        return inspection(name, { last_config_change: "2026-06-01T09:00:00" });
      }
      return inspection(name, {
        last_config_change: "2026-01-01T09:00:00",
        source: "direct_register",
      });
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("plugin-lifecycle-row-quiet")).toBeInTheDocument();
    });
    expect(screen.getByTestId("plugin-lifecycle-marker-load-error-broken")).toHaveTextContent(
      "ImportError: x",
    );
    expect(screen.getByTestId("plugin-lifecycle-marker-filtered-filtered")).toHaveTextContent(
      "target mismatch",
    );
    expect(screen.getByTestId("plugin-lifecycle-marker-config-changed-changed")).toBeInTheDocument();
    expect(screen.queryByTestId("plugin-lifecycle-marker-config-changed-quiet")).toBeNull();
    expect(screen.queryByTestId("plugin-lifecycle-marker-load-error-quiet")).toBeNull();
    expect(screen.getByTestId("plugin-lifecycle-row-quiet")).toHaveTextContent("Registered directly");
  });

  it("Dexie mode: keeps the card visible with the desktop-only notice and makes no request", () => {
    renderCard("dexie");
    expect(screen.getByTestId("settings-plugins-lifecycle-desktop-only")).toHaveTextContent(
      /desktop app/i,
    );
    expect(screen.queryByTestId("settings-plugins-lifecycle")).toBeNull();
    expect(healthMock).not.toHaveBeenCalled();
    expect(inspectMock).not.toHaveBeenCalled();
  });

  it("surfaces a failed read inline and through the toast layer", async () => {
    healthMock.mockRejectedValue(new ApiError(503, "plugin host unavailable"));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("settings-plugins-lifecycle-error")).toHaveTextContent(
        "plugin host unavailable",
      );
    });
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(String(notifyError.mock.calls[0][0])).toContain("plugin host unavailable");
    expect(screen.queryByTestId("settings-plugins-lifecycle-loading")).toBeNull();
  });

  it("shows the empty state when no plugin is active", async () => {
    healthMock.mockResolvedValue({});
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("settings-plugins-lifecycle-empty")).toBeInTheDocument();
    });
    expect(inspectMock).not.toHaveBeenCalled();
  });
});
