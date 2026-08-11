/**
 * Render + interaction tests for the multi-repo content-repository section
 * (EXP-023 Phase B).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pluginGet = vi.fn();
const pluginUpdate = vi.fn();
const listSets = vi.fn();
const downloadSet = vi.fn();
const githubGetStatus = vi.fn();

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    pluginSettings: { get: pluginGet, update: pluginUpdate },
    contentLoader: { listSets, downloadSet },
    github: { getStatus: githubGetStatus },
  }),
  resolveStorageMode: () => "api",
}));

const { notifyError, notifySuccess, validateUserRepo, listRepoManifestSets } =
  vi.hoisted(() => ({
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    validateUserRepo: vi.fn(),
    listRepoManifestSets: vi.fn(),
  }));
vi.mock("../../../utils/notify", () => ({
  notify: { error: notifyError, success: notifySuccess },
}));
vi.mock("../../../lib/content/repos/content-repo-validate", () => ({
  validateUserRepo,
  listRepoManifestSets,
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") },
}));
const { fetchRecommendedRepos } = vi.hoisted(() => ({
  fetchRecommendedRepos: vi.fn(),
}));
vi.mock("../../../lib/content/repos/recommended-repos", async (orig) => ({
  ...(await orig<typeof import("../../../lib/content/repos/recommended-repos")>()),
  fetchRecommendedRepos,
}));
vi.mock("../../../lib/content/repos/repo-token", () => ({
  resolveRepoToken: () => "",
  writeRepoToken: vi.fn(),
  clearRepoToken: vi.fn(),
}));
const { decodeQrImage } = vi.hoisted(() => ({ decodeQrImage: vi.fn() }));
vi.mock("../../../shared/qr/decode-qr-image", () => ({ decodeQrImage }));

import ContentRepoSettingsSection from "./ContentRepoSettingsSection";

const REPO = {
  url: "https://github.com/jane/deck",
  owner: "jane",
  repo: "deck",
  branch: "main",
  connected: true,
  last_synced: "2026-06-06T10:00:00.000Z",
  set_count: 2,
  lesson_count: 12,
  trust: 1 as const,
};

beforeEach(() => {
  pluginGet.mockReset();
  pluginUpdate.mockReset();
  listSets.mockReset();
  downloadSet.mockReset();
  githubGetStatus.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
  validateUserRepo.mockReset();
  decodeQrImage.mockReset();
  fetchRecommendedRepos.mockReset();
  fetchRecommendedRepos.mockResolvedValue([]);
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 1, lessonCount: 4 });
  listRepoManifestSets.mockReset();
  listRepoManifestSets.mockResolvedValue([{ id: "d1", lessonCount: 4 }]);
  downloadSet.mockResolvedValue({});
  githubGetStatus.mockResolvedValue({ configured: true, source: "browser" });
  // Stateful settings so read-modify-write (add -> sync) reflects writes.
  let settings: Record<string, unknown> = {
    default_sources: [{ source: "official", branch: "main" }],
  };
  pluginGet.mockImplementation(async () => ({
    plugin: "content-loader",
    settings,
  }));
  pluginUpdate.mockImplementation(async (_name, body) => {
    settings = body.settings;
    return { plugin: "content-loader", settings };
  });
  listSets.mockResolvedValue({
    sets: [
      {
        source: "astrapi69/adaptive-learner-content",
        id: "fr-a1",
        lesson_count: 10,
      },
      { source: "jane/deck", id: "d1", lesson_count: 4 },
    ],
  });
});

describe("ContentRepoSettingsSection (multi-repo)", () => {
  it("shows the official card with official-only counts", async () => {
    render(<ContentRepoSettingsSection />);
    const counts = await screen.findByTestId("content-repo-official-counts");
    expect(counts).toHaveTextContent("1");
    expect(counts).toHaveTextContent("10");
  });

  it("renders the token as a non-password field that opts out of autofill (#767)", async () => {
    render(<ContentRepoSettingsSection />);
    const token = await screen.findByTestId("content-repo-token");
    // type="text" (not "password") so the browser password manager does
    // not offer to autofill a repository access token.
    expect(token).toHaveAttribute("type", "text");
    expect(token).not.toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
    expect(token).toHaveAttribute("data-1p-ignore");
    expect(token).toHaveAttribute("data-lpignore", "true");
    expect(token).toHaveAttribute("data-bwignore", "true");
    expect(token).toHaveAttribute("data-form-type", "other");
    // No <form> wrapper (form tags add to autofill detection).
    expect(token.closest("form")).toBeNull();
  });

  it("lists connected repos with a unified category badge (#1319)", async () => {
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [REPO] },
    });
    render(<ContentRepoSettingsSection />);
    expect(await screen.findByTestId("content-repo-list")).toBeInTheDocument();
    expect(
      screen.getByTestId("content-repo-item-jane-deck"),
    ).toBeInTheDocument();
    // REPO carries trust: 1 with no coach/recommended → "validated".
    const badge = screen.getByTestId("content-repo-category-jane-deck");
    expect(badge).toHaveAttribute("data-category", "validated");
  });

  it("badges a coach (private-token) repo as private (#1319)", async () => {
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [{ ...REPO, coach: true }] },
    });
    render(<ContentRepoSettingsSection />);
    const badge = await screen.findByTestId("content-repo-category-jane-deck");
    expect(badge).toHaveAttribute("data-category", "private");
  });

  it("rejects an invalid URL without writing", async () => {
    render(<ContentRepoSettingsSection />);
    fireEvent.change(await screen.findByTestId("content-repo-url"), {
      target: { value: "not a repo" },
    });
    fireEvent.click(screen.getByTestId("content-repo-connect"));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(pluginUpdate).not.toHaveBeenCalled();
  });

  it("prefills the add-repo form from an uploaded QR image (#1317)", async () => {
    decodeQrImage.mockResolvedValue(
      "https://x.dev/app/add-repo?url=owner%2Frepo&branch=feat",
    );
    render(<ContentRepoSettingsSection />);
    const input = await screen.findByTestId("content-repo-qr-upload-input");
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "qr.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByTestId("content-repo-url")).toHaveValue("owner/repo"),
    );
    expect(screen.getByTestId("content-repo-branch")).toHaveValue("feat");
    expect(screen.getByTestId("content-repo-qr-filled")).toBeInTheDocument();
  });

  it("warns when an uploaded QR is not an add-repo link (#1317)", async () => {
    decodeQrImage.mockResolvedValue("just some scanned text");
    render(<ContentRepoSettingsSection />);
    const input = await screen.findByTestId("content-repo-qr-upload-input");
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "qr.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByTestId("content-repo-qr-invalid")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("content-repo-url")).toHaveValue("");
  });

  it("validates, adds (appends to user_repos), and syncs", async () => {
    render(<ContentRepoSettingsSection />);
    fireEvent.change(await screen.findByTestId("content-repo-url"), {
      target: { value: "https://github.com/jane/deck" },
    });
    fireEvent.click(screen.getByTestId("content-repo-connect"));
    await waitFor(() => expect(pluginUpdate).toHaveBeenCalled());
    expect(validateUserRepo).toHaveBeenCalled();
    expect(downloadSet).toHaveBeenCalledWith("jane/deck", "d1");
    const [, body] = pluginUpdate.mock.calls[0];
    expect(body.settings.user_repos[0]).toMatchObject({
      owner: "jane",
      repo: "deck",
      connected: true,
      trust: 1,
    });
  });

  it("shows the failure reason and does not write on invalid content", async () => {
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
    await screen.findByText(/no sets/i);
    expect(pluginUpdate).not.toHaveBeenCalled();
  });

  it("removes a repo only after a confirm click", async () => {
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [REPO] },
    });
    render(<ContentRepoSettingsSection />);
    const remove = await screen.findByTestId("content-repo-remove-jane-deck");
    fireEvent.click(remove);
    expect(pluginUpdate).not.toHaveBeenCalled(); // opens the confirm dialog
    // #1445 — confirmation now lives in the RemoveRepoDialog.
    fireEvent.click(
      await screen.findByTestId("content-repo-remove-dialog-confirm"),
    );
    await waitFor(() => expect(pluginUpdate).toHaveBeenCalled());
    const [, body] = pluginUpdate.mock.calls[0];
    expect(body.settings.user_repos).toEqual([]);
  });

  it("hints to set a token when none is configured", async () => {
    githubGetStatus.mockResolvedValue({ configured: false, source: "none" });
    render(<ContentRepoSettingsSection />);
    expect(
      await screen.findByTestId("content-repo-token-hint"),
    ).toBeInTheDocument();
  });

  it("lists recommended repos and one-click adds one", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      { url: "jane/deck", branch: "main", title: "Jane Deck" },
    ]);
    render(<ContentRepoSettingsSection />);
    expect(
      await screen.findByTestId("content-repo-recommended"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId("content-repo-recommended-add-jane/deck"),
    );
    await waitFor(() => expect(pluginUpdate).toHaveBeenCalled());
    expect(validateUserRepo).toHaveBeenCalled();
    const [, body] = pluginUpdate.mock.calls[0];
    expect(body.settings.user_repos[0]).toMatchObject({
      owner: "jane",
      repo: "deck",
      trust: 1,
    });
  });

  it("keeps other recommended-repo buttons enabled while one is being added (#2558)", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      { url: "jane/deck", branch: "main", title: "Jane Deck" },
      { url: "bob/cards", branch: "main", title: "Bob Cards" },
    ]);
    let resolveValidate!: (value: {
      ok: true;
      setCount: number;
      lessonCount: number;
    }) => void;
    validateUserRepo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidate = resolve;
        }),
    );
    render(<ContentRepoSettingsSection />);
    const addFirst = await screen.findByTestId(
      "content-repo-recommended-add-jane/deck",
    );
    const addSecond = screen.getByTestId(
      "content-repo-recommended-add-bob/cards",
    );
    fireEvent.click(addFirst);
    await waitFor(() => expect(addFirst).toBeDisabled());
    expect(addSecond).not.toBeDisabled();
    resolveValidate({ ok: true, setCount: 1, lessonCount: 4 });
  });

  it("shows a progress indicator scoped to the recommended repo being added (#2558)", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      { url: "jane/deck", branch: "main", title: "Jane Deck" },
    ]);
    let resolveValidate!: (value: {
      ok: true;
      setCount: number;
      lessonCount: number;
    }) => void;
    validateUserRepo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidate = resolve;
        }),
    );
    render(<ContentRepoSettingsSection />);
    fireEvent.click(
      await screen.findByTestId("content-repo-recommended-add-jane/deck"),
    );
    expect(
      await screen.findByTestId("content-repo-recommended-progress-jane/deck"),
    ).toBeInTheDocument();
    resolveValidate({ ok: true, setCount: 1, lessonCount: 4 });
  });

  it("hides a recommended repo that is already connected", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      { url: "jane/deck", branch: "main" },
    ]);
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [REPO] },
    });
    render(<ContentRepoSettingsSection />);
    await screen.findByTestId("content-repo-list");
    expect(screen.queryByTestId("content-repo-recommended")).toBeNull();
  });

  it("records a local star rating for a repo", async () => {
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [REPO] },
    });
    render(<ContentRepoSettingsSection />);
    const star = await screen.findByTestId(
      "content-repo-rating-jane-deck-star-4",
    );
    fireEvent.click(star);
    await waitFor(() =>
      expect(
        screen.getByTestId("content-repo-rating-jane-deck-star-4"),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("toggles a share panel with a link + QR for a repo", async () => {
    pluginGet.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [REPO] },
    });
    render(<ContentRepoSettingsSection />);
    fireEvent.click(await screen.findByTestId("content-repo-share-jane-deck"));
    const panel = await screen.findByTestId(
      "content-repo-share-panel-jane-deck",
    );
    expect(panel).toBeInTheDocument();
    const link = screen.getByTestId("content-repo-share-link") as HTMLInputElement;
    expect(link.value).toContain("/add-repo?url=jane%2Fdeck");
    expect(await screen.findByTestId("content-repo-share-qr")).toBeInTheDocument();
  });
});

describe("per-repo sync + sync-all with error isolation (#1388)", () => {
  const REPO2 = {
    ...REPO,
    url: "https://github.com/bob/deck2",
    owner: "bob",
    repo: "deck2",
  };

  function seedTwoRepos() {
    let settings: Record<string, unknown> = {
      default_sources: [{ source: "official", branch: "main" }],
      user_repos: [REPO, REPO2],
    };
    pluginGet.mockImplementation(async () => ({
      plugin: "content-loader",
      settings,
    }));
    pluginUpdate.mockImplementation(async (_name, body) => {
      settings = body.settings as Record<string, unknown>;
      return { plugin: "content-loader", settings };
    });
  }

  it("offers an explicit 'Sync all' button next to the per-row sync", async () => {
    seedTwoRepos();
    render(<ContentRepoSettingsSection />);
    const all = await screen.findByTestId("content-repo-sync-all");
    expect(all).toHaveTextContent("Sync all");
    expect(screen.getByTestId("content-repo-sync-jane-deck")).toBeInTheDocument();
    expect(screen.getByTestId("content-repo-sync-bob-deck2")).toBeInTheDocument();
  });

  it("a failing single sync shows feedback at ITS row and leaves the other repo untouched", async () => {
    seedTwoRepos();
    listRepoManifestSets.mockImplementation(async (ref: { owner: string }) => {
      if (ref.owner === "jane") throw new Error("404");
      return [{ id: "d1", lessonCount: 4 }];
    });
    render(<ContentRepoSettingsSection />);
    fireEvent.click(await screen.findByTestId("content-repo-sync-jane-deck"));
    const rowError = await screen.findByTestId("content-repo-sync-error-jane-deck");
    expect(rowError).toBeInTheDocument();
    // The sibling row carries no error and was not synced.
    expect(
      screen.queryByTestId("content-repo-sync-error-bob-deck2"),
    ).toBeNull();
    expect(listRepoManifestSets).toHaveBeenCalledTimes(1);
  });

  it("'Sync all' isolates a failing repo: the rest still sync and the summary names it", async () => {
    seedTwoRepos();
    listRepoManifestSets.mockImplementation(async (ref: { owner: string }) => {
      if (ref.owner === "jane") throw new Error("offline");
      return [{ id: "d1", lessonCount: 4 }];
    });
    render(<ContentRepoSettingsSection />);
    fireEvent.click(await screen.findByTestId("content-repo-sync-all"));
    await waitFor(() =>
      expect(
        screen.getByTestId("content-repo-sync-error-jane-deck"),
      ).toBeInTheDocument(),
    );
    // BOTH repos were attempted (no first-error abort)…
    expect(listRepoManifestSets).toHaveBeenCalledTimes(2);
    // …and the summary reports 1 of 2 + names the failure.
    expect(notifyError).toHaveBeenCalledWith(
      expect.stringContaining("jane/deck"),
    );
  });

  it("guards against a double start while a sync is running", async () => {
    seedTwoRepos();
    let release!: (v: { id: string; lessonCount: number }[]) => void;
    listRepoManifestSets.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    render(<ContentRepoSettingsSection />);
    const sync = await screen.findByTestId("content-repo-sync-jane-deck");
    fireEvent.click(sync);
    await waitFor(() => expect(sync).toBeDisabled());
    fireEvent.click(sync);
    expect(listRepoManifestSets).toHaveBeenCalledTimes(1);
    release([]);
  });

  it("shows the running state on the RIGHT row", async () => {
    seedTwoRepos();
    let release!: (v: { id: string; lessonCount: number }[]) => void;
    listRepoManifestSets.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    render(<ContentRepoSettingsSection />);
    fireEvent.click(await screen.findByTestId("content-repo-sync-jane-deck"));
    const running = await screen.findByTestId("content-repo-syncing-jane-deck");
    expect(running).toBeInTheDocument();
    expect(screen.queryByTestId("content-repo-syncing-bob-deck2")).toBeNull();
    release([]);
  });
});
