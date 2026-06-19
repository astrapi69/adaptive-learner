/**
 * Tests for the deep-link "Add repository?" page (EXP-023 Phase B).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addUserRepo, syncUserRepo, validateUserRepo } = vi.hoisted(() => ({
  addUserRepo: vi.fn(),
  syncUserRepo: vi.fn(),
  validateUserRepo: vi.fn(),
}));
vi.mock("../../lib/content/content-repos", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/content-repos")>()),
  addUserRepo,
  syncUserRepo,
}));
vi.mock("../../lib/content/content-repo-validate", () => ({ validateUserRepo }));
vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import AddRepo from "./AddRepo";

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/add-repo${search}`]}>
      <Routes>
        <Route path="/add-repo" element={<AddRepo />} />
        <Route path="/content" element={<div data-testid="content-page" />} />
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addUserRepo.mockReset();
  syncUserRepo.mockReset();
  validateUserRepo.mockReset();
  addUserRepo.mockResolvedValue([]);
  syncUserRepo.mockResolvedValue({ setCount: 1, lessonCount: 3 });
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 1, lessonCount: 3 });
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
