/**
 * Import page (v0.9.0 / Phase 12B + 12F).
 *
 * Three input modes:
 *   1. Quick-paste — large textarea + "Analyze" button. The
 *      primary UX surface: 80% of users will land here, paste
 *      a conversation, and click Analyze.
 *   2. File upload — drag-and-drop / file-picker for ChatGPT,
 *      Claude, Markdown, or generic JSON exports.
 *   3. Existing imports — list of previously imported
 *      conversations with source icon + analyzed badge.
 *
 * Quick-paste persists the imported conversation, runs the AI
 * analysis call against the active provider, then navigates to
 * the detail page with the results visible.
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../api/client";
import { Button } from "@/components/ui/button";
import ApiKeyRequiredNotice from "../../components/ApiKeyRequiredNotice";
import { FEATURES } from "../../features/featureConfig";
import { useFeatureAvailable } from "../../features/useFeatureAvailable";
import HelpLink from "../../components/help/HelpLink";
import { useButtonTooltips } from "../../hooks/settings/useButtonTooltips";
import { useI18n } from "../../hooks/ui/useI18n";
import { useConfirm } from "../../contexts/ConfirmContext";
import { readLearnerState } from "../../lib/learnerState";
import { getStorage } from "../../storage";
import { getDb } from "../../storage/dexie/db";
import { analyzeConversation } from "../../chat_import/analysis";
import {
  detectFormat,
  parseChatImport,
  type ChatImportSource,
  type NormalizedConversation,
} from "../../chat_import";
import { notify } from "../../utils/notify";
import type { AIProvider } from "../../lib/constants";
import type { ImportedConversation } from "../../types/domain";

const SOURCE_ICONS: Record<ChatImportSource, string> = {
  chatgpt: "🤖",
  claude: "🟣",
  gemini: "✨",
  manual: "✍",
  unknown: "📄",
};

interface ImportPageProps {
  /** Override the navigation hook (tests only). */
  onNavigate?: (path: string) => void;
}

