/**
 * AiPrivacyNote (#3812): the note an AI check shows before it runs, saying
 * what the request sends, followed by a link to the privacy policy on the
 * docs site in the learner's language. The AI content check and the AI
 * review before sharing both render it, each with its own typography.
 */

import { useI18n } from "../../hooks/ui/useI18n";
import { docsUrlForSlug } from "../../lib/help/help-routes";

export interface AiPrivacyNoteProps {
  /** The localized note: what is sent, and that the provider also gets the IP address and key. */
  text: string;
  /** The paragraph's test id; the link gets ``<testId>-link``. */
  testId: string;
  /** Class of the paragraph, so each dialog keeps its own type size. */
  className?: string;
}

/**
 * Render the note and the privacy policy link in one paragraph.
 *
 * @example
 * <AiPrivacyNote
 *   text={t("content.ai_check.privacy", "Only your cards are sent ...")}
 *   testId="ai-validation-privacy"
 *   className="text-xs text-fg-muted"
 * />
 */
export default function AiPrivacyNote({
  text,
  testId,
  className,
}: AiPrivacyNoteProps) {
  const { t, lang } = useI18n();
  return (
    <p className={className} data-testid={testId}>
      {text}{" "}
      <a
        href={docsUrlForSlug("legal/privacy", lang)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        data-testid={`${testId}-link`}
      >
        {t("content.ai_privacy_link", "Privacy policy")}
      </a>
    </p>
  );
}
