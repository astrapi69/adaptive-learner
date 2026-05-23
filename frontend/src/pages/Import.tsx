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

import {useEffect, useState, useRef} from "react";
import {useNavigate} from "react-router-dom";

import {ApiError} from "../api/client";
import HelpLink from "../components/help/HelpLink";
import {useButtonTooltips} from "../hooks/useButtonTooltips";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import {getDb} from "../storage/db";
import {analyzeConversation} from "../chat_import/analysis";
import {
    detectFormat,
    parseChatImport,
    type ChatImportSource,
    type NormalizedConversation,
} from "../chat_import";
import {notify} from "../utils/notify";
import type {AIProvider} from "../lib/constants";
import type {ImportedConversation} from "../types/domain";

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

export default function Import({onNavigate}: ImportPageProps = {}) {
    const {t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [pasteText, setPasteText] = useState("");
    const [pasteFormat, setPasteFormat] = useState<string>("unknown");
    const [conversations, setConversations] = useState<ImportedConversation[]>(
        [],
    );
    const [loadingList, setLoadingList] = useState(true);
    const [busy, setBusy] = useState(false);
    const [busyAction, setBusyAction] = useState<string>("");

    const go = (path: string) => (onNavigate ? onNavigate(path) : navigate(path));

    useEffect(() => {
        const {userId} = readLearnerState();
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
                            : t(
                                  "import.list_error",
                                  "Could not load imported conversations.",
                              );
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
        const {userId} = readLearnerState();
        if (!userId) {
            notify.error(
                t(
                    "import.no_user",
                    "Complete the onboarding before importing conversations.",
                ),
                {persistent: true},
            );
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
                const existingId =
                    typeof err.extra.existing_id === "string"
                        ? err.extra.existing_id
                        : null;
                if (existingId) {
                    notify.info(
                        t(
                            "import.duplicate_detected",
                            "This conversation was already imported. Showing the existing entry.",
                        ),
                    );
                    go(`/import/${existingId}`);
                    return null;
                }
            }
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t("import.save_error", "Could not save the conversation.");
            notify.error(msg, {persistent: true});
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
            !window.confirm(
                t(
                    "import.delete_confirm",
                    "Delete this imported conversation? This cannot be undone.",
                ),
            )
        ) {
            return;
        }
        try {
            await getStorage().imports.remove(conv.id);
            setConversations((prev) => prev.filter((c) => c.id !== conv.id));
            notify.success(
                t("import.delete_success", "Conversation deleted."),
            );
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t(
                          "import.delete_error",
                          "Could not delete the conversation.",
                      );
            notify.error(msg, {persistent: true});
        }
    }

    async function runAnalysisForConversation(
        conversationId: string,
        messages: NormalizedConversation["messages"],
        title: string,
    ): Promise<boolean> {
        const {userId} = readLearnerState();
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
            if ((result as {fallback_used?: boolean}).fallback_used) {
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
                // eslint-disable-next-line no-console
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
            providerInfo = {provider, apiKey, modelOverride};
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t(
                          "import.settings_error",
                          "Could not read AI settings.",
                      );
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
        });
        try {
            await getStorage().imports.saveAnalysis(conversationId, {
                analysis_result: result,
            });
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t(
                          "import.analysis_save_error",
                          "Could not save the analysis result.",
                      );
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
                notify.error(
                    t(
                        "import.parse_error",
                        "Could not recognise the input format.",
                    ),
                );
                return;
            }
            const first = parsed.conversations[0];
            const saved = await persistConversation(first);
            if (!saved) return;
            await runAnalysisForConversation(
                saved.id,
                first.messages,
                first.title,
            );
            setPasteText("");
            setPasteFormat("unknown");
            go(`/import/${saved.id}`);
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t("import.parse_error", "Could not parse the input.");
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
            const parsed = parseChatImport(text, {title: file.name});
            if (parsed.warnings.length > 0) {
                notify.warning(parsed.warnings.slice(0, 3).join(" "));
            }
            if (parsed.conversations.length === 0) {
                notify.error(
                    t(
                        "import.parse_error",
                        "Could not recognise the input format.",
                    ),
                );
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
                    t(
                        "import.file_imported_one",
                        "Conversation imported. Click Analyze on the detail page.",
                    ),
                );
                go(`/import/${saved[0].id}`);
            } else {
                notify.success(
                    t(
                        "import.file_imported_many",
                        `Imported ${saved.length} conversations.`,
                    ).replace("{count}", String(saved.length)),
                );
            }
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t("import.parse_error", "Could not parse the file.");
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
            <header style={{padding: "1.5rem", textAlign: "center"}}>
                <h1 style={{margin: 0}}>
                    {t("import.title", "Import a conversation")}
                    <HelpLink
                        glossaryKey="feature_conversation_analysis"
                        size={18}
                    />
                </h1>
                <p style={{margin: "0.5rem 0 0", opacity: 0.7}}>
                    {t(
                        "import.subtitle",
                        "Paste or upload a conversation with ChatGPT, Claude, or Gemini and get instant learning insights.",
                    )}
                </p>
            </header>

            <section
                style={{
                    maxWidth: 800,
                    margin: "0 auto 2rem",
                    padding: "1.5rem",
                    border: "2px solid var(--accent)",
                    borderRadius: 12,
                    background: "var(--surface)",
                }}
                data-testid="quick-paste"
            >
                <h2 style={{marginTop: 0}}>
                    {t("import.quick.title", "Quick Analysis")}
                </h2>
                <p style={{opacity: 0.7}}>
                    {t(
                        "import.quick.hint",
                        "Paste a conversation here. We will save it and analyze it in one step.",
                    )}
                </p>
                <textarea
                    value={pasteText}
                    onChange={(e) => onPasteChange(e.target.value)}
                    placeholder={t(
                        "import.quick.placeholder",
                        "Paste a ChatGPT, Claude, Gemini, or markdown conversation here…",
                    )}
                    rows={10}
                    style={{
                        width: "100%",
                        fontFamily: "inherit",
                        padding: "0.75rem",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        resize: "vertical",
                    }}
                    data-testid="quick-paste-textarea"
                    disabled={busy}
                />
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "0.75rem",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                    }}
                >
                    <small data-testid="quick-paste-format" style={{opacity: 0.6}}>
                        {pasteText.trim()
                            ? `${t("import.detected_format", "Detected format")}: ${pasteFormat}`
                            : ""}
                    </small>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={quickAnalyze}
                        disabled={!pasteText.trim() || busy}
                        data-testid="quick-analyze-button"
                    >
                        {busy && busyAction === "analyze"
                            ? t("import.analyzing", "Analyzing…")
                            : t("import.analyze", "Analyze")}
                    </button>
                </div>
            </section>

            <section
                style={{maxWidth: 800, margin: "0 auto 2rem", padding: "0 1.5rem"}}
                data-testid="file-upload"
            >
                <h3>{t("import.file.title", "Upload a file")}</h3>
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    style={{
                        border: "2px dashed var(--border)",
                        borderRadius: 8,
                        padding: "2rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "var(--surface)",
                    }}
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
                    <p style={{margin: 0, opacity: 0.7}}>
                        {t(
                            "import.file.hint",
                            "Drag a .json, .md, or .txt file here, or click to choose.",
                        )}
                    </p>
                    <p style={{margin: "0.5rem 0 0", fontSize: "0.85rem", opacity: 0.6}}>
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
                    style={{display: "none"}}
                    data-testid="file-input"
                />
            </section>

            <section
                style={{maxWidth: 800, margin: "0 auto 3rem", padding: "0 1.5rem"}}
                data-testid="imports-list"
            >
                <h3>
                    {t("import.list.title", "Your imported conversations")} (
                    {conversations.length})
                </h3>
                {loadingList ? (
                    <p style={{opacity: 0.6}}>
                        {t("common.loading", "Loading…")}
                    </p>
                ) : conversations.length === 0 ? (
                    <p style={{opacity: 0.6}} data-testid="imports-empty">
                        {t(
                            "import.list.empty",
                            "No conversations yet. Use Quick Analysis or upload a file.",
                        )}
                    </p>
                ) : (
                    <ul style={{listStyle: "none", padding: 0, margin: 0}}>
                        {conversations.map((c) => (
                            <li
                                key={c.id}
                                data-testid={`import-row-${c.id}`}
                                style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: 6,
                                    padding: "0.75rem 1rem",
                                    marginBottom: "0.5rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    background: "var(--surface)",
                                }}
                                onClick={() => go(`/import/${c.id}`)}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{fontSize: "1.5rem"}}
                                >
                                    {SOURCE_ICONS[c.source] ?? "📄"}
                                </span>
                                <div style={{flex: 1, minWidth: 0}}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {c.title}
                                    </div>
                                    <small style={{opacity: 0.6}}>
                                        {c.source} · {c.message_count}{" "}
                                        {t("import.messages", "messages")} ·{" "}
                                        {new Date(c.imported_at).toLocaleDateString()}
                                    </small>
                                </div>
                                {c.analyzed && (
                                    <span
                                        data-testid={`analyzed-badge-${c.id}`}
                                        style={{
                                            background: "var(--accent)",
                                            color: "white",
                                            padding: "0.15rem 0.5rem",
                                            borderRadius: 3,
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        {t("import.analyzed", "Analyzed")}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={(e) => handleDelete(e, c)}
                                    data-testid={`import-delete-${c.id}`}
                                    aria-label={t(
                                        "import.delete_aria",
                                        "Delete this conversation",
                                    )}
                                    title={
                                        tooltipsOn
                                            ? t(
                                                  "import.delete_aria",
                                                  "Delete this conversation",
                                              )
                                            : undefined
                                    }
                                    style={{
                                        padding: "0.15rem 0.5rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    {t("import.delete", "Delete")}
                                </button>
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
async function readDexieApiKey(
    userId: string,
    provider: AIProvider,
): Promise<string | null> {
    try {
        const db = getDb();
        const row = await db.userSettings
            .where("user_id")
            .equals(userId)
            .first();
        if (!row) return null;
        if (provider === "anthropic") return row.api_key_anthropic ?? null;
        if (provider === "openai") return row.api_key_openai ?? null;
        if (provider === "gemini") return row.api_key_gemini ?? null;
        return null;
    } catch {
        return null;
    }
}
