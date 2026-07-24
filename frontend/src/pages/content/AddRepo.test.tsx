/**
 * Tests for the deep-link "Add repository?" page (EXP-023 Phase B).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addUserRepo, syncUserRepo, validateUserRepo, findUserRepo, listSets } = vi.hoisted(
  () => ({
    addUserRepo: vi.fn(),
    syncUserRepo: vi.fn(),
    validateUserRepo: vi.fn(),
    findUserRepo: vi.fn(),
    listSets: vi.fn(),
  }),
);
vi.mock("../../lib/content/repos/content-repos", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/repos/content-repos")>()),
  addUserRepo,
  syncUserRepo,
  findUserRepo,
}));
vi.mock("../../lib/content/repos/content-repo-validate", () => ({ validateUserRepo }));
vi.mock("../../storage", () => ({
  getStorage: () => ({ contentLoader: { listSets } }),
}));
vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import AddRepo from "./AddRepo";
import { PAGE_CONTAINER_CLASSES } from "../../shared/layout/PageContainer";

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/add-repo${search}`]}>
      <Routes>
        <Route path="/add-repo" element={<AddRepo />} />
        <Route path="/content" element={<div data-testid="content-page" />} />
        <Route path="/content/set/:setId" element={<div data-testid="set-page" />} />
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addUserRepo.mockReset();
  syncUserRepo.mockReset();
  validateUserRepo.mockReset();
  findUserRepo.mockReset();
  listSets.mockReset();
  addUserRepo.mockResolvedValue([]);
  syncUserRepo.mockResolvedValue({ setCount: 1, lessonCount: 3 });
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 1, lessonCount: 3 });
  findUserRepo.mockResolvedValue(null);
  listSets.mockResolvedValue({ sets: [{ id: "fr-a1", source: "jane/deck" }] });
});

describe("AddRepo", () => {
  it("shows the repo name from the link", () => {
    renderAt("?url=jane/deck&branch=dev");
    expect(screen.getByTestId("add-repo-name")).toHaveTextContent("jane/deck");
    expect(screen.getByTestId("add-repo-name")).toHaveTextContent("dev");
  });

  it("connect validates, adds, syncs, and routes to content", async () => {
    renderAt("?url=jane/deck&branch=main");
    fireEvent.click(screen.getByTestId("add-repo-connect"));
    await waitFor(() => expect(screen.getByTestId("content-page")).toBeInTheDocument());
    expect(validateUserRepo).toHaveBeenCalled();
    expect(addUserRepo).toHaveBeenCalled();
    expect(syncUserRepo).toHaveBeenCalledWith("jane/deck", expect.any(Function));
  });

  it("shows the reason and does not add on failed validation", async () => {
    validateUserRepo.mockResolvedValue({ ok: false, reason: "no sets" });
    renderAt("?url=jane/deck&branch=main");
    fireEvent.click(screen.getByTestId("add-repo-connect"));
    await screen.findByTestId("add-repo-error");
    expect(addUserRepo).not.toHaveBeenCalled();
  });

  it("cancel routes to the dashboard", async () => {
    renderAt("?url=jane/deck&branch=main");
    fireEvent.click(screen.getByTestId("add-repo-cancel"));
    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeInTheDocument());
  });

  it("rejects a link with no valid repo", () => {
    renderAt("?url=not-a-repo");
    expect(screen.getByTestId("add-repo-invalid")).toBeInTheDocument();
  });
});

describe("AddRepo set deep link (#1572)", () => {
  it("repo already connected + set → navigates straight to the set, no dialog", async () => {
    findUserRepo.mockResolvedValue({ owner: "jane", repo: "deck", branch: "main" });
    renderAt("?url=jane/deck&branch=main&set=fr-a1");
    await waitFor(() => expect(screen.getByTestId("set-page")).toBeInTheDocument());
    expect(screen.queryByTestId("add-repo-connect")).not.toBeInTheDocument();
    expect(addUserRepo).not.toHaveBeenCalled();
  });

  it("official repo + set → treated as connected, straight to the set", async () => {
    renderAt("?url=astrapi69/adaptive-learner-content&branch=main&set=psychologie-a1");
    await waitFor(() => expect(screen.getByTestId("set-page")).toBeInTheDocument());
    expect(screen.queryByTestId("add-repo-connect")).not.toBeInTheDocument();
  });

  it("repo not connected + set → confirm dialog references the set", async () => {
    renderAt("?url=jane/deck&branch=main&set=fr-a1");
    const body = await screen.findByTestId("add-repo-body");
    expect(body).toHaveTextContent("fr-a1");
    expect(screen.getByTestId("add-repo-connect")).toBeInTheDocument();
  });

  it("confirm → after connect navigates to the set page, not content", async () => {
    renderAt("?url=jane/deck&branch=main&set=fr-a1");
    fireEvent.click(await screen.findByTestId("add-repo-connect"));
    await waitFor(() => expect(screen.getByTestId("set-page")).toBeInTheDocument());
    expect(syncUserRepo).toHaveBeenCalledWith("jane/deck", expect.any(Function));
  });

  it("set missing in the freshly connected repo → error + no set navigation", async () => {
    listSets.mockResolvedValue({ sets: [{ id: "other-set", source: "jane/deck" }] });
    renderAt("?url=jane/deck&branch=main&set=fr-a1");
    fireEvent.click(await screen.findByTestId("add-repo-connect"));
    const err = await screen.findByTestId("add-repo-error");
    expect(err).toHaveTextContent("fr-a1");
    expect(screen.queryByTestId("set-page")).not.toBeInTheDocument();
  });
});

describe("shared page container (#1384)", () => {
  it("renders inside the shared PageContainer, with no deviating wrapper", async () => {
    renderAt("?repo=jane%2Fmy-content");
    const main = await screen.findByTestId("add-repo-page");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });
});
