/**
 * useImportLanguagePair (#1799 — extracted from ImportDetail.tsx).
 *
 * v1.54.0 — language pair captured at IMPORT time. Source = the chat
 * language (what the learner speaks) defaults to the app language;
 * target = the language being learned, auto-detected from the chat
 * content. Both flow downstream (analysis -> save -> share) so
 * nothing is guessed/patched later. Initialised once per loaded
 * conversation; edits persist onto the import record best-effort.
 */

import { useEffect, useRef, useState } from "react";

import { getStorage } from "../../../storage";
import { detectLearningLanguage } from "../../../lib/content/language/detect-chat-language";
import type { ImportedConversationDetail } from "../../../types/domain";

/**
 * Own the import-time language pair incl. persistence.
 *
 * @example
 * const pair = useImportLanguagePair({detail, setDetail, lang});
 * <ImportLanguagePickers sourceLang={pair.sourceLang}
 *     onSourceChange={pair.changeSource} ... />
 */
export function useImportLanguagePair({
  detail,
  setDetail,
  lang,
}: {
  detail: ImportedConversationDetail | null;
  setDetail: (next: ImportedConversationDetail) => void;
  lang: string;
}) {
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const langInitRef = useRef<string | null>(null);

  // Initialise the language pair when the conversation loads: keep saved
  // values when present, else app-language source + detected target.
  useEffect(() => {
    if (!detail || langInitRef.current === detail.id) return;
    langInitRef.current = detail.id;
    const app = (lang || "en").split("-")[0];
    setSourceLang((detail.source_language || app).split("-")[0]);
    const savedTarget = detail.target_language
      ? detail.target_language.split("-")[0]
      : "";
    if (savedTarget) {
      setTargetLang(savedTarget);
    } else {
      const text = detail.messages.map((m) => m.content).join("\n");
      setTargetLang(detectLearningLanguage(text, app) ?? "");
    }
  }, [detail, lang]);

  // Persist the chosen languages onto the import record so every
  // downstream step (analysis, save-as-lesson, share) inherits them.
  // Best-effort: a failed write keeps the local selection usable.
  const persistLanguages = async (next: {
    source?: string;
    target?: string;
  }): Promise<void> => {
    if (!detail) return;
    const source_language = next.source ?? sourceLang;
    const target_language = next.target ?? targetLang;
    try {
      await getStorage().imports.update(detail.id, {
        source_language: source_language || null,
        target_language: target_language || null,
      });
      setDetail({ ...detail, source_language, target_language });
    } catch {
      /* non-fatal — keep the in-memory selection */
    }
  };

  const changeSource = (value: string) => {
    setSourceLang(value);
    void persistLanguages({ source: value });
  };
  const changeTarget = (value: string) => {
    setTargetLang(value);
    void persistLanguages({ target: value });
  };

  return { sourceLang, targetLang, changeSource, changeTarget };
}
