/**
 * Invitation codes for private content sharing (#1093).
 *
 * A coach/teacher generates short, human-shareable codes that grant a learner
 * access to a content repository without a GitHub account or token. This module
 * is the pure, framework-free core — code generation, the on-repo code-file
 * shape, redeem-status evaluation, and invite-link build/parse. It performs NO
 * I/O; the GitHub reads/writes + local redemption records live in
 * ``invite-store.ts``.
 *
 * ## How a code resolves to a repo (no central database)
 *
 * The GH-Pages build has no backend, so there is no central registry mapping a
 * bare code to a repo. Instead the **shareable artifact is the invite link**
 * ``…/invite?code=DEUTSCH-8X4K&repo=owner/name`` (and its QR), which carries the
 * repo with the code. The code file ``codes/DEUTSCH-8X4K.json`` lives in that
 * repo and holds the access-control rules (expiry, deactivation, max uses). A
 * bare code typed on its own is only redeemable together with the repo it
 * belongs to, so the link/QR is the primary transport.
 *
 * ## What is enforceable client-side
 *
 * Expiry and deactivation are coach-controlled fields READ from the code file,
 * so both are enforced in the browser at redeem time. ``max_uses`` cannot be
 * truly counted across clients without a server, so in Dexie mode it is
 * advisory (shown to the coach; a coach deactivates a full code); server mode
 * (``POST /api/invite/redeem``) is where the count is authoritative — deferred.
 */

/** Directory inside a coach content repo where invite-code files live. */
export const INVITE_CODES_DIR = "codes";

/**
 * Alphabet for the random portion of a code: uppercase letters + digits with
 * the confusable characters removed — no ``O``/``0`` and no ``I``/``1`` — so a
 * code read off a screen or whiteboard is unambiguous. 32 symbols.
 */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Options for {@link generateInviteCode}. */
export interface GenerateCodeOptions {
  /** Optional custom prefix (e.g. ``"DEUTSCH"`` → ``DEUTSCH-8X4K``). Sanitised
   *  to uppercase ``A-Z0-9`` and capped; an empty result is dropped. */
  prefix?: string;
  /** Length of the random portion (default 8). Clamped to 4..16. */
  randomLength?: number;
}

/**
 * Sanitise a user-entered code prefix: uppercase, keep only ``A-Z0-9`` (runs of
 * anything else collapse to nothing), trim, and cap at 12 chars. Returns ``""``
 * when nothing usable remains.
 */
