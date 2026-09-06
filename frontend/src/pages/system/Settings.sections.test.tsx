/**
 * Settings > Learning section bar + ``?section=`` deep link (#2961).
 *
 * Lives next to ``Settings.test.tsx`` (which owns the tab / order pins)
 * so that file stays under the cohesion watcher's ceiling; the mock
 * scaffold is the same. The scroll itself is asserted through a
 * ``scrollIntoView`` spy on the cluster anchors: happy-dom has no layout,
 * so the deferred loop never sees the target "in view" and re-issues the
 * scroll until its frame budget runs out.
 */

import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import { TestFeatureProvider } from "../../features/testFeatureProvider";
import { AiKeyVaultProvider } from "../../components/settings/ai/AiKeyVaultProvider";
import type { UserSettings } from "../../types";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

const apiGet = vi.fn();
const apiUsersGet = vi.fn();
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      users: {
        ...actual.api.users,
        get: (...args: unknown[]) => apiUsersGet(...args),
        update: vi.fn(),
      },
      settings: {
        ...actual.api.settings,
        get: (...args: unknown[]) => apiGet(...args),
        update: vi.fn(),
        getAvailableModels: vi.fn(async () => []),
      },
    },
  };
});

vi.mock("../../storage", async () => {
  const actual = await vi.importActual<typeof import("../../storage")>("../../storage");
  return { ...actual, resolveStorageMode: () => "api" };
});

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const BASE: UserSettings = {
  id: "us-1",
  user_id: "u-1",
  language: "de",
  active_provider: "anthropic",
  has_anthropic_key: false,
  has_openai_key: false,
  has_gemini_key: false,
  has_perplexity_key: false,
  model_override_anthropic: null,
  model_override_openai: null,
  model_override_gemini: null,
  model_override_perplexity: null,
  avatar: null,
  key_source_anthropic: "none",
  key_source_openai: "none",
  key_source_gemini: "none",
  key_source_perplexity: "none",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

/** Exposes the router state the section bar writes (search + how). */
function LocationProbe() {
  const { search } = useLocation();
  const navigationType = useNavigationType();
  return (
    <div data-testid="location-probe" data-search={search} data-navigation-type={navigationType} />
  );
}

function renderSettings(initialEntry: string) {
  return render(
    <TestFeatureProvider context={{ mode: "api" }}>
      <AiKeyVaultProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Settings />
          <LocationProbe />
        </MemoryRouter>
      </AiKeyVaultProvider>
    </TestFeatureProvider>,
  );
}

/** Ids of the elements ``scrollIntoView`` was issued on, in call order. */
function scrolledIds(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.contexts.map((ctx) => (ctx as Element).id);
}

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockNavigate.mockClear();
  apiGet.mockReset();
  apiGet.mockResolvedValue(BASE);
  apiUsersGet.mockReset();
  apiUsersGet.mockResolvedValue({ id: "u-1", name: "Ada Lovelace", language: "de" });
  localStorage.setItem("adaptive-learner.user_id", "u-1");
  scrollSpy = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: scrollSpy,
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("Settings > Learning section bar (#2961)", () => {
  it("renders one chip per rendered cluster, voice omitted without speech support", async () => {
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    const panel = screen.getByTestId("settings-panel-learning");
    const nav = within(panel).getByTestId("settings-subnav");
    expect(nav.getAttribute("aria-label")).toMatch(/^(Learning sections|Lernbereiche)$/);
    expect(
      within(nav)
        .getAllByRole("button")
        .map((chip) => chip.getAttribute("data-testid")),
    ).toEqual([
      "settings-subnav-basics",
      "settings-subnav-lessons",
      "settings-subnav-review",
      "settings-subnav-motivation",
    ]);
    // The bar precedes the first cluster inside the panel.
    expect(panel.firstElementChild).toBe(nav);
    expect(within(nav).queryByRole("button", { current: "location" })).toBeNull();
  });

  it("opens a section from the ?section= deep link: chip active + anchor scrolled", async () => {
    renderSettings("/settings?tab=learning&section=review");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-subnav-review")).toHaveAttribute(
      "aria-current",
      "location",
    );
    await waitFor(() => expect(scrolledIds(scrollSpy)).toContain("learning-review"));
    expect(scrolledIds(scrollSpy).filter((id) => id.startsWith("learning-"))).not.toContain(
      "learning-basics",
    );
  });

  it("ignores an unknown ?section= value", async () => {
    renderSettings("/settings?tab=learning&section=bogus");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("settings-panel-learning")).toBeVisible();
    expect(document.querySelector("[aria-current='location']")).toBeNull();
    // Give the deferred loop a few frames: nothing may be scrolled.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolledIds(scrollSpy).filter((id) => id.startsWith("learning-"))).toEqual([]);
  });

  it("drops ?section= when the tab changes", async () => {
    renderSettings("/settings?tab=learning&section=motivation");
    await screen.findByTestId("settings");
    expect(screen.getByTestId("location-probe").getAttribute("data-search")).toContain(
      "section=motivation",
    );
    fireEvent.click(screen.getByTestId("settings-tab-data"));
    const probe = screen.getByTestId("location-probe");
    expect(probe.getAttribute("data-search")).toBe("?tab=data");
    expect(screen.getByTestId("settings-panel-data")).toBeVisible();
  });

  it("writes ?section= with replace-state on a chip click and scrolls there", async () => {
    renderSettings("/settings?tab=learning");
    await screen.findByTestId("settings");
    fireEvent.click(screen.getByTestId("settings-subnav-motivation"));
    const probe = screen.getByTestId("location-probe");
    expect(probe.getAttribute("data-search")).toBe("?tab=learning&section=motivation");
    expect(probe.getAttribute("data-navigation-type")).toBe("REPLACE");
    expect(screen.getByTestId("settings-subnav-motivation")).toHaveAttribute(
      "aria-current",
      "location",
    );
    await waitFor(() => expect(scrolledIds(scrollSpy)).toContain("learning-motivation"));
  });

  it("does not scroll while the Learning tab is hidden, then scrolls once it opens", async () => {
    renderSettings("/settings?tab=general&section=review");
    await screen.findByTestId("settings");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolledIds(scrollSpy).filter((id) => id.startsWith("learning-"))).toEqual([]);
    // The general tab drops the param on its own switch, so open Learning
    // via the sidebar: no section is requested any more.
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(screen.getByTestId("location-probe").getAttribute("data-search")).toBe(
      "?tab=learning",
    );
  });
});
