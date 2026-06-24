/**
 * Render + interaction tests for the /invite redeem page (#1093). The redeem
 * orchestrator + router hooks are mocked so the page's seeding, success
 * navigation, and per-reason error mapping are tested in isolation.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RedeemInvite from "./RedeemInvite";

const navigate = vi.fn();
let params = new URLSearchParams();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [params, vi.fn()],
}));

const redeemInviteInput = vi.fn();
vi.mock("../../lib/content/invites/redeem-invite", () => ({
  redeemInviteInput: (...args: unknown[]) => redeemInviteInput(...args),
}));
vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  params = new URLSearchParams();
});

describe("RedeemInvite", () => {
  it("seeds the input from a code+repo deep link", () => {
    params = new URLSearchParams("code=DEUTSCH-8X4K&repo=coach/deutsch-b1");
    render(<RedeemInvite />);
    const input = screen.getByTestId("redeem-invite-input") as HTMLInputElement;
    expect(input.value).toContain("code=DEUTSCH-8X4K");
    expect(input.value).toContain("repo=coach");
  });

  it("navigates to My content on a successful redemption", async () => {
    params = new URLSearchParams("code=DEUTSCH-8X4K&repo=coach/deutsch-b1");
    redeemInviteInput.mockResolvedValue({
      ok: true,
      repo: "coach/deutsch-b1",
      setCount: 3,
      lessonCount: 30,
    });
    render(<RedeemInvite />);
    fireEvent.click(screen.getByTestId("redeem-invite-submit"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/content?tab=my"));
  });

  it("shows a friendly message for an expired code", async () => {
    params = new URLSearchParams("code=DEUTSCH-8X4K&repo=coach/deutsch-b1");
    redeemInviteInput.mockResolvedValue({ ok: false, reason: "expired" });
    render(<RedeemInvite />);
    fireEvent.click(screen.getByTestId("redeem-invite-submit"));
    const error = await screen.findByTestId("redeem-invite-error");
    expect(error.textContent).toMatch(/expired/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains that a bare code needs its full link", async () => {
    redeemInviteInput.mockResolvedValue({ ok: false, reason: "no_repo" });
    render(<RedeemInvite />);
    fireEvent.change(screen.getByTestId("redeem-invite-input"), {
      target: { value: "DEUTSCH-8X4K" },
    });
    fireEvent.click(screen.getByTestId("redeem-invite-submit"));
    const error = await screen.findByTestId("redeem-invite-error");
    expect(error.textContent).toMatch(/full invitation link/i);
  });

  it("disables submit with an empty field", () => {
    render(<RedeemInvite />);
    expect(screen.getByTestId("redeem-invite-submit")).toBeDisabled();
  });
});
