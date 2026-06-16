import {useEffect, useRef, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Bug, Check, ChevronDown, ChevronUp, Copy, Download} from "lucide-react";

import {Button} from "@/components/ui/button";
import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {copyToClipboard} from "../utils/clipboard";
import {downloadBlob} from "../lib/lesson/result-download";
import {
    eventRecorder,
    formatEventLog,
    type EventCategory,
} from "../utils/eventRecorder";
import {
    buildEventReportJson,
    eventReportFilename,
    filterByCategory,
    latestAppState,
    presentCategories,
} from "../utils/event-report";

const ISSUES_URL = "https://github.com/astrapi69/adaptive-learner/issues/new";
// GitHub rejects URLs over ~8192 chars. After encoding, special
// chars (spaces, umlauts, markdown) expand 3x, so the raw body
// limit is ~2500.
const MAX_ENCODED_URL = 7800;

interface Props {
    open: boolean;
    onClose: () => void;
    errorMessage: string;
    apiError?: ApiError;
    /**
     * Opened from the proactive Settings entry (EVT-04) rather than
     * an error toast — adjusts the intro copy from "we caught an
     * error" to "send us what happened".
     */
    proactive?: boolean;
}

/**
 * Modal that lets the user review and submit a GitHub issue with
 * optional action history. The user sees exactly what will be
 * sent before clicking the submit button. Three opt-in toggles:
 * environment info (version + browser + OS + route), action
 * history (the in-memory ring buffer formatted as text), and the
 * full preview itself. The action history can be filtered by
 * coarse category (EVT-01) and exported as JSON (EVT-05).
 */
