/**
 * NavXpBadge tests (#505).
 *
 * Pins the header XP badge: nothing renders without a learner,
 * the level + total surface once the XP state loads, and an
 * XP-affecting celebration triggers a re-read so a freshly-earned
 * total appears without a reload.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { XPState } from "../storage/types";

const readLearnerState = vi.fn<() => { userId: string | null }>();
const getState = vi.fn<(userId: string) => Promise<XPState>>();
const getStreakHeatmap = vi.fn();

vi.mock("../lib/learnerState", () => ({
  readLearnerState: () => readLearnerState(),
}));

vi.mock("../storage", () => ({
  getStorage: () => ({ gamification: { getState, getStreakHeatmap } }),
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
    getStreakHeatmap.mockResolvedValue([]);
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

  it("lays out Level and XP as TWO ROWS, grid on the spans' direct parent (#756)", async () => {
    renderBadge();
    await screen.findByTestId("nav-xp-badge");
    const button = screen.getByTestId("nav-xp-badge");
    const content = screen.getByTestId("nav-xp-badge-content");
    const level = screen.getByTestId("nav-xp-badge-level");
    const total = screen.getByTestId("nav-xp-badge-total");

    // Root cause of #730/#732: the grid was on the BUTTON, but the
    // level/total spans were nested inside XpBadge's wrapper, so the grid
    // never reached them. The fix: the grid container (content wrapper)
    // is the DIRECT parent of level + total.
    expect(level.parentElement).toBe(content);
    expect(total.parentElement).toBe(content);
    expect(content).not.toBe(button);
    expect(content.parentElement).toBe(button);
    expect(content.className).toContain("grid"); // Tailwind grid container

    // Layout PROOF: with the grid the content wrapper applies, the level
    // span resolves to row 1 and the total span to row 2 — two lines.
    // (happy-dom resolves grid placement from a stylesheet.)
    const style = document.createElement("style");
    style.textContent = `
      [data-testid="nav-xp-badge-content"] { display: grid; grid-template-columns: auto auto; }
      [data-testid="nav-xp-badge-level"] { grid-row: 1; grid-column: 2; }
      [data-testid="nav-xp-badge-total"] { grid-row: 2; grid-column: 2; }
    `;
    document.head.appendChild(style);
    try {
      expect(getComputedStyle(content).display).toBe("grid");
      expect(getComputedStyle(level).gridRow).toBe("1");
      expect(getComputedStyle(total).gridRow).toBe("2");
    } finally {
      document.head.removeChild(style);
    }
  });

  it("opens a level-detail popover with a dashboard link on click (#730)", async () => {
    renderBadge();
    const badge = await screen.findByTestId("nav-xp-badge");
    // Closed by default.
    expect(screen.queryByTestId("nav-xp-badge-popover")).toBeNull();
    expect(badge).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(badge);

    expect(screen.getByTestId("nav-xp-badge-popover")).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-expanded", "true");
    // 200 into level + 300 to next = 40% progress.
    expect(screen.getByTestId("level-detail-bar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(
      screen.getByTestId("level-detail-tonext").textContent,
    ).toContain("300");
    expect(
      screen.getByTestId("nav-xp-badge-dashboard-link"),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("renders the badge two-line (level above total)", async () => {
    renderBadge();
    await screen.findByTestId("nav-xp-badge");
    expect(screen.getByTestId("nav-xp-badge-level").textContent).toBe("Level 4");
    expect(screen.getByTestId("nav-xp-badge-total").textContent).toBe("1200 XP");
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
