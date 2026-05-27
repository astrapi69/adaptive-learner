/**
 * /projects/:projectId/learning-repo — repo browser page
 * (v1.26.0 / Phase 42 / BL-30 commit 6).
 *
 * Layout: file-list sidebar on the left, Markdown viewer on the
 * right. The user can pick any file from the rendered tree;
 * topic-folder ``NN_slug/README.md`` paths are grouped under a
 * collapsed sub-heading so the sidebar stays compact for
 * projects with many topics.
 *
 * Side actions: "Download ZIP" (always available) + "Persist to
 * git" (only when ``enable_git`` is on; the backend returns 400
 * otherwise, surfaced as a toast).
 *
 * All API calls go through ``api.learningRepo.*`` — no fetch()
 * calls in this component.
 */

import {Download, FileCode, GitCommit, RefreshCw} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import Markdown from "react-markdown";
import {useNavigate, useParams} from "react-router-dom";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {getStorage, resolveStorageMode} from "../storage";
import {notify} from "../utils/notify";

interface RenderState {
    rendered_at: string;
    language: string;
    files: Record<string, string>;
}

export default function LearningRepoPage() {
    const {projectId} = useParams<{projectId: string}>();
    const navigate = useNavigate();
    const {t} = useI18n();
    const storageMode = resolveStorageMode();

    const [state, setState] = useState<RenderState | null>(null);
    const [activeFile, setActiveFile] = useState<string>("README.md");
    const [loading, setLoading] = useState(storageMode === "api");
    const [persisting, setPersisting] = useState(false);

    const loadRepo = useCallback(async () => {
        if (!projectId) return;
        // Phase 49E: ``storage.learningRepo.render`` works in
        // both API mode (delegates) and Dexie mode (TS
        // renderer). The remaining storageMode gate at the
        // render-body level (below) is removed in 49G; this
        // commit keeps it so the namespace-swap is the only
        // behavioural change in 49E.
        if (storageMode !== "api") return;
        setLoading(true);
        try {
            const data = await getStorage().learningRepo.render(projectId);
            setState({
                rendered_at: data.rendered_at,
                language: data.language,
                files: data.files,
            });
        } catch (err) {
            const message =
                err instanceof ApiError ? err.detail : String(err);
            notify.error(t("repo.error.render_failed", "Could not render repository") + ": " + message);
            if (err instanceof ApiError && err.status === 404) {
                navigate("/dashboard");
            }
        } finally {
            setLoading(false);
        }
    }, [projectId, navigate, t, storageMode]);

    useEffect(() => {
        void loadRepo();
    }, [loadRepo]);

    const fileGroups = useMemo(() => groupFiles(state?.files ?? {}), [state]);

    const handleDownloadZip = async () => {
        if (!projectId) return;
        try {
            const blob =
                await getStorage().learningRepo.exportZip(projectId);
            triggerDownload(blob, `${projectId}-learning-repo.zip`);
            notify.success(t("repo.toast.zip_downloaded", "ZIP downloaded"));
        } catch (err) {
            const message =
                err instanceof ApiError ? err.detail : String(err);
            notify.error(
                t("repo.error.zip_failed", "Could not export ZIP") + ": " + message,
            );
        }
    };

    const handlePersist = async () => {
        if (!projectId) return;
        setPersisting(true);
        try {
            const result = await api.learningRepo.persist(projectId);
            const tagSuffix = result.tag ? ` (${result.tag})` : "";
            notify.success(
                t("repo.toast.persisted", "Persisted to git") +
                    `: ${result.commit_sha.slice(0, 7)}${tagSuffix}`,
            );
            await loadRepo();
        } catch (err) {
            const message =
                err instanceof ApiError ? err.detail : String(err);
            notify.error(
                t("repo.error.persist_failed", "Could not persist to git") +
                    ": " +
                    message,
            );
        } finally {
            setPersisting(false);
        }
    };

    if (!projectId) {
        return (
            <main className="page" data-testid="learning-repo-page-missing-id">
                <p>{t("repo.error.missing_project", "No project selected.")}</p>
            </main>
        );
    }

    if (storageMode !== "api") {
        return (
            <main
                className="page learning-repo-page"
                data-testid="learning-repo-page-dexie-unavailable"
            >
                <header className="learning-repo-header">
                    <h1>{t("repo.page_title", "Learning Repository")}</h1>
                </header>
                <p>
                    {t(
                        "repo.dexie_unavailable_body",
                        "This feature is only available in server mode. Switch to server mode in Settings to enable git-backed learning repositories.",
                    )}
                </p>
                <p>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard")}
                        data-testid="learning-repo-back-to-dashboard"
                    >
                        {t("repo.back_to_dashboard", "Back to Dashboard")}
                    </button>
                </p>
            </main>
        );
    }

    if (loading || state === null) {
        return (
            <main className="page" data-testid="learning-repo-page-loading">
                <p>{t("repo.loading", "Rendering repository…")}</p>
            </main>
        );
    }

    const activeContent = state.files[activeFile] ?? "";

    return (
        <main className="page learning-repo-page" data-testid="learning-repo-page">
            <header className="learning-repo-header">
                <h1>{t("repo.page.title", "Learning Repository")}</h1>
                <div className="learning-repo-actions">
                    <button
                        type="button"
                        onClick={loadRepo}
                        data-testid="repo-rerender-btn"
                        aria-label={t("repo.action.rerender", "Re-render")}
                    >
                        <RefreshCw size={16} />
                        {t("repo.action.rerender", "Re-render")}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadZip}
                        data-testid="repo-download-zip-btn"
                    >
                        <Download size={16} />
                        {t("repo.action.download_zip", "Download ZIP")}
                    </button>
                    <button
                        type="button"
                        onClick={handlePersist}
                        disabled={persisting}
                        data-testid="repo-persist-btn"
                    >
                        <GitCommit size={16} />
                        {persisting
                            ? t("repo.action.persisting", "Persisting…")
                            : t("repo.action.persist", "Persist to git")}
                    </button>
                </div>
            </header>
            <p className="learning-repo-meta">
                {t("repo.page.rendered_at", "Rendered at")}:{" "}
                {new Date(state.rendered_at).toLocaleString()} ·{" "}
                {t("repo.page.language", "Language")}: <code>{state.language}</code>
            </p>

            <div className="learning-repo-body">
                <aside className="learning-repo-sidebar" data-testid="repo-sidebar">
                    {fileGroups.root.map((path) => (
                        <FileButton
                            key={path}
                            path={path}
                            active={activeFile === path}
                            onClick={setActiveFile}
                        />
                    ))}
                    {fileGroups.topics.map(({folder, paths}) => (
                        <details
                            key={folder}
                            className="learning-repo-topic-group"
                            open
                        >
                            <summary>{folder}</summary>
                            {paths.map((path) => (
                                <FileButton
                                    key={path}
                                    path={path}
                                    active={activeFile === path}
                                    onClick={setActiveFile}
                                    nested
                                />
                            ))}
                        </details>
                    ))}
                </aside>
                <article
                    className="learning-repo-content markdown-body"
                    data-testid="repo-content"
                >
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
                    >
                        {activeContent}
                    </Markdown>
                </article>
            </div>
        </main>
    );
}

