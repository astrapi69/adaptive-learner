/**
 * SourceLanguagesControl (Phase 60 / v1.44.0).
 *
 * Settings > Learning control letting multilingual learners mark
 * EXTRA languages they speak besides the app language. Content
 * authored for those source languages then surfaces in the
 * Content Browser's primary tree instead of the collapsed
 * "other source languages" section.
 *
 * The app language is always the primary source language and is
 * shown disabled/checked — it can't be removed here (change it in
 * Settings > General > Language).
 */

import { useEffect, useState } from "react";

import { useI18n } from "../../../hooks/ui/useI18n";
import { languageDisplayName } from "../../../lib/content/language/language-names";
import {
  readAdditionalSourceLanguages,
  writeAdditionalSourceLanguages,
} from "../../../lib/content/language/sourceLanguagePref";

// The languages the app is translated into — the sensible set of
// source languages a learner is likely to read explanations in.
const OFFERED = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"];

export default function SourceLanguagesControl() {
  const { t, lang } = useI18n();
  const primary = (lang || "en").split("-")[0].toLowerCase();
  const [selected, setSelected] = useState<string[]>(() =>
    readAdditionalSourceLanguages(),
  );

  // Re-read if the value changes elsewhere (another tab).
  useEffect(() => {
    const refresh = () => setSelected(readAdditionalSourceLanguages());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const toggle = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    setSelected(next);
    writeAdditionalSourceLanguages(next);
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-source-languages"
    >
      <h2 className="settings-section-title">
        {t("settings.source_languages.title", "Additional source languages")}
      </h2>
      <p className="form-hint">
        {t(
          "settings.source_languages.hint",
          "Languages you also speak. Lessons written for these source languages appear in your main content list.",
        )}
      </p>
      <div className="settings-source-languages">
        {OFFERED.map((code) => {
          const isPrimary = code === primary;
          const checked = isPrimary || selected.includes(code);
          return (
            <label key={code} className="form-row form-row-toggle">
              <span className="form-label">
                {languageDisplayName(code, lang)}
                {isPrimary && (
                  <span className="form-hint">
                    {" "}
                    ({t("settings.source_languages.app_language", "app language")})
                  </span>
                )}
              </span>
              <input
                type="checkbox"
                data-testid={`settings-source-language-${code}`}
                checked={checked}
                disabled={isPrimary}
                onChange={() => toggle(code)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
