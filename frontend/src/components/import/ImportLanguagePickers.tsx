/**
 * Source / target language pickers for the import-detail page (extracted
 * from ImportDetail for the complexity burn-down #419).
 *
 * v1.54.0 — the language pair is set BEFORE analysis so it flows through
 * the whole pipeline. Source = chat language (app default); target =
 * detected learning language. Both editable. Markup + testids preserved.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "../../lib/content/language-options";

interface ImportLanguagePickersProps {
  sourceLang: string;
  targetLang: string;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  t: (key: string, fallback?: string) => string;
}

/** The chat-language + learning-language select pair. */
export default function ImportLanguagePickers({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  t,
}: ImportLanguagePickersProps) {
  return (
    <div
      className="import-language-pickers flex flex-wrap gap-4 mt-4"
      data-testid="import-language-pickers"
    >
      <div className="form-row">
        <span className="form-label">
          {t("import.chat_language", "Chat language (you speak)")}
        </span>
        <Select value={sourceLang || undefined} onValueChange={onSourceChange}>
          <SelectTrigger data-testid="import-source-language">
            <SelectValue placeholder={t("import.select_language", "Select a language…")} />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.name} ({opt.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="form-row">
        <span className="form-label">{t("import.learning_language", "Learning language")}</span>
        <Select value={targetLang || undefined} onValueChange={onTargetChange}>
          <SelectTrigger data-testid="import-target-language">
            <SelectValue placeholder={t("import.select_language", "Select a language…")} />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.name} ({opt.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
