import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NavAvatar from "./NavAvatar";

let currentName = "Ada Lovelace";
const usersGet = vi.fn(async () => ({ id: "u-1", name: currentName, language: "de" }));
const settingsGet = vi.fn(async () => ({ avatar: null }));

vi.mock("../lib/learnerState", () => ({
  readLearnerState: () => ({ userId: "u-1", projectId: null, language: null }),
}));
vi.mock("../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));
vi.mock("../storage", () => ({
  getStorage: () => ({
    users: { get: usersGet },
    settings: { get: settingsGet },
  }),
}));

function renderNav() {
  return render(
    <MemoryRouter>
      <NavAvatar />
    </MemoryRouter>,
  );
}

describe("NavAvatar", () => {
  beforeEach(() => {
    currentName = "Ada Lovelace";
    usersGet.mockClear();
    settingsGet.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the learner's initials", async () => {
    renderNav();
    await waitFor(() =>
      expect(screen.getByTestId("nav-avatar-initials")).toHaveTextContent("AL"),
    );
  });

  it("links to Settings > Profile (?tab=general) (#638)", async () => {
    renderNav();
    await waitFor(() =>
      expect(screen.getByTestId("nav-avatar-initials")).toHaveTextContent("AL"),
    );
    expect(screen.getByTestId("nav-avatar")).toHaveAttribute(
      "href",
      "/settings?tab=general",
    );
  });

  it("refreshes live on the profile-updated event (#579)", async () => {
    renderNav();
    await waitFor(() =>
      expect(screen.getByTestId("nav-avatar-initials")).toHaveTextContent("AL"),
    );
    // Simulate Settings saving a new name + firing the signal.
    currentName = "Grace Hopper";
    await act(async () => {
      window.dispatchEvent(new Event("adaptive-learner:profile-updated"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("nav-avatar-initials")).toHaveTextContent("GH"),
    );
  });
});