export function sanitizeCodePrefix(raw: string): string {
  return (raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
}

/**
 * Unbiased random index in ``[0, maxExclusive)`` using ``crypto`` with rejection
 * sampling. Falls back to a less-uniform path only if ``crypto`` is absent.
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj?.getRandomValues) {
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    let value: number;
    do {
      cryptoObj.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % maxExclusive;
  }
  // crypto unavailable (very old/locked-down runtime): best-effort fallback.
  return Math.floor((Date.now() % 1000) / 1000 * maxExclusive) % maxExclusive;
}

/**
 * Generate an invitation code: an optional sanitised prefix, then a ``-``, then
 * ``randomLength`` characters from {@link CODE_ALPHABET}.
 *
 * @param options Prefix + random-length controls.
 * @param randomInt Injectable index source (tests pass a deterministic stub);
 *   defaults to a crypto-backed unbiased generator.
 *
 * @example
 * generateInviteCode({ prefix: "Deutsch" }) // → "DEUTSCH-8X4KQ7MR"
 * generateInviteCode()                       // → "8X4KQ7MR"
 */
export function generateInviteCode(
  options: GenerateCodeOptions = {},
  randomInt: (maxExclusive: number) => number = secureRandomInt,
): string {
  const length = Math.min(16, Math.max(4, options.randomLength ?? 8));
  let random = "";
  for (let i = 0; i < length; i += 1) {
    random += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  const prefix = sanitizeCodePrefix(options.prefix ?? "");
  return prefix ? `${prefix}-${random}` : random;
}

/** Normalise a code as entered: trim + uppercase (codes are case-insensitive). */
export function normalizeInviteCode(input: string): string {
  return (input ?? "").trim().toUpperCase();
}

/**
 * True when ``code`` has a plausible invitation-code shape: an optional
 * ``PREFIX-`` segment then at least 4 alphanumerics, total 4..40 chars, only
 * ``A-Z0-9-``. Lenient on the exact alphabet (a custom prefix may legitimately
 * contain ``O``/``I``); it is a typo guard, not a checksum.
 */
export function isValidInviteCodeFormat(code: string): boolean {
  const c = normalizeInviteCode(code);
  if (c.length < 4 || c.length > 40) return false;
  return /^(?:[A-Z0-9]+-)?[A-Z0-9]{4,}$/.test(c);
}

/** Repo-relative path of a code's JSON file: ``codes/<CODE>.json``. */
export function inviteCodeFilePath(code: string): string {
  return `${INVITE_CODES_DIR}/${normalizeInviteCode(code)}.json`;
}

/**
 * The persisted shape of ``codes/<CODE>.json`` in a coach content repo. The
 * coach (the repo owner) writes it; a redeeming learner reads it.
 */
export interface InviteCodeFile {
  /** The code, uppercased. */
  code: string;
  /** ``owner/repo`` the code grants access to. */
  repo: string;
  /** Branch to read content from (default ``main``). */
  branch?: string;
  /** Maximum redemptions the coach intends (advisory in Dexie mode, 0 = ∞). */
  max_uses: number;
  /** Inclusive expiry date ``YYYY-MM-DD``, or null for no expiry. */
  expires: string | null;
  /** Free-text note shown to the coach (e.g. a class name). */
  note: string;
  /** ISO-8601 timestamp the code was generated. */
  created: string;
  /** Coach revoked the code: blocks NEW redemptions; existing access stays. */
  deactivated?: boolean;
  /** Optional embedded read-only token for a genuinely-private repo. The
   *  default flow uses an unlisted PUBLIC repo and omits this. */
  token?: string;
}

/** A learner's local record that they redeemed a code (Dexie / pluginSettings). */
export interface InviteRedemption {
  /** The redeemed code. */
  code: string;
  /** ``owner/repo`` that was added. */
  repo: string;
  /** ISO-8601 timestamp of the redemption. */
  redeemed_at: string;
}

/** Outcome of {@link evaluateInviteStatus}: ``ok`` means redeemable. */
export type RedeemStatus = "ok" | "expired" | "inactive" | "full";

/** Options for {@link evaluateInviteStatus}. */
export interface EvaluateStatusOptions {
  /** "Now" for the expiry check (default the real clock). */
  now?: Date;
  /** Redemptions already counted (server mode only); omit in Dexie so
   *  ``max_uses`` is not enforced client-side. */
  knownRedemptions?: number;
}

/**
 * End-of-day (UTC) epoch ms for an inclusive ``YYYY-MM-DD`` expiry, or null when
 * the value is empty/unparseable (treated as "no expiry").
 */
function expiryDeadlineMs(expires: string | null | undefined): number | null {
  if (!expires) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expires.trim());
  const iso = dateOnly ? `${expires.trim()}T23:59:59.999Z` : expires;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Decide whether a code may be redeemed right now. Precedence: a deactivated
 * code is ``inactive`` first, then an expired code is ``expired``, then (only
 * when a redemption count is known) a code at its limit is ``full``, else ``ok``.
 */
export function evaluateInviteStatus(
  file: InviteCodeFile,
  options: EvaluateStatusOptions = {},
): RedeemStatus {
  if (file.deactivated) return "inactive";
  const deadline = expiryDeadlineMs(file.expires);
  const now = (options.now ?? new Date()).getTime();
  if (deadline !== null && now > deadline) return "expired";
  if (
    typeof options.knownRedemptions === "number" &&
    file.max_uses > 0 &&
    options.knownRedemptions >= file.max_uses
  ) {
    return "full";
  }
  return "ok";
}

/** i18n key + English fallback for a non-``ok`` {@link RedeemStatus}, so every
 *  surface labels a failed redemption identically. UI-framework-free. */
export function redeemStatusI18n(status: Exclude<RedeemStatus, "ok">): {
  key: string;
  fallback: string;
} {
  switch (status) {
    case "expired":
      return { key: "invitation_code.error.expired", fallback: "This invitation code has expired." };
    case "inactive":
      return {
        key: "invitation_code.error.inactive",
        fallback: "This invitation code is no longer active.",
      };
    case "full":
      return { key: "invitation_code.error.full", fallback: "This invitation code is full." };
  }
}

/** Parsed pieces of an invite link / pasted code. */
export interface InviteLinkParts {
  /** The (normalised) code. */
  code: string;
  /** ``owner/repo`` when the input carried it (the link/QR always does). */
  repo?: string;
  /** Branch when the input carried it. */
  branch?: string;
}

/**
 * Build the shareable invite link the coach hands out (and encodes as a QR):
 * ``{origin}/invite?code=CODE&repo=owner/repo[&branch=x]``. The trailing slash
 * on ``origin`` (if any) is normalised away.
 */
export function buildInviteLink(
  origin: string,
  parts: { code: string; repo: string; branch?: string },
): string {
  const base = origin.replace(/\/+$/, "");
  const query = new URLSearchParams({
    code: normalizeInviteCode(parts.code),
    repo: parts.repo,
  });
  if (parts.branch && parts.branch !== "main") query.set("branch", parts.branch);
  return `${base}/invite?${query.toString()}`;
}

/** Pull invite parts out of a ``URLSearchParams``-like query, or null. */
function partsFromQuery(query: URLSearchParams): InviteLinkParts | null {
  const code = query.get("code");
  if (!code) return null;
  const normalized = normalizeInviteCode(code);
  if (!isValidInviteCodeFormat(normalized)) return null;
  const repo = query.get("repo") || undefined;
  const branch = query.get("branch") || undefined;
  return { code: normalized, repo, branch };
}

/**
 * Parse anything a learner might paste into the redeem field:
 *
 *   - a full invite URL (any origin/path) carrying ``?code=…&repo=…``;
 *   - a bare query string ``code=…&repo=…``;
 *   - a bare code ``DEUTSCH-8X4K`` (no repo — only redeemable with the repo).
 *
 * Returns null when no valid code can be extracted.
 */
export function parseInviteInput(input: string): InviteLinkParts | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  // A full URL.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return partsFromQuery(new URL(trimmed).searchParams);
    } catch {
      return null;
    }
  }
  // A bare query string.
  if (trimmed.includes("code=")) {
    const query = new URLSearchParams(
      trimmed.startsWith("?") ? trimmed.slice(1) : trimmed,
    );
    const fromQuery = partsFromQuery(query);
    if (fromQuery) return fromQuery;
  }
  // A bare code.
  const code = normalizeInviteCode(trimmed);
  return isValidInviteCodeFormat(code) ? { code } : null;
}