export default function ErrorReportDialog({
    open,
    onClose,
    errorMessage,
    apiError,
    proactive = false,
}: Props) {
    const {t} = useI18n();
    const [includeEnv, setIncludeEnv] = useState(true);
    const [includeHistory, setIncludeHistory] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [description, setDescription] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(
        null,
    );
    const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">(
        "idle",
    );
    const copyTimerRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (copyTimerRef.current !== null) {
                window.clearTimeout(copyTimerRef.current);
            }
        },
        [],
    );

    const events = eventRecorder.getAll();
    const filteredEvents = filterByCategory(events, categoryFilter);
    const historyLog = formatEventLog(filteredEvents);
    const snapshot = latestAppState(events);
    const categories = presentCategories(events);

    const issueBody = buildIssueBody(
        errorMessage,
        apiError,
        includeEnv,
        includeHistory ? historyLog : null,
        description,
    );
    const issueTitle = proactive
        ? `Report: ${(description || errorMessage).substring(0, 80)}`
        : `Bug: ${errorMessage.substring(0, 80)}`;

    const handleDownloadJson = () => {
        const json = buildEventReportJson({
            events: includeHistory ? filteredEvents : [],
            description,
            errorMessage: proactive ? undefined : errorMessage,
            appVersion: __APP_VERSION__,
        });
        downloadBlob(json, eventReportFilename(), "application/json");
    };

    const handleCopyPreview = async () => {
        const ok = await copyToClipboard(issueBody);
        setCopyState(ok ? "ok" : "fail");
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
            setCopyState("idle");
            copyTimerRef.current = null;
        }, 1500);
    };

    const handleSubmit = () => {
        const encodedTitle = encodeURIComponent(issueTitle);
        // GitHub rejects URLs over ~8192 chars. encodeURIComponent
        // expands umlauts / spaces / markdown ~3x, so we must
        // check the ENCODED length and trim the raw body until it
        // fits.
        let body = issueBody;
        const baseLen =
            ISSUES_URL.length +
            "?title=".length +
            encodedTitle.length +
            "&body=".length +
            "&labels=bug".length;
        while (
            baseLen + encodeURIComponent(body).length > MAX_ENCODED_URL &&
            body.length > 200
        ) {
            // Drop the last 20% and add a truncation note.
            body = body.substring(0, Math.floor(body.length * 0.8));
            body += `\n\n*(${t("ui.error_report.truncated", "Report truncated to fit GitHub's URL length limit.")})*`;
        }
        const url = `${ISSUES_URL}?title=${encodedTitle}&body=${encodeURIComponent(body)}&labels=bug`;
        window.open(url, "_blank");
        onClose();
    };

    const cardStyle: React.CSSProperties = {
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        boxShadow: "var(--shadow-elevated)",
        maxWidth: "44rem",
        width: "100%",
        maxHeight: "85vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    };
    const overlayStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
    };
    const previewBoxStyle: React.CSSProperties = {
        maxHeight: 200,
        overflowY: "auto",
        padding: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
    };

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content
                    style={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1001,
                        ...cardStyle,
                    }}
                    data-testid="error-report-dialog"
                    aria-describedby="error-report-description"
                >
                    <Dialog.Title
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: 0,
                            fontSize: "1.125rem",
                            fontWeight: 600,
                        }}
                    >
                        <Bug size={18} />
                        {t("ui.error_report.dialog_title", "Report an issue")}
                    </Dialog.Title>

                    <Dialog.Description
                        id="error-report-description"
                        style={{
                            fontSize: "0.875rem",
                            color: "var(--fg-muted)",
                            margin: 0,
                        }}
                    >
                        {proactive
                            ? t(
                                  "ui.error_report.intro_proactive",
                                  "Prepare a report of your recent actions to send to the developer. You see exactly what it contains before anything leaves your browser.",
                              )
                            : t(
                                  "ui.error_report.intro",
                                  "Adaptive Learner caught an error and can prepare a bug report for the developer.",
                              )}
                    </Dialog.Description>

                    {snapshot && (
                        <p
                            data-testid="error-report-snapshot"
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--fg-muted)",
                                margin: 0,
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {t("ui.error_report.app_state", "App state")}:{" "}
                            {snapshot.storageMode} · {snapshot.language} ·{" "}
                            {snapshot.online
                                ? t("ui.error_report.online", "online")
                                : t("ui.error_report.offline", "offline")}
                        </p>
                    )}

                    <label
                        htmlFor="error-report-description"
                        style={{
                            display: "block",
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                        }}
                    >
                        {t(
                            "ui.error_report.description_label",
                            "Steps to reproduce (optional)",
                        )}
                    </label>
                    <textarea
                        id="error-report-description"
                        data-testid="error-report-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t(
                            "ui.error_report.description_placeholder",
                            "Briefly describe what you were doing when the error appeared. Leave blank to skip.",
                        )}
                        style={{
                            width: "100%",
                            padding: "var(--space-2)",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-strong)",
                            fontFamily: "inherit",
                            fontSize: "0.8125rem",
                            resize: "vertical",
                        }}
                    />

                    {/* Checkboxes */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: "0.875rem",
                                cursor: "not-allowed",
                            }}
                        >
                            <input type="checkbox" checked disabled />
                            {t(
                                "ui.error_report.include_error",
                                "Error message and stacktrace",
                            )}
                        </label>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: "0.875rem",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={includeEnv}
                                onChange={(e) =>
                                    setIncludeEnv(e.target.checked)
                                }
                                data-testid="error-report-include-env"
                            />
                            {t(
                                "ui.error_report.include_environment",
                                "Environment info (version, browser, OS)",
                            )}
                        </label>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: "0.875rem",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={includeHistory}
                                onChange={(e) =>
                                    setIncludeHistory(e.target.checked)
                                }
                                data-testid="error-report-include-history"
                            />
                            {t(
                                "ui.error_report.include_history",
                                "Action history",
                            )}{" "}
                            ({events.length})
                            {events.length > 0 && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                        setShowHistory(!showHistory)
                                    }
                                    style={{
                                        marginLeft: 4,
                                        padding: "1px 6px",
                                        fontSize: "0.75rem",
                                        gap: 2,
                                    }}
                                >
                                    {showHistory ? (
                                        <ChevronUp size={12} />
                                    ) : (
                                        <ChevronDown size={12} />
                                    )}
                                    {t(
                                        "ui.error_report.view",
                                        "View",
                                    )}
                                </Button>
                            )}
                        </label>
                    </div>

                    {/* Category filter (EVT-01) */}
                    {showHistory && categories.length > 1 && (
                        <div
                            data-testid="error-report-category-filter"
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                            }}
                        >
                            <CategoryChip
                                active={categoryFilter === null}
                                onClick={() => setCategoryFilter(null)}
                                label={t("ui.error_report.category_all", "All")}
                                testId="error-report-category-all"
                            />
                            {categories.map((cat) => (
                                <CategoryChip
                                    key={cat}
                                    active={categoryFilter === cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    label={t(
                                        `ui.error_report.category.${cat}`,
                                        cat,
                                    )}
                                    testId={`error-report-category-${cat}`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Action history preview */}
                    {showHistory && events.length > 0 && (
                        <div
                            style={previewBoxStyle}
                            data-testid="error-report-history-preview"
                        >
                            {historyLog ||
                                t(
                                    "ui.error_report.no_events_in_category",
                                    "No events in this category.",
                                )}
                        </div>
                    )}

                    {/* Privacy note */}
                    <p
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--fg-muted)",
                            margin: 0,
                        }}
                    >
                        {t(
                            "ui.error_report.privacy_note",
                            "No project content, no passwords, no API keys are ever sent.",
                        )}
                    </p>

                    {/* Full preview toggle */}
                    {showPreview && (
                        <div
                            style={{...previewBoxStyle, maxHeight: 300}}
                            data-testid="error-report-full-preview"
                        >
                            {issueBody}
                        </div>
                    )}

                    {/* Footer */}
                    <div
                        style={{
                            display: "flex",
                            gap: "var(--space-2)",
                            flexWrap: "wrap",
                            marginTop: "var(--space-2)",
                        }}
                    >
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowPreview(!showPreview)}
                            data-testid="error-report-toggle-preview"
                        >
                            {showPreview
                                ? t(
                                      "ui.error_report.hide_preview",
                                      "Hide preview",
                                  )
                                : t(
                                      "ui.error_report.preview",
                                      "Show preview",
                                  )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCopyPreview}
                            data-testid="error-report-copy-preview"
                            style={{gap: 4}}
                        >
                            {copyState === "ok" ? (
                                <Check size={14} />
                            ) : (
                                <Copy size={14} />
                            )}
                            {copyState === "ok"
                                ? t("ui.error_report.copied", "Copied!")
                                : copyState === "fail"
                                  ? t(
                                        "ui.error_report.copy_failed",
                                        "Copy failed",
                                    )
                                  : t(
                                        "ui.error_report.copy_preview",
                                        "Copy preview",
                                    )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleDownloadJson}
                            data-testid="error-report-download-json"
                            style={{gap: 4}}
                        >
                            <Download size={14} />
                            {t(
                                "ui.error_report.download_json",
                                "Download JSON",
                            )}
                        </Button>
                        <div style={{flexGrow: 1}} />
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            data-testid="error-report-close"
                        >
                            {t("ui.error_report.close", "Close")}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            data-testid="error-report-submit"
                            style={{gap: 4}}
                        >
                            <Bug size={14} />
                            {t(
                                "ui.error_report.open_github",
                                "Open on GitHub",
                            )}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// ---------------------------------------------------------------------------
