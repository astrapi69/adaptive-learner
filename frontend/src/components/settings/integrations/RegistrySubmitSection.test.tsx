/**
 * Render + interaction tests for the register-your-repo section (federated
 * search consumer). Covers the prepare flow (commit resolution + validation +
 * entry build), the copy-and-propose surface, and the token-gated
 * programmatic-PR button.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  notifyError,
  notifySuccess,
  validateUserRepo,
  fetchLatestCommitSha,
  fetchGitHubFileText,
  githubGetStatus,
  createRegistryPr,
} = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  validateUserRepo: vi.fn(),
  fetchLatestCommitSha: vi.fn(),
  fetchGitHubFileText: vi.fn(),
  githubGetStatus: vi.fn(),
  createRegistryPr: vi.fn(),
}));

let storageMode: "api" | "dexie" = "dexie";

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    github: { getStatus: githubGetStatus, createRegistryPr },
  }),
  resolveStorageMode: () => storageMode,
}));
vi.mock("../../../utils/notify", () => ({
  notify: { error: notifyError, success: notifySuccess },
}));
vi.mock("../../../lib/content/repos/content-repo-validate", () => ({
  validateUserRepo,
}));
vi.mock("../../../lib/content/repos/github-fetch", () => ({
  fetchLatestCommitSha,
  fetchGitHubFileText,
}));
vi.mock("../../../lib/content/repos/repo-token", () => ({
  resolveRepoToken: () => "",
}));
const { readUserRepos } = vi.hoisted(() => ({ readUserRepos: vi.fn() }));
vi.mock("../../../lib/content/repos/content-repos", async (orig) => ({
  ...(await orig<typeof import("../../../lib/content/repos/content-repos")>()),
  readUserRepos,
}));

import RegistrySubmitSection from "./RegistrySubmitSection";

const COMMIT = "a".repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  storageMode = "dexie";
  readUserRepos.mockResolvedValue([]);
  githubGetStatus.mockResolvedValue({ configured: true, source: "browser" });
  fetchLatestCommitSha.mockResolvedValue(COMMIT);
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 1, lessonCount: 5 });
  fetchGitHubFileText.mockResolvedValue(
    JSON.stringify({
      schema_version: "1.0",
      sets: [{ source_language: "de", target_language: "fr" }],
    }),
  );
  createRegistryPr.mockResolvedValue({
    url: "https://github.com/astrapi69/adaptive-learner-content/pull/9",
    number: 9,
  });
});

async function prepare() {
  render(<RegistrySubmitSection />);
  await screen.findByTestId("registry-submit-section");
  fireEvent.change(screen.getByTestId("registry-url"), {
    target: { value: "https://github.com/jane/content" },
  });
  fireEvent.change(screen.getByTestId("registry-title"), {
    target: { value: "Jane's sets" },
  });
  fireEvent.click(screen.getByTestId("registry-prepare"));
}

describe("RegistrySubmitSection", () => {
  it("prepares a validated entry pinned to the resolved commit", async () => {
    await prepare();
    const json = await screen.findByTestId("registry-json");
    const parsed = JSON.parse((json as HTMLTextAreaElement).value);
    expect(parsed).toMatchObject({
      url: "https://github.com/jane/content",
      commit: COMMIT,
      trust_level: 1,
      languages: ["de-fr"],
      validation: { status: "validated", index_schema_version: "1.0" },
    });
    expect(screen.getByTestId("registry-status")).toHaveTextContent(/validated/i);
    // The manual "propose" edit link is always offered.
    expect(screen.getByTestId("registry-edit-link").querySelector("a, button"));
  });

  it("marks the entry pending when local validation fails", async () => {
    validateUserRepo.mockResolvedValue({
      ok: false,
      setCount: 0,
      lessonCount: 0,
      reason: "no sets",
    });
    await prepare();
    await screen.findByTestId("registry-json");
    expect(screen.getByTestId("registry-status")).toHaveTextContent(/pending/i);
    expect(screen.getByTestId("registry-reason")).toHaveTextContent("no sets");
  });

  it("errors (no entry) when the commit cannot be resolved", async () => {
    fetchLatestCommitSha.mockResolvedValue(null);
    await prepare();
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(screen.queryByTestId("registry-json")).toBeNull();
  });

  it("offers the programmatic PR button in Dexie mode with a token, and opens the PR", async () => {
    await prepare();
    const button = await screen.findByTestId("registry-create-pr");
    fireEvent.click(button);
    await waitFor(() => expect(createRegistryPr).toHaveBeenCalledTimes(1));
    expect(createRegistryPr.mock.calls[0][0]).toMatchObject({
      upstream: "astrapi69/adaptive-learner-content",
      registryFile: "recommended-repos.json",
    });
    expect(await screen.findByTestId("registry-pr-url")).toBeInTheDocument();
  });

  it("hides the programmatic PR button without a configured token", async () => {
    githubGetStatus.mockResolvedValue({ configured: false, source: "none" });
    await prepare();
    await screen.findByTestId("registry-json");
    expect(screen.queryByTestId("registry-create-pr")).toBeNull();
  });

  it("hides the programmatic PR button in API mode (browser-only flow)", async () => {
    storageMode = "api";
    await prepare();
    await screen.findByTestId("registry-json");
    expect(screen.queryByTestId("registry-create-pr")).toBeNull();
  });
});
