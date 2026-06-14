/**
 * NavXpBadge tests (#505).
 *
 * Pins the header XP badge: nothing renders without a learner,
 * the level + total surface once the XP state loads, and an
 * XP-affecting celebration triggers a re-read so a freshly-earned
 * total appears without a reload.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { XPState } from "../storage/types";

const readLearnerState = vi.fn<() => { userId: string | null }>();
const getState = vi.fn<(userId: string) => Promise<XPState>>();

vi.mock("../lib/learnerState", () => ({
  readLearnerState: () => readLearnerState(),
}));

vi.mock("../storage", () => ({
  getStorage: () => ({ gamification: { getState } }),
}));

import NavXpBadge from "./NavXpBadge";
import { emitCelebration } from "../lib/praise/celebration-bus";

function makeState(overrides: Partial<XPState> = {}): XPState {
  return {
    user_id: "u1",
    total_xp: 1200,
    level: 4,
    xp_into_level: 200,
    xp_to_next_level: 300,
    next_level_threshold: 1500,
    ...overrides,
  };
}

function renderBadge() {
  return render(
    <MemoryRouter>
      <NavXpBadge />
    </MemoryRouter>,
  );
}

describe("NavXpBadge", () => {
  beforeEach(() => {
    readLearnerState.mockReturnValue({ userId: "u1" });
    getState.mockResolvedValue(makeState());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there is no learner", () => {
    readLearnerState.mockReturnValue({ userId: null });
    const { container } = renderBadge();
    expect(container.querySelector('[data-testid="nav-xp-badge"]')).toBeNull();
    expect(getState).not.toHaveBeenCalled();
  });

  it("renders the level and total once the XP state loads", async () => {
    renderBadge();
    expect(await screen.findByTestId("nav-xp-badge")).toBeInTheDocument();
    expect(screen.getByTestId("nav-xp-badge-level").textContent).toBe("Level 4");
    expect(screen.getByTestId("nav-xp-badge-total").textContent).toBe("1200 XP");
  });

  it("links to the dashboard", async () => {
    renderBadge();
    const link = await screen.findByTestId("nav-xp-badge");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("re-reads the XP state on an XP-affecting celebration", async () => {
    renderBadge();
    await screen.findByTestId("nav-xp-badge");
    expect(getState).toHaveBeenCalledTimes(1);

    getState.mockResolvedValue(makeState({ total_xp: 1280, level: 4 }));
    emitCelebration({ type: "lesson_complete" });

    await waitFor(() =>
      expect(screen.getByTestId("nav-xp-badge-total").textContent).toBe(
        "1280 XP",
      ),
    );
    expect(getState).toHaveBeenCalledTimes(2);
  });

  it("ignores celebrations that cannot change XP", async () => {
    renderBadge();
    await screen.findByTestId("nav-xp-badge");
    expect(getState).toHaveBeenCalledTimes(1);

    emitCelebration({ type: "answer_correct" });
    // Give any erroneous async refresh a tick to land.
    await Promise.resolve();
    expect(getState).toHaveBeenCalledTimes(1);
  });
});