// Issue body builder
// ---------------------------------------------------------------------------

function buildIssueBody(
    message: string,
    apiError: ApiError | undefined,
    includeEnv: boolean,
    historyLog: string | null,
    description?: string,
): string {
    const sections: string[] = [];

    sections.push(`## Error description\n${message}`);

    if (apiError) {
        const tech = [
            `- HTTP Status: ${apiError.status}`,
            `- Endpoint: ${apiError.method ?? "?"} ${apiError.endpoint ?? "?"}`,
            `- Timestamp: ${apiError.timestamp ?? new Date().toISOString()}`,
        ];
        if (apiError.stacktrace) {
            tech.push(
                `\n\`\`\`\n${apiError.stacktrace.substring(0, 800)}\n\`\`\``,
            );
        }
        sections.push(`## Technical details\n${tech.join("\n")}`);
    }

    if (includeEnv) {
        const env = [
            `- Adaptive Learner version: ${__APP_VERSION__}`,
            `- Browser: ${navigator.userAgent.split(" ").slice(-3).join(" ")}`,
            `- OS: ${navigator.platform}`,
            `- Route: ${window.location.pathname}`,
        ];
        sections.push(`## Environment\n${env.join("\n")}`);
    }

    if (historyLog) {
        sections.push(`## Action history\n\`\`\`\n${historyLog}\n\`\`\``);
    }

    const steps = description?.trim();
    sections.push(steps ? `## Reproduction\n${steps}` : "## Reproduction\n1.\n2.\n3.");

    sections.push(
        "---\n*This report was prepared automatically by Adaptive Learner. No sensitive data has been included.*",
    );

    return sections.join("\n\n");
}

/** One toggle chip in the category filter row (EVT-01). */
function CategoryChip({
    active,
    onClick,
    label,
    testId,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    testId: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            aria-pressed={active}
            style={{
                padding: "2px 8px",
                fontSize: "0.6875rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: active ? "var(--accent)" : "var(--surface-2)",
                color: active ? "var(--accent-fg)" : "var(--fg-primary)",
            }}
        >
            {label}
        </button>
    );
}
