/**
 * The display name of an AI provider in the UI language (#3812).
 *
 * Running text that names the provider ("As with every request, {provider}
 * also receives ...", "Checked with ...") uses the same label the settings
 * show, never the internal id: the privacy note of the AI review before
 * sharing used to read "anthropic" in every language.
 */

/**
 * Return the provider's ``settings.provider_<id>`` label, for example
 * "Anthropic Claude" for ``anthropic``.
 *
 * Edge case: a provider without a label key keeps its id, the only name
 * there is for it.
 *
 * @example
 * aiProviderLabel(t, "gemini"); // "Google Gemini"
 */
export function aiProviderLabel(
  t: (key: string, fallback?: string) => string,
  provider: string,
): string {
  return t(`settings.provider_${provider}`, provider);
}
