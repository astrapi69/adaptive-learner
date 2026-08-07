import { describe, expect, it, vi } from "vitest";

import type { InviteCodeFile } from "./invite-codes";
import { redeemInvite, redeemInviteInput, type RedeemDeps } from "./redeem-invite";

function makeFile(overrides: Partial<InviteCodeFile> = {}): InviteCodeFile {
  return {
    code: "DEUTSCH-8X4K",
    repo: "coach/deutsch-b1",
    branch: "main",
    max_uses: 25,
    expires: null,
    note: "",
    created: "2026-06-24T10:00:00.000Z",
    ...overrides,
  };
}

/** Build a deps object whose I/O all succeeds, overridable per test. */
function makeDeps(overrides: Partial<RedeemDeps> = {}): RedeemDeps {
  return {
    fetchInviteCode: vi.fn(async () => makeFile()),
    validateUserRepo: vi.fn(async () => ({ ok: true, setCount: 3, lessonCount: 30 })),
    addUserRepo: vi.fn(async () => []),
    syncUserRepo: vi.fn(async () => ({ setCount: 3, lessonCount: 30, trust: 1 as const, retiredArchived: 0 })),
    recordRedemption: vi.fn(async () => undefined),
    resolveRepoToken: vi.fn(() => ""),
    writeRepoToken: vi.fn(() => undefined),
    now: () => "2026-06-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("redeemInvite", () => {
  it("adds the repo flagged shared_via_invite and records the redemption", async () => {
    const deps = makeDeps();
    const outcome = await redeemInvite(
      { code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1" },
      undefined,
      deps,
    );
    expect(outcome).toEqual({
      ok: true,
      repo: "coach/deutsch-b1",
      setCount: 3,
      lessonCount: 30,
    });
    const added = (deps.addUserRepo as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added).toMatchObject({
      owner: "coach",
      repo: "deutsch-b1",
      shared_via_invite: true,
      trust: 1,
    });
    expect(deps.syncUserRepo).toHaveBeenCalledWith("coach/deutsch-b1", undefined);
    expect(deps.recordRedemption).toHaveBeenCalledWith({
      code: "DEUTSCH-8X4K",
      repo: "coach/deutsch-b1",
      redeemed_at: "2026-06-24T12:00:00.000Z",
    });
  });

  it("fails with no_repo when the code carries no repo", async () => {
    const deps = makeDeps();
    expect(await redeemInvite({ code: "DEUTSCH-8X4K" }, undefined, deps)).toEqual({
      ok: false,
      reason: "no_repo",
    });
    expect(deps.fetchInviteCode).not.toHaveBeenCalled();
  });

  it("fails with not_found for an unknown code", async () => {
    const deps = makeDeps({ fetchInviteCode: vi.fn(async () => null) });
    expect(
      await redeemInvite({ code: "NOPE-1234", repo: "a/b" }, undefined, deps),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(deps.addUserRepo).not.toHaveBeenCalled();
  });

  it("relays a closed-code status (expired / inactive)", async () => {
    const deps = makeDeps({
      fetchInviteCode: vi.fn(async () => makeFile({ deactivated: true })),
    });
    expect(
      await redeemInvite({ code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1" }, undefined, deps),
    ).toEqual({ ok: false, reason: "inactive" });
    expect(deps.addUserRepo).not.toHaveBeenCalled();
  });

  it("persists an embedded token before validating a private repo", async () => {
    const deps = makeDeps({
      fetchInviteCode: vi.fn(async () => makeFile({ token: "ghp_embedded" })),
    });
    await redeemInvite({ code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1" }, undefined, deps);
    expect(deps.writeRepoToken).toHaveBeenCalledWith("coach/deutsch-b1", "ghp_embedded");
    const added = (deps.addUserRepo as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.coach).toBe(true);
  });

  it("fails with validate_failed and does not add the repo", async () => {
    const deps = makeDeps({
      validateUserRepo: vi.fn(async () => ({
        ok: false,
        setCount: 0,
        lessonCount: 0,
        reason: "Repository unreachable.",
      })),
    });
    const outcome = await redeemInvite(
      { code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1" },
      undefined,
      deps,
    );
    expect(outcome).toEqual({
      ok: false,
      reason: "validate_failed",
      detail: "Repository unreachable.",
    });
    expect(deps.addUserRepo).not.toHaveBeenCalled();
  });

  it("catches an unexpected I/O error as reason error", async () => {
    const deps = makeDeps({
      fetchInviteCode: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    expect(
      await redeemInvite({ code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1" }, undefined, deps),
    ).toEqual({ ok: false, reason: "error", detail: "network down" });
  });
});

describe("redeemInviteInput", () => {
  it("parses a full link then redeems", async () => {
    const deps = makeDeps();
    const outcome = await redeemInviteInput(
      "https://x.test/invite?code=DEUTSCH-8X4K&repo=coach/deutsch-b1",
      undefined,
      deps,
    );
    expect(outcome.ok).toBe(true);
  });

  it("fails with no_code for unparseable input", async () => {
    const deps = makeDeps();
    expect(await redeemInviteInput("???", undefined, deps)).toEqual({
      ok: false,
      reason: "no_code",
    });
    expect(deps.fetchInviteCode).not.toHaveBeenCalled();
  });
});
