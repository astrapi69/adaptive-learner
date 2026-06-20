/**
 * Export Section (Phase 16D).
 *
 * Settings-page slot offering three export entry points:
 *
 *   - Progress Report (full learning journey for the active user)
 *   - Session Detail (pick one from the recent-sessions dropdown)
 *   - Curriculum Overview (pick one from the user's curricula)
 *
 * Each entry point exposes Markdown + PDF buttons. Markdown
 * downloads via the standard Blob + createObjectURL pattern (see
 * ``BackupSection.tsx``). PDF opens the browser print dialog so
 * the user picks "Save as PDF" — zero external dependency.
 */

import {useEffect, useMemo, useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../hooks/ui/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {
    exportFilename,
    renderMarkdown,
} from "../lib/export/markdown-renderer";
import {openPrintWindow} from "../lib/export/pdf-generator";
import {filterStandardProjects} from "../lib/learning-project";
import {getStorage} from "../storage";
import type {
    CurriculumOverview,
    ProgressReport,
    SessionDetail,
} from "../storage/backup/export-builder";
import {notify} from "../utils/notify";
import type {Curriculum, LearningSession} from "../types/domain";

type ExportType = "progress" | "session" | "curriculum";
type ExportFormat = "md" | "pdf";

function downloadMarkdown(content: string, filename: string): void {
    const blob = new Blob([content], {type: "text/markdown;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function shortPreview(md: string, lines = 20): string {
    return md.split("\n").slice(0, lines).join("\n");
}

export default function ExportSection() {
    const {t, lang} = useI18n();
    const storage = getStorage();
    const {userId} = readLearnerState();

    const [busy, setBusy] = useState<string | null>(null);
    const [sessions, setSessions] = useState<LearningSession[]>([]);
    const [curricula, setCurricula] = useState<Curriculum[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedCurriculum, setSelectedCurriculum] = useState<string>("");
    const [preview, setPreview] = useState<{type: ExportType; markdown: string} | null>(
        null,
    );

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const load = async (): Promise<void> => {
            try {
                const rawProjects = await storage.users.projects.list(userId);
                if (cancelled) return;
                // v1.31.0 / Phase 46F.3: skip the auto-managed
                // "Content Lessons" pseudo-project — exporting
                // a pseudo-project's session list to the export
                // surface would surface lessons under a fake
                // project topic.
                const projects = filterStandardProjects(rawProjects);
                // Aggregate recent sessions across all projects.
                const sessionLists = await Promise.all(
                    projects.map(async (p) => {
                        try {
                            const summary = await storage.tracking.progress(p.id);
                            return (summary.tracking?.recent_sessions ?? []).map(
                                (s) => ({
                                    ...s,
                                    project_id: p.id,
                                    project_topic: p.topic,
                                }),
                            );
                        } catch {
                            return [];
                        }
                    }),
                );
                const allSessions = sessionLists
                    .flat()
                    .sort((a, b) =>
                        (b.committed_at ?? "").localeCompare(a.committed_at ?? ""),
                    )
                    .slice(0, 20);
                if (cancelled) return;
                setSessions(
                    allSessions.map((s) => ({
                        // #209 — recent_sessions ``id`` is the ProgressCommit
                        // id; the export builder loads by LearningSession id,
                        // so target ``session_id`` (fall back to id for an
                        // older backend that doesn't send it yet).
                        id: s.session_id ?? s.id,
                        project_id: s.project_id,
                        method: s.method,
                        started_at: s.committed_at,
                        ended_at: null,
                        cycle_step: 0,
                        status: "completed",
                    })) as unknown as LearningSession[],
                );
                const cs = await storage.curricula.list(userId);
                if (cancelled) return;
                setCurricula(cs);
            } catch (err) {
                if (cancelled) return;
                const detail = err instanceof Error ? err.message : String(err);
                notify.error(
                    t("export.load_error", "Could not load export data: {{detail}}")
                        .replace("{{detail}}", detail),
                );
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [storage, t, userId]);

    const recentSessionsForSelect = useMemo(() => sessions, [sessions]);

    if (!userId) {
        return null;
    }

    async function performExport(
        type: ExportType,
        format: ExportFormat,
    ): Promise<void> {
        if (!userId) return;
        if (type === "session" && !selectedSession) {
            notify.error(t("export.pick_session", "Pick a session first."));
            return;
        }
        if (type === "curriculum" && !selectedCurriculum) {
            notify.error(
                t("export.pick_curriculum", "Pick a curriculum first."),
            );
            return;
        }
        const busyKey = `${type}-${format}`;
        setBusy(busyKey);
        try {
            const payload = await buildPayload(type);
            const markdown = renderMarkdown(payload);
            const title = previewTitle(type, payload);
            if (format === "md") {
                downloadMarkdown(markdown, exportFilename(payload, "md"));
                notify.success(
                    t("export.download_success", "Export downloaded."),
                );
            } else {
                await openPrintWindow(markdown, title);
                notify.success(
                    t(
                        "export.print_opened",
                        "Print dialog opened. Pick 'Save as PDF'.",
                    ),
                );
            }
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("export.error", "Export failed: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    async function buildPayload(
        type: ExportType,
    ): Promise<ProgressReport | SessionDetail | CurriculumOverview> {
        switch (type) {
            case "progress":
                return await storage.export.progress(userId as string, lang);
            case "session":
                return await storage.export.session(selectedSession, lang);
            case "curriculum":
                return await storage.export.curriculum(
                    selectedCurriculum,
                    lang,
                );
        }
    }

    function previewTitle(
        type: ExportType,
        payload: ProgressReport | SessionDetail | CurriculumOverview,
    ): string {
        if (payload.type === "progress_report") {
            return t("export.title_progress", "Learning Progress");
        }
        if (payload.type === "session_detail") {
            return t("export.title_session", "Session Detail");
        }
        return `${t("export.title_curriculum", "Curriculum")}: ${payload.curriculum.title}`;
    }

    async function showPreview(type: ExportType): Promise<void> {
        if (!userId) return;
        if (type === "session" && !selectedSession) return;
        if (type === "curriculum" && !selectedCurriculum) return;
        setBusy(`${type}-preview`);
        try {
            const payload = await buildPayload(type);
            const markdown = renderMarkdown(payload);
            setPreview({type, markdown});
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("export.preview_error", "Preview failed: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    function exportRow(
        type: ExportType,
        label: string,
        children?: React.ReactNode,
    ): React.ReactNode {
        return (
            <div className="export-row" data-testid={`export-row-${type}`}>
                <div className="export-row-label">{label}</div>
                {children}
                <div className="export-row-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => void showPreview(type)}
                        data-testid={`export-preview-${type}`}
                    >
                        {t("export.preview", "Preview")}
                    </Button>
                    <Button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void performExport(type, "md")}
                        data-testid={`export-md-${type}`}
                    >
                        {busy === `${type}-md`
                            ? t("export.busy", "Working...")
                            : t("export.download_md", "Markdown")}
                    </Button>
                    <Button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void performExport(type, "pdf")}
                        data-testid={`export-pdf-${type}`}
                    >
                        {busy === `${type}-pdf`
                            ? t("export.busy", "Working...")
                            : t("export.download_pdf", "PDF")}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <section
            className="settings-section export-section"
            data-testid="export-section"
        >
            <h2 className="settings-section-title">
                {t("export.title", "Export")}
            </h2>
            <p className="muted">
                {t(
                    "export.intro",
                    "Download your learning journey as Markdown or PDF. Markdown is plain text you can edit and share; PDF opens your browser's print dialog so you can save a copy.",
                )}
            </p>

            {exportRow(
                "progress",
                t("export.progress_label", "Progress Report (full journey)"),
            )}

            {exportRow(
                "session",
                t("export.session_label", "Session Detail"),
                <select
                    className="form-input"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    data-testid="export-session-select"
                >
                    <option value="">
                        {t("export.select_session", "-- pick a session --")}
                    </option>
                    {recentSessionsForSelect.map((s) => (
                        <option key={s.id} value={s.id}>
                            {(s.started_at ?? "").slice(0, 10)} - {s.method}
                        </option>
                    ))}
                </select>,
            )}

            {exportRow(
                "curriculum",
                t("export.curriculum_label", "Curriculum Overview"),
                <select
                    className="form-input"
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    data-testid="export-curriculum-select"
                >
                    <option value="">
                        {t("export.select_curriculum", "-- pick a curriculum --")}
                    </option>
                    {curricula.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.title}
                        </option>
                    ))}
                </select>,
            )}

            {preview && (
                <div
                    className="export-preview"
                    data-testid="export-preview-pane"
                >
                    <div className="export-preview-header">
                        <h3>{t("export.preview_title", "Preview")}</h3>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPreview(null)}
                        >
                            {t("export.preview_close", "Close")}
                        </Button>
                    </div>
                    <pre className="export-preview-body">
                        {shortPreview(preview.markdown, 30)}
                    </pre>
                </div>
            )}
        </section>
    );
}
