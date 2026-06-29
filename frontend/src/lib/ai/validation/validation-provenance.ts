/**
 * validation-provenance — compose the "who ran the AI content check" line shown
 * in the validation dialog and the exported Markdown report (#940).
 *
 * Pure + i18n-free: the caller passes the already-localized provider label and
 * the "checked with" prefix, so the same string renders in the dialog and the
 * export without duplicating the format. The provider/model come from the
 * actual run (the user's active provider + resolved model), never hardcoded.
 */

/** Build "Checked with: Anthropic Claude (claude-haiku-4-5-…)" or "" when the
 *  provider is unknown (an older cached report without provenance). */
export function checkedWithLine(args: {
  /** Localized "Checked with" prefix, e.g. "Geprüft mit". */
  prefix: string;
  /** Localized provider name, e.g. "Anthropic Claude". */
  providerLabel: string;
  /** Resolved model id, e.g. "claude-haiku-4-5-20251001". */
  model: string;
}): string {
  if (!args.providerLabel.trim()) return "";
  const model = args.model.trim();
  return model
    ? `${args.prefix}: ${args.providerLabel} (${model})`
    : `${args.prefix}: ${args.providerLabel}`;
}
