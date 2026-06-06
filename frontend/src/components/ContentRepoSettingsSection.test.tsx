/**
 * Render + interaction tests for the content-repository settings section
 * (EXP-023 Phase A, commit 1 — config UI).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pluginGet = vi.fn();
const pluginUpdate = vi.fn();
const listSets = vi.fn();
const githubGetStatus = vi.fn();

vi.mock("../storage", () => ({
  getStorage: () => ({
    pluginSettings: { get: pluginGet, update: pluginUpdate },
    contentLoader: { listSets },
    github: { getStatus: githubGetStatus },
  }),
}));

const { notifyError, notifySuccess, validateUserRepo } = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  validateUserRepo: vi.fn(),
}));
vi.mock("../utils/notify", () => ({
  notify: { error: notifyError, success: notifySuccess },
}));
vi.mock("../lib/content/content-repo-validate", () => ({ validateUserRepo }));

import ContentRepoSettingsSection from "./ContentRepoSettingsSection";

beforeEach(() => {
  pluginGet.mockReset();
  pluginUpdate.mockReset();
  listSets.mockReset();
  githubGetStatus.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
  validateUserRepo.mockReset();
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 2, lessonCount: 12 });
  pluginGet.mockResolvedValue({
    plugin: "content-loader",
    settings: { default_sources: [{ source: "official", branch: "main" }] },
  });
  pluginUpdate.mockResolvedValue({ plugin: "content-loader", settings: {} });
  githubGetStatus.mockResolvedValue({ configured: true, source: "browser" });
  listSets.mockResolvedValue({
    sets: [
      {
        source: "astrapi69/adaptive-learner-content",
        id: "fr-a1",
        lesson_count: 10,
      },
      {
        source: "bundled:adaptive-learner-content",
        id: "es-a1",
        lesson_count: 5,
      },
      { source: "jane/my-content", id: "x", lesson_count: 99 },
    ],
  });
});

describe("ContentRepoSettingsSection", () => {
  it("shows the official repo with cached counts (official only)", async () => {
    render(<ContentRepoSettingsSection />);
    const counts = await screen.findByTestId("content-repo-official-counts");
    // 2 official sets (canonical + bundled), 15 lessons; the user set excluded.
    expect(counts).toHaveTextContent("2");
    expect(counts).toHaveTextContent("15");
  });

  it("rejects an invalid URL without saving", async () => {
    render(<ContentRepoSettingsSection />);
    fireEvent.change(await screen.findByTestId("content-repo-url"), {
      target: { value: "not a repo" },
    });
    fireEvent.click(screen.getByTestId("content-repo-connect"));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(pluginUpdate).not.toHaveBeenCalled();
  });

  it("validates then saves a valid repo (read-modify-write preserves sources)", async () => {
    render(<ContentRepoSettingsSection />);
    fireEvent.change(await screen.findByTestId("content-repo-url"), {
      target: { value: "https://github.com/jane/my-content" },
    });
    fireEvent.click(screen.getByTestId("content-repo-connect"));
    await waitFor(() => expect(pluginUpdate).toHaveBeenCalled());
    expect(validateUserRepo).toHaveBeenCalledWith({
      owner: "jane",
      repo: "my-content",
      branch: "main",
    });
    const [, body] = pluginUpdate.mock.calls[0];
    expect(body.settings.default_sources).toBeDefined();
    expect(body.settings.user_repo).toMatchObject({
      owner: "jane",
      repo: "my-content",
      branch: "main",
      connected: true,
      set_count: 2,
      lesson_count: 12,
    });
  });

  it("shows the failure reason and does not save on invalid content", async () => {
    validateUserRepo.mockResolvedValue({
      ok: false,
      setCount: 0,
      lessonCount: 0,
      reason: "manifest.yaml lists no sets.",
    });
    render(<ContentRepoSettingsSection />);
    fireEvent.change(await screen.findByTestId("content-repo-url"), {
      target: { value: "https://github.com/jane/empty" },
    });
    fireEvent.click(screen.getByTestId("content-repo-connect"));
    const result = await screen.findByTestId("content-repo-result");
    expect(result).toHaveTextContent("no sets");
    expect(pluginUpdate).not.toHaveBeenCalled();
  });

  it("hints to set a token when none is configured", async () => {
    githubGetStatus.mockResolvedValue({ configured: false, source: "none" });
    render(<ContentRepoSettingsSection />);
    expect(
      await screen.findByTestId("content-repo-token-hint"),
    ).toBeInTheDocument();
  });
});
