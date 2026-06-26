/**
 * Redeem an invitation code (#1093) — the orchestration shared by the
 * ``/invite`` deep-link page and the "Einladungscode eingeben" dialog.
 *
 * Validates the code against the coach repo's ``codes/<CODE>.json`` (expiry +
 * deactivation), then — exactly like the ``/add-repo`` flow — validates the
 * repo, adds it as a content source flagged ``shared_via_invite`` (so the
 * learner never sees a re-share / Teilen control on it), syncs it, and records
 * the redemption locally. Pure-ish: every I/O dependency is injected with a
 * real default, so the whole decision tree is unit-testable with stubs.
 */

import {
  addUserRepo,
  parseGitHubRepoUrl,
  syncUserRepo,
  userRepoSource,
  type SyncProgress,
  type UserContentRepo,
} from "../repos/content-repos";
import { validateUserRepo } from "../repos/content-repo-validate";
import { resolveRepoToken, writeRepoToken } from "../repos/repo-token";
import {
  evaluateInviteStatus,
  parseInviteInput,
  type InviteLinkParts,
  type RedeemStatus,
} from "./invite-codes";
import { fetchInviteCode, recordRedemption } from "./invite-store";

/** Why a redemption could not complete. ``no_code`` = unparseable input,
 *  ``no_repo`` = a bare code with no repo (the link/QR carries the repo),
 *  ``not_found`` = the code file is absent (wrong code), the three
 *  {@link RedeemStatus} values = the code exists but is closed, and
 *  ``validate_failed`` / ``error`` = the repo could not be added. */
export type RedeemFailReason =
  | "no_code"
  | "no_repo"
  | "not_found"
  | Exclude<RedeemStatus, "ok">
  | "validate_failed"
  | "error";

/** Result of {@link redeemInvite}. */
export type RedeemOutcome =
  | { ok: true; repo: string; setCount: number; lessonCount: number }
  | { ok: false; reason: RedeemFailReason; detail?: string };

/** Injectable I/O for {@link redeemInvite} (tests pass stubs). */
export interface RedeemDeps {
  fetchInviteCode: typeof fetchInviteCode;
  validateUserRepo: typeof validateUserRepo;
  addUserRepo: typeof addUserRepo;
  syncUserRepo: typeof syncUserRepo;
  recordRedemption: typeof recordRedemption;
  resolveRepoToken: typeof resolveRepoToken;
  writeRepoToken: typeof writeRepoToken;
  /** ISO timestamp for the redemption record (tests pass a fixed value). */
  now: () => string;
}

const defaultDeps: RedeemDeps = {
  fetchInviteCode,
  validateUserRepo,
  addUserRepo,
  syncUserRepo,
  recordRedemption,
  resolveRepoToken,
  writeRepoToken,
  now: () => new Date().toISOString(),
};

/**
 * Redeem parsed invite parts. ``onProgress`` forwards the underlying repo-sync
 * progress so the caller can render a bar. Never throws — every failure path
 * resolves to ``{ok: false, reason}``.
 */
export async function redeemInvite(
  parts: InviteLinkParts,
  onProgress?: (progress: SyncProgress) => void,
  deps: RedeemDeps = defaultDeps,
): Promise<RedeemOutcome> {
  if (!parts.repo) return { ok: false, reason: "no_repo" };
  const parsedRepo = parseGitHubRepoUrl(parts.repo);
  if (!parsedRepo) return { ok: false, reason: "no_repo" };

  const source = userRepoSource(parsedRepo.owner, parsedRepo.repo);
  const branch = parts.branch || "main";

  try {
    const file = await deps.fetchInviteCode(
      source,
      branch,
      parts.code,
      deps.resolveRepoToken(source),
    );
    if (!file) return { ok: false, reason: "not_found" };

    const status = evaluateInviteStatus(file);
    if (status !== "ok") return { ok: false, reason: status };

    // A genuinely-private repo can ship a read-only token in the code file;
    // persist it as the per-repo token so content reads authenticate.
    if (file.token) deps.writeRepoToken(source, file.token);

    const validation = await deps.validateUserRepo(
      { owner: parsedRepo.owner, repo: parsedRepo.repo, branch },
      deps.resolveRepoToken(source),
    );
    if (!validation.ok) {
      return { ok: false, reason: "validate_failed", detail: validation.reason };
    }

    const repo: UserContentRepo = {
      url: `https://github.com/${source}`,
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
      branch,
      connected: true,
      last_synced: null,
      set_count: validation.setCount,
      lesson_count: validation.lessonCount,
      trust: 1,
      coach: Boolean(file.token),
      shared_via_invite: true,
    };
    await deps.addUserRepo(repo);

    const sync = await deps.syncUserRepo(source, onProgress);
    await deps.recordRedemption({
      code: parts.code,
      repo: source,
      redeemed_at: deps.now(),
    });
    return {
      ok: true,
      repo: source,
      setCount: sync.setCount,
      lessonCount: sync.lessonCount,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      detail: error instanceof Error ? error.message : undefined,
    };
  }
}

/** Convenience: parse raw learner input then redeem. ``no_code`` when the
 *  input yields no valid code. */
export async function redeemInviteInput(
  input: string,
  onProgress?: (progress: SyncProgress) => void,
  deps: RedeemDeps = defaultDeps,
): Promise<RedeemOutcome> {
  const parts = parseInviteInput(input);
  if (!parts) return { ok: false, reason: "no_code" };
  return redeemInvite(parts, onProgress, deps);
}
