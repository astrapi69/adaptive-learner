/**
 * GitHubIntegrationSection — token storage + test UX (Dexie mode).
 *
 * Exercises the real DexieStorage.github namespace (localStorage-backed
 * token) with the browser-direct GitHubApi stubbed so verifyToken
 * doesn't hit the network. Pins: format validation gate, save round-trip
 * (source + Remove button appear), Test success/invalid messaging, and
 * Remove clearing the token.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../hooks/useI18n";
import { _resetStorageCacheForTests } from "../storage";

import GitHubIntegrationSection from "./GitHubIntegrationSection";

vi.mock("../utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const verifyTokenSpy = vi.fn();

vi.mock("../lib/github/github-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/github/github-api")>();
  return {
    ...actual,
    GitHubApi: class {
      constructor(public token: string) {}
      verifyToken = verifyTokenSpy;
    },
  };
});

const VALID_TOKEN = "ghp_" + "a".repeat(36);

beforeEach(() => {
  localStorage.setItem("adaptive-learner.storage_mode", "dexie");
  _resetStorageCacheForTests();
  verifyTokenSpy.mockResolvedValue({
    valid: true,
    username: "octocat",
    kind: "ok",
  });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function renderSection() {
  return render(
    <I18nProvider>
      <GitHubIntegrationSection />
    </I18nProvider>,
  );
}

describe("GitHubIntegrationSection", () => {
  it("renders the token field and docs link", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("settings-github")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("settings-github-token-input"),
    ).toBeInTheDocument();
  });

  it("warns on a malformed token and gates Save", async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("settings-github-token-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("settings-github-token-input"), {
      target: { value: "not-a-token" },
    });
    expect(
      screen.getByTestId("settings-github-format-warning"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("settings-github-save")).toBeDisabled();
  });

  it("saves a valid token and surfaces source + Remove", async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("settings-github-token-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("settings-github-token-input"), {
      target: { value: VALID_TOKEN },
    });
    const save = screen.getByTestId("settings-github-save");
    expect(save).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(save);
    });
    await waitFor(() => {
      expect(screen.getByTestId("settings-github-source")).toBeInTheDocument();
      expect(screen.getByTestId("settings-github-clear")).toBeInTheDocument();
    });
    // Persisted in localStorage (browser-mode token store).
    expect(localStorage.getItem("adaptive-learner.github_token")).toBe(
      VALID_TOKEN,
    );
  });

  it("Test shows the connected username on success", async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("settings-github-token-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("settings-github-token-input"), {
      target: { value: VALID_TOKEN },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-github-test"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("settings-github-test-result")).toHaveTextContent(
        "octocat",
      );
    });
  });

  it("Test reports an invalid token", async () => {
    verifyTokenSpy.mockResolvedValue({
      valid: false,
      username: null,
      kind: "invalid",
    });
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("settings-github-token-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("settings-github-token-input"), {
      target: { value: VALID_TOKEN },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-github-test"));
    });
    await waitFor(() => {
      const result = screen.getByTestId("settings-github-test-result");
      expect(result).toHaveAttribute("role", "alert");
    });
  });

  it("Remove clears a stored token", async () => {
    localStorage.setItem("adaptive-learner.github_token", VALID_TOKEN);
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("settings-github-clear")).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-github-clear"));
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId("settings-github-clear"),
      ).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("adaptive-learner.github_token")).toBeNull();
  });
});
