/**
 * Render + interaction tests for the coach InviteCodesPanel (#1093). The hook
 * is mocked so the panel's branching (token gate, empty state, table, generate)
 * is tested without touching GitHub.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InviteCodeFile } from "../../../lib/content/invites/invite-codes";
import type { UseInviteCodes } from "./useInviteCodes";
import InviteCodesPanel from "./InviteCodesPanel";

const generate = vi.fn(async () => null);
const deactivate = vi.fn(async () => true);
let hookState: UseInviteCodes;

vi.mock("./useInviteCodes", () => ({
  useInviteCodes: () => hookState,
}));
vi.mock("../../../shared/feedback/QrCodeModal", () => ({ default: () => null }));
const { notifySuccess } = vi.hoisted(() => ({ notifySuccess: vi.fn() }));
vi.mock("../../../utils/notify", () => ({
  notify: { success: notifySuccess, error: vi.fn() },
}));

function code(overrides: Partial<InviteCodeFile> = {}): InviteCodeFile {
  return {
    code: "DEUTSCH-8X4K",
    repo: "coach/deutsch-b1",
    branch: "main",
    max_uses: 25,
    expires: "2026-12-31",
    note: "Klasse 8a",
    created: "2026-06-24T10:00:00.000Z",
    ...overrides,
  };
}

function baseHook(overrides: Partial<UseInviteCodes> = {}): UseInviteCodes {
  return {
    codes: [],
    loading: false,
    working: false,
    error: null,
    generate,
    deactivate,
    reload: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hookState = baseHook();
});

describe("InviteCodesPanel", () => {
  it("shows the token-required hint when the repo has no token", () => {
    render(<InviteCodesPanel source="coach/deutsch-b1" branch="main" token="" />);
    expect(screen.getByTestId("invite-codes-needs-token")).toBeInTheDocument();
    expect(screen.queryByTestId("invite-code-generate")).not.toBeInTheDocument();
  });

  it("shows the empty state with a token and no codes", () => {
    render(<InviteCodesPanel source="coach/deutsch-b1" branch="main" token="ghp_x" />);
    expect(screen.getByTestId("invite-codes-empty")).toBeInTheDocument();
    expect(screen.getByTestId("invite-code-generate")).toBeInTheDocument();
  });

  it("renders a code row with its actions and an inactive badge", () => {
    hookState = baseHook({
      codes: [code(), code({ code: "MATHE-R2P7", deactivated: true, expires: null })],
    });
    render(<InviteCodesPanel source="coach/deutsch-b1" branch="main" token="ghp_x" />);
    expect(screen.getByTestId("invite-code-row-DEUTSCH-8X4K")).toBeInTheDocument();
    expect(screen.getByTestId("invite-code-copy-link-DEUTSCH-8X4K")).toBeInTheDocument();
    expect(screen.getByTestId("invite-code-qr-DEUTSCH-8X4K")).toBeInTheDocument();
    // Active code offers deactivate; inactive one does not + shows the badge.
    expect(screen.getByTestId("invite-code-deactivate-DEUTSCH-8X4K")).toBeInTheDocument();
    expect(screen.queryByTestId("invite-code-deactivate-MATHE-R2P7")).not.toBeInTheDocument();
    expect(screen.getByTestId("invite-code-inactive-MATHE-R2P7")).toBeInTheDocument();
  });

  it("calls generate from the form", () => {
    render(<InviteCodesPanel source="coach/deutsch-b1" branch="main" token="ghp_x" />);
    fireEvent.click(screen.getByTestId("invite-code-generate"));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("deactivates a code from its row action", () => {
    hookState = baseHook({ codes: [code()] });
    render(<InviteCodesPanel source="coach/deutsch-b1" branch="main" token="ghp_x" />);
    fireEvent.click(screen.getByTestId("invite-code-deactivate-DEUTSCH-8X4K"));
    expect(deactivate).toHaveBeenCalledWith("DEUTSCH-8X4K");
  });
});