export default function Import({ onNavigate }: ImportPageProps = {}) {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const tooltipsOn = useButtonTooltips();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Gate the AI analysis the same way ImportDetail does (#911): in Dexie mode
  // without a key the feature is disabled, so the button is disabled with a
  // reason instead of letting the click fail.
  const analyze = useFeatureAvailable(FEATURES.CONVERSATION_ANALYZE);

  const [pasteText, setPasteText] = useState("");
  const [pasteFormat, setPasteFormat] = useState<string>("unknown");
  const [conversations, setConversations] = useState<ImportedConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string>("");

  const go = (path: string) => (onNavigate ? onNavigate(path) : navigate(path));

  useEffect(() => {
    const { userId } = readLearnerState();
    if (!userId) {
      setLoadingList(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getStorage().imports.list(userId);
        if (!cancelled) setConversations(list);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.detail
              : t("import.list_error", "Could not load imported conversations.");
          notify.error(msg);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  function onPasteChange(value: string) {
    setPasteText(value);
    if (value.trim()) {
      setPasteFormat(detectFormat(value));
    } else {
      setPasteFormat("unknown");
    }
  }

  async function persistConversation(
    convo: NormalizedConversation,
  ): Promise<ImportedConversation | null> {
    const { userId } = readLearnerState();
    if (!userId) {
      notify.error(t("import.no_user", "Complete the onboarding before importing conversations."), {
        persistent: true,
      });
      go("/onboarding");
      return null;
    }
    try {
      const saved = await getStorage().imports.create(userId, {
        source: convo.source,
        title: convo.title,
        model: convo.metadata.model ?? null,
        source_created_at: convo.metadata.created_at ?? null,
        messages: convo.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ?? null,
        })),
      });
      setConversations((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      // Phase 36 Bug 1 — 409 means the same transcript was
      // already imported by this user. Navigate the user to
      // the existing record instead of leaving them stranded
      // with a generic save error.
      if (err instanceof ApiError && err.isConflict) {
        const existingId = typeof err.extra.existing_id === "string" ? err.extra.existing_id : null;
        if (existingId) {
          notify.info(
            t(
              "import.duplicate_detected",
              "This conversation was already imported. Showing the existing entry.",
            ),
          );
          go(`/content/import/${existingId}`);
          return null;
        }
      }
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.save_error", "Could not save the conversation.");
      notify.error(msg, { persistent: true });
      return null;
    }
  }

  async function handleDelete(
    e: React.MouseEvent<HTMLButtonElement>,
    conv: ImportedConversation,
  ): Promise<void> {
    // Don't bubble — the row's own onClick navigates to detail.
    e.stopPropagation();
    if (
      !(await confirm({
        message: t(
          "import.delete_confirm",
          "Delete this imported conversation? This cannot be undone.",
        ),
        confirmLabel: t("common.delete", "Delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    try {
      await getStorage().imports.remove(conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      notify.success(t("import.delete_success", "Conversation deleted."));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.delete_error", "Could not delete the conversation.");
      notify.error(msg, { persistent: true });
    }
  }

  async function runAnalysisForConversation(
    conversationId: string,
    messages: NormalizedConversation["messages"],
    title: string,
  ): Promise<boolean> {
    const { userId } = readLearnerState();
    if (!userId) return false;
    const storage = getStorage();
    // API mode dispatches the AI call server-side so the
    // cleartext key never leaves the backend. Dexie mode runs
    // browser-direct because the key lives in the local row.
    if (storage.mode === "api") {
      return runAnalysisApiMode(conversationId);
    }
    return runAnalysisDexieMode(conversationId, userId, messages, title);
  }

  async function runAnalysisApiMode(conversationId: string): Promise<boolean> {
    try {
      const detail = await getStorage().imports.analyze(conversationId);
      const result = detail.analysis_result ?? {};
      if ((result as { fallback_used?: boolean }).fallback_used) {
        notify.warning(
          t(
            "import.analysis_fallback",
            "Analysis ran but the AI response could not be parsed cleanly.",
          ),
        );
      } else {
        notify.success(t("import.analysis_ready", "Analysis ready."));
      }
      // v1.16.0 / Phase 29A — flat 75 XP for a successful
      // import + analysis. Non-fatal on error.
      try {
        const learner = readLearnerState();
        if (learner.userId) {
          await getStorage().gamification.awardImport(learner.userId);
        }
      } catch (xpErr) {
        console.warn("XP awardImport failed", xpErr);
      }
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.analysis_error", "Could not analyze the conversation.");
      notify.error(msg);
      return false;
    }
  }

  async function runAnalysisDexieMode(
    conversationId: string,
    userId: string,
    messages: NormalizedConversation["messages"],
    title: string,
  ): Promise<boolean> {
    let providerInfo: {
      provider: AIProvider;
      apiKey: string;
      modelOverride: string | null;
    };
    try {
      const settings = await getStorage().settings.get(userId);
      const provider = settings.active_provider as AIProvider;
      const apiKey = await readDexieApiKey(userId, provider);
      if (!apiKey) {
        notify.warning(
          t(
            "import.no_api_key",
            "Set an API key for the active AI provider in Settings to enable analysis.",
          ),
        );
        return false;
      }
      const modelOverride =
        provider === "anthropic"
          ? settings.model_override_anthropic
          : provider === "openai"
            ? settings.model_override_openai
            : settings.model_override_gemini;
      providerInfo = { provider, apiKey, modelOverride };
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.settings_error", "Could not read AI settings.");
      notify.error(msg);
      return false;
    }

    const result = await analyzeConversation({
      provider: providerInfo.provider,
      apiKey: providerInfo.apiKey,
      modelOverride: providerInfo.modelOverride,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      title,
      // #803 — emit the analysis in the active UI display language
      // (previously omitted, so it always defaulted to English).
      lang: lang || readLearnerState().language || "en",
    });
    try {
      await getStorage().imports.saveAnalysis(conversationId, {
        analysis_result: result,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.analysis_save_error", "Could not save the analysis result.");
      notify.error(msg);
      return false;
    }
    if (result.fallback_used) {
      notify.warning(
        t(
          "import.analysis_fallback",
          "Analysis ran but the AI response could not be parsed cleanly.",
        ),
      );
    } else {
      notify.success(t("import.analysis_ready", "Analysis ready."));
    }
    return true;
  }

  async function quickAnalyze() {
    if (!pasteText.trim() || busy) return;
    setBusy(true);
    setBusyAction("analyze");
    try {
      const parsed = parseChatImport(pasteText);
      if (parsed.warnings.length > 0) {
        notify.warning(parsed.warnings.slice(0, 3).join(" "));
      }
      if (parsed.conversations.length === 0) {
        notify.error(t("import.parse_error", "Could not recognise the input format."));
        return;
      }
      const first = parsed.conversations[0];
      const saved = await persistConversation(first);
      if (!saved) return;
      await runAnalysisForConversation(saved.id, first.messages, first.title);
      setPasteText("");
      setPasteFormat("unknown");
      go(`/content/import/${saved.id}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("import.parse_error", "Could not parse the input.");
      notify.error(msg);
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    setBusyAction("file");
    try {
      const text = await file.text();
      const parsed = parseChatImport(text, { title: file.name });
      if (parsed.warnings.length > 0) {
        notify.warning(parsed.warnings.slice(0, 3).join(" "));
      }
      if (parsed.conversations.length === 0) {
        notify.error(t("import.parse_error", "Could not recognise the input format."));
        return;
      }
      const saved: ImportedConversation[] = [];
      for (const convo of parsed.conversations) {
        const persisted = await persistConversation(convo);
        if (persisted) saved.push(persisted);
      }
      if (saved.length === 0) return;
      if (saved.length === 1) {
        notify.success(
          t("import.file_imported_one", "Conversation imported. Click Analyze on the detail page."),
        );
        go(`/content/import/${saved[0].id}`);
      } else {
        notify.success(
          t("import.file_imported_many", `Imported ${saved.length} conversations.`).replace(
            "{count}",
            String(saved.length),
          ),
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("import.parse_error", "Could not parse the file.");
      notify.error(msg);
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <main id="main" className="page-import" data-testid="page-import">
      <header className="p-6 text-center">
        <h1 className="m-0">
          {t("import.title", "Import a conversation")}
          <HelpLink glossaryKey="feature_conversation_analysis" size={18} />
        </h1>
        <p className="mt-2 mb-0 text-fg-muted">
          {t(
            "import.subtitle",
            "Paste or upload a conversation with ChatGPT, Claude, or Gemini and get instant learning insights.",
          )}
        </p>
      </header>

      <section
        className="max-w-3xl mx-auto mb-8 p-6 border-2 border-accent rounded-xl bg-card"
        data-testid="quick-paste"
      >
        <h2 className="mt-0">{t("import.quick.title", "Quick Analysis")}</h2>
        <p className="text-fg-muted">
          {t(
            "import.quick.hint",
            "Paste a conversation here. We will save it and analyze it in one step.",
          )}
        </p>
        {!analyze.available && (
          <ApiKeyRequiredNotice
            feature={t("ui.api_key.feature_analyze", "to analyze conversations")}
            settingsHref="/settings?tab=integrations"
          />
        )}
        <textarea
          value={pasteText}
          onChange={(e) => onPasteChange(e.target.value)}
          placeholder={t(
            "import.quick.placeholder",
            "Paste a ChatGPT, Claude, Gemini, or markdown conversation here…",
          )}
          rows={10}
          className="w-full resize-y p-3"
          data-testid="quick-paste-textarea"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <small data-testid="quick-paste-format" className="text-fg-muted">
            {pasteText.trim()
              ? `${t("import.detected_format", "Detected format")}: ${pasteFormat}`
              : ""}
          </small>
          <Button
            type="button"
            onClick={quickAnalyze}
            disabled={!pasteText.trim() || busy || !analyze.available}
            title={analyze.tooltip}
            data-testid="quick-analyze-button"
          >
            {busy && busyAction === "analyze"
              ? t("import.analyzing", "Analyzing…")
              : t("import.analyze", "Analyze")}
          </Button>
        </div>
      </section>

      <section className="max-w-3xl mx-auto mb-8 px-6" data-testid="file-upload">
        <h3>{t("import.file.title", "Upload a file")}</h3>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer bg-card"
          role="button"
          tabIndex={0}
          data-testid="file-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <p className="m-0 text-fg-muted">
            {t("import.file.hint", "Drag a .json, .md, or .txt file here, or click to choose.")}
          </p>
          <p className="mt-2 mb-0 text-sm text-fg-muted">
            {t(
              "import.file.formats",
              "ChatGPT conversations.json · Claude export · Markdown · Generic JSON",
            )}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.txt,application/json,text/markdown,text/plain"
          onChange={onFileChange}
          className="hidden"
          data-testid="file-input"
        />
      </section>

      <section className="max-w-3xl mx-auto mb-12 px-6" data-testid="imports-list">
        <h3>
          {t("import.list.title", "Your imported conversations")} ({conversations.length})
        </h3>
        {loadingList ? (
          <p className="text-fg-muted">{t("common.loading", "Loading…")}</p>
        ) : conversations.length === 0 ? (
          <p className="text-fg-muted" data-testid="imports-empty">
            {t("import.list.empty", "No conversations yet. Use Quick Analysis or upload a file.")}
          </p>
        ) : (
          <ul className="list-none p-0 m-0">
            {conversations.map((c) => (
              <li
                key={c.id}
                data-testid={`import-row-${c.id}`}
                className="flex items-center gap-3 border border-border rounded-app px-4 py-3 mb-2 cursor-pointer bg-card"
                onClick={() => go(`/content/import/${c.id}`)}
              >
                <span aria-hidden="true" className="text-2xl">
                  {SOURCE_ICONS[c.source] ?? "📄"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {c.title}
                  </div>
                  <small className="text-fg-muted">
                    {c.source} · {c.message_count} {t("import.messages", "messages")} ·{" "}
                    {new Date(c.imported_at).toLocaleDateString()}
                  </small>
                </div>
                {c.analyzed && (
                  <span
                    data-testid={`analyzed-badge-${c.id}`}
                    className="bg-accent text-accent-foreground px-2 py-0.5 rounded-sm text-xs"
                  >
                    {t("import.analyzed", "Analyzed")}
                  </span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => handleDelete(e, c)}
                  data-testid={`import-delete-${c.id}`}
                  aria-label={t("import.delete_aria", "Delete this conversation")}
                  title={
                    tooltipsOn ? t("import.delete_aria", "Delete this conversation") : undefined
                  }
                >
                  {t("import.delete", "Delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * Read the cleartext API key for the given provider from Dexie's
 * local userSettings row. Dexie-mode-only: in API mode the
 * cleartext never leaves the backend (encrypted at rest under
 * ``UserSettings.api_key_*``), so calling this helper there
 * always returns ``null`` — that's the bug the v1.5.x backend
 * ``/analyze`` route exists to fix. Callers must branch on
 * ``storage.mode`` BEFORE invoking this helper.
 */
async function readDexieApiKey(userId: string, provider: AIProvider): Promise<string | null> {
  try {
    const db = getDb();
    const row = await db.userSettings.where("user_id").equals(userId).first();
    if (!row) return null;
    if (provider === "anthropic") return row.api_key_anthropic ?? null;
    if (provider === "openai") return row.api_key_openai ?? null;
    if (provider === "gemini") return row.api_key_gemini ?? null;
    return null;
  } catch {
    return null;
  }
}