interface TopicGroup {
    folder: string;
    paths: string[];
}

interface FileGroups {
    root: string[];
    topics: TopicGroup[];
}

/** Split the file map into root meta-files and per-topic
 *  groups. Root files keep the renderer's canonical order
 *  (README → STATS → CHEATSHEET → ROADMAP); topic folders are
 *  surfaced in numbered order so ``01_…`` always sits above
 *  ``02_…``. */
function groupFiles(files: Record<string, string>): FileGroups {
    const rootOrder = [
        "README.md",
        "LEARNING_STATS.md",
        "CHEATSHEET.md",
        "ROADMAP.md",
    ];
    const root = rootOrder.filter((name) => name in files);
    const topicMap = new Map<string, string[]>();
    for (const path of Object.keys(files)) {
        if (!path.includes("/")) continue;
        const folder = path.split("/", 1)[0];
        const existing = topicMap.get(folder) ?? [];
        existing.push(path);
        topicMap.set(folder, existing);
    }
    const topics: TopicGroup[] = Array.from(topicMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([folder, paths]) => ({
            folder,
            paths: paths.sort((a, b) => a.localeCompare(b)),
        }));
    return {root, topics};
}

interface FileButtonProps {
    path: string;
    active: boolean;
    onClick: (path: string) => void;
    nested?: boolean;
}

function FileButton({path, active, onClick, nested}: FileButtonProps) {
    const label = nested ? path.split("/").slice(1).join("/") : path;
    return (
        <button
            type="button"
            onClick={() => onClick(path)}
            className={`learning-repo-file ${active ? "active" : ""} ${
                nested ? "nested" : ""
            }`}
            data-testid={`repo-file-${path}`}
            aria-current={active ? "true" : undefined}
        >
            <FileCode size={14} />
            <span>{label}</span>
        </button>
    );
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
