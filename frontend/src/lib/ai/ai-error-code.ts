/**
 * Classified tutor AI failures (#3376).
 *
 * The session exchange carries ``ai_error`` (technical text) plus
 * ``ai_error_code``. Both storage modes emit the same codes: the backend
 * classifies the provider exception, the browser session flow classifies the
 * ``ApiError`` status of the direct provider call. The UI maps the code to a
 * localized message and shows the raw text only in developer mode.
 *
 * @example
 * const code = aiErrorCodeForStatus(err.status); // 401 -> "provider_auth"
 * notify.error(aiErrorMessage(t, code));
 */

export type AiErrorCode =
  | "no_provider"
  | "no_api_key"
  | "no_model"
  | "provider_auth"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_error";

/** Class of a failed direct provider call by its HTTP status (0 = no response). */
export function aiErrorCodeForStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 429) return "provider_rate_limited";
  if (status === 0 || status >= 500) return "provider_unavailable";
  return "provider_error";
}

const MESSAGES: Record<AiErrorCode, [key: string, fallback: string]> = {
  no_provider: [
    "session.no_api_key",
    "No AI key set. Add a key for your AI provider in Settings to chat with the tutor. Lessons and reviews work without a key.",
  ],
  no_api_key: [
    "session.no_api_key",
    "No AI key set. Add a key for your AI provider in Settings to chat with the tutor. Lessons and reviews work without a key.",
  ],
  no_model: [
    "session.ai_error_no_model",
    "No model is selected for your AI provider. Choose a model in Settings > AI.",
  ],
  provider_auth: [
    "session.ai_error_provider_auth",
    "Your AI provider rejected the key. Check the key in Settings > AI.",
  ],
  provider_rate_limited: [
    "session.ai_error_rate_limited",
    "Your AI provider's limit is reached. Wait a moment or check your quota, then send again.",
  ],
  provider_unavailable: [
    "session.ai_error_provider_unavailable",
    "Your AI provider cannot be reached right now. Check your connection and send again.",
  ],
  provider_error: ["session.ai_error", "The AI provider could not reply."],
};

/** Localized message for a code; an unknown or missing code gets the generic one. */
export function aiErrorMessage(
  t: (key: string, fallback: string) => string,
  code: string | null | undefined,
): string {
  const [key, fallback] =
    code && code in MESSAGES ? MESSAGES[code as AiErrorCode] : MESSAGES.provider_error;
  return t(key, fallback);
}
