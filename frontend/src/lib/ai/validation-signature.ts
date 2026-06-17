/**
 * EXP-033 / AIV-09 + AIV-10 — AI-validation signature + client-side
 * verification (Stufe 1 + 2).
 *
 * The signature makes an AI check provable: it records the content hash
 * the check ran against, the provider + a non-guessable response id, the
 * outcome, and a timestamp. Other clients verify it offline (Stufe 1) and
 * with light provider-format checks (Stufe 2) to render an "AI-checked"
 * badge — without re-running the (paid) check. It is "good enough" for a
 * community trust signal, not tamper-proof (that needs server Stufe 3).
 *
 * Pure module — no I/O, no storage. The current content hash is passed
 * in by the caller (computed via ``content-hash.ts``).
 */

export const CHECKER_VERSION = "1.0";

export interface AiValidationSignature {
  /** ``sha256:…`` of the cards the check ran against (AIV-08). */
  content_hash: string;
  result: "passed" | "review_needed";
  checked_cards: number;
  issues_found: number;
  /** ``"<provider>/<model>"`` e.g. ``"openai/gpt-4o-mini"``. */
  provider: string;
  /** Provider response id (OpenAI ``chatcmpl-…`` / Anthropic ``msg_…``). */
  response_id: string;
  /** ISO-8601 timestamp the check completed. */
  timestamp: string;
  checker_version: string;
}

export interface BuildSignatureArgs {
  contentHash: string;
  checkedCards: number;
  issuesFound: number;
  /** Provider slug ("openai" | "anthropic" | "gemini"). */
  provider: string;
  model: string;
  responseId: string;
  timestamp?: string;
}

/** Build a signature object from a completed run. */
export function buildSignature(args: BuildSignatureArgs): AiValidationSignature {
  return {
    content_hash: args.contentHash,
    result: args.issuesFound === 0 ? "passed" : "review_needed",
    checked_cards: args.checkedCards,
    issues_found: args.issuesFound,
    provider: `${args.provider}/${args.model}`,
    response_id: args.responseId,
    timestamp: args.timestamp ?? new Date().toISOString(),
    checker_version: CHECKER_VERSION,
  };
}

/** Whether ``responseId`` matches the provider's id format (Stufe 2).
 *  Lenient for Gemini (no stable public prefix) — any non-empty id. */
export function responseIdMatchesProvider(
  providerSlug: string,
  responseId: string,
): boolean {
  if (!responseId) return false;
  const provider = providerSlug.split("/")[0];
  switch (provider) {
    case "openai":
      return responseId.startsWith("chatcmpl-");
    case "anthropic":
      return responseId.startsWith("msg_");
    case "gemini":
      return responseId.length > 0;
    default:
      return responseId.length > 0;
  }
}

/** Structural completeness check (Stufe 1). */
export function isCompleteSignature(sig: unknown): sig is AiValidationSignature {
  if (!sig || typeof sig !== "object") return false;
  const s = sig as Record<string, unknown>;
  return (
    typeof s.content_hash === "string" &&
    s.content_hash.length > 0 &&
    (s.result === "passed" || s.result === "review_needed") &&
    typeof s.checked_cards === "number" &&
    typeof s.issues_found === "number" &&
    typeof s.provider === "string" &&
    s.provider.length > 0 &&
    typeof s.response_id === "string" &&
    s.response_id.length > 0 &&
    typeof s.timestamp === "string" &&
    s.timestamp.length > 0 &&
    typeof s.checker_version === "string"
  );
}

/** Verification outcome → drives the badge. */
export type SignatureStatus = "verified" | "stale" | "invalid" | "none";

/**
 * Verify a signature against the current content hash (Stufe 1 + 2).
 *
 * @param sig - the stored signature, or null/undefined.
 * @param currentHash - ``sha256:…`` of the set's CURRENT cards.
 * @param now - injectable clock for deterministic tests.
 */
export function verifySignature(
  sig: AiValidationSignature | null | undefined,
  currentHash: string,
  now: Date = new Date(),
): SignatureStatus {
  if (sig == null) return "none";
  if (!isCompleteSignature(sig)) return "invalid";
  // Timestamp must not be in the future (allow 1 min clock skew).
  const ts = Date.parse(sig.timestamp);
  if (Number.isNaN(ts) || ts > now.getTime() + 60_000) return "invalid";
  // Stufe 2: response-id format must match the provider.
  if (!responseIdMatchesProvider(sig.provider, sig.response_id)) return "invalid";
  // Stufe 1: the content must be unchanged since the check.
  return sig.content_hash === currentHash ? "verified" : "stale";
}

/**
 * Cheap badge status for a set list, WITHOUT recomputing the content hash
 * (which would mean loading every set's cards). Uses the set's
 * ``cached_version`` as the content-change proxy: a version bump on a
 * re-download means the content changed since the signed check.
 *
 * The deep, hash-based {@link verifySignature} runs in the dialog where
 * the cards are already loaded.
 */
export function badgeStatusForCachedSet(
  signature: AiValidationSignature | null | undefined,
  cachedSetVersion: string | null,
  currentSetVersion: string | null,
): SignatureStatus {
  if (signature == null) return "none";
  if (!isCompleteSignature(signature)) return "invalid";
  return cachedSetVersion === currentSetVersion ? "verified" : "stale";
}
