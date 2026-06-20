/**
 * AIX-05 (EXP-036) — "Why regenerate?" feedback dialog.
 *
 * Replaces the blind regenerate-confirm with a short reason picker so the
 * next generation is informed: the chosen reason (and any free text) is
 * turned into prompt feedback, and "wrong language" lets the user pick the
 * correct target language. Presentational + controlled: the parent owns
 * ``open`` and receives the structured choice via ``onSubmit``.
 *
 * The reason -> prompt-feedback mapping ({@link feedbackForReason}) lives
 * here as English constants because the text is sent to the model (the
 * prompt scaffold is English); the on-screen labels are localized.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LANGUAGE_OPTIONS } from "../../lib/content/language-options";

type Translate = (key: string, fallback?: string) => string;

/** The structured regeneration reasons. */
export type RegenerateReason =
  | "too_easy"
  | "too_hard"
  | "wrong_language"
  | "more_variety"
  | "none";

/** The user's regeneration choice. */
export interface RegenerateFeedback {
  reason: RegenerateReason;
  /** Free-text feedback (optional). */
  freeText: string;
  /** Chosen target language (only for ``wrong_language``). */
  language?: string;
}

interface RegenerateFeedbackDialogProps {
  open: boolean;
  /** Pre-selected language for the "wrong language" picker. */
  defaultLanguage?: string;
  onSubmit: (feedback: RegenerateFeedback) => void;
  onCancel: () => void;
  t: Translate;
}

const REASONS: RegenerateReason[] = [
  "too_easy",
  "too_hard",
  "wrong_language",
  "more_variety",
  "none",
];

/** Build the English prompt-feedback string for a reason + free text. */
export function feedbackForReason(
  reason: RegenerateReason,
  freeText: string,
  languageName?: string,
): string {
  const parts: string[] = [];
  switch (reason) {
    case "too_easy":
      parts.push("Make the questions noticeably harder and more challenging.");
      break;
    case "too_hard":
      parts.push("Make the questions easier and more accessible.");
      break;
    case "wrong_language":
      parts.push(
        `The previous exercises were in the wrong language. Write every exercise in ${
          languageName ?? "the requested language"
        }.`,
      );
      break;
    case "more_variety":
      parts.push("Use a wider variety of exercise types.");
      break;
    case "none":
    default:
      break;
  }
  const extra = freeText.trim();
  if (extra) parts.push(extra);
  return parts.join(" ").trim();
}

function reasonLabel(reason: RegenerateReason, t: Translate): string {
  switch (reason) {
    case "too_easy":
      return t("content.ai_exercises.feedback.too_easy", "Too easy");
    case "too_hard":
      return t("content.ai_exercises.feedback.too_hard", "Too hard");
    case "wrong_language":
      return t("content.ai_exercises.feedback.wrong_language", "Wrong language");
    case "more_variety":
      return t("content.ai_exercises.feedback.more_variety", "More variety");
    case "none":
    default:
      return t("content.ai_exercises.feedback.none", "No particular reason");
  }
}

/** Reason picker + free-text + (conditional) language select. */
export default function RegenerateFeedbackDialog({
  open,
  defaultLanguage,
  onSubmit,
  onCancel,
  t,
}: RegenerateFeedbackDialogProps) {
  const [reason, setReason] = useState<RegenerateReason>("none");
  const [freeText, setFreeText] = useState("");
  const [language, setLanguage] = useState(defaultLanguage || "en");

  if (!open) return null;

  return (
    <div className="modal-overlay" data-testid="regenerate-feedback-dialog">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regenerate-feedback-title"
      >
        <h2 id="regenerate-feedback-title" className="modal-title">
          {t("content.ai_exercises.feedback.title", "Why regenerate?")}
        </h2>
        <div className="flex flex-col gap-2">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-fg-primary">
              <input
                type="radio"
                name="regenerate-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                data-testid={`regenerate-reason-${r}`}
              />
              <span>{reasonLabel(r, t)}</span>
            </label>
          ))}
        </div>
        {reason === "wrong_language" && (
          <label className="form-row mt-2">
            <span className="form-label">
              {t("content.ai_exercises.feedback.language_label", "Language")}
            </span>
            <select
              data-testid="regenerate-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-row mt-2">
          <span className="form-label">
            {t("content.ai_exercises.feedback.freetext_label", "Anything else? (optional)")}
          </span>
          <textarea
            data-testid="regenerate-freetext"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={2}
            placeholder={t("content.ai_exercises.feedback.freetext_placeholder", "Your feedback…")}
          />
        </label>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            data-testid="regenerate-feedback-cancel"
            onClick={onCancel}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            data-testid="regenerate-feedback-submit"
            onClick={() =>
              onSubmit({
                reason,
                freeText,
                language: reason === "wrong_language" ? language : undefined,
              })
            }
          >
            {t("content.ai_exercises.regenerate", "Regenerate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
