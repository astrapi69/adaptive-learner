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

import { Download, FileCode, GitCommit, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Feature } from "@astrapi69/feature-strategy-react";

import { api, ApiError } from "../api/client";
import { FEATURES } from "../features/featureConfig";
import { useI18n } from "../hooks/useI18n";
import { getStorage } from "../storage";
import { notify } from "../utils/notify";

interface RenderState {
  rendered_at: string;
  language: string;
  files: Record<string, string>;
}

export default function LearningRepoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [state, setState] = useState<RenderState | null>(null);
  const [activeFile, setActiveFile] = useState<string>("README.md");
  const [loading, setLoading] = useState(true);
  const [persisting, setPersisting] = useState(false);

  const loadRepo = useCallback(async () => {
    if (!projectId) return;
    // Phase 49G: render works in BOTH storage modes via
    // the IStorageService.learningRepo namespace (49E).
    setLoading(true);
    try {
      const data = await getStorage().learningRepo.render(projectId);
      setState({
        rendered_at: data.rendered_at,
        language: data.language,
        files: data.files,
      });
    } catch (err) {
      // Phase 49G: a 404 means the project simply
      // doesn't exist (typo, stale link, or a smoke-
      // test fixture path). Navigate silently —
      // emitting a red toast on every "no such
      // project" would fail the Dexie-mode release
      // gate and confuse the user.
      if (err instanceof ApiError && err.status === 404) {
        navigate("/dashboard");
        return;
      }
      const message = err instanceof ApiError ? err.detail : String(err);
      notify.error(t("repo.error.render_failed", "Could not render repository") + ": " + message);
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate, t]);

  useEffect(() => {
    void loadRepo();
  }, [loadRepo]);

  const fileGroups = useMemo(() => groupFiles(state?.files ?? {}), [state]);

  const handleDownloadZip = async () => {
    if (!projectId) return;
    try {
      const blob = await getStorage().learningRepo.exportZip(projectId);
      triggerDownload(blob, `${projectId}-learning-repo.zip`);
      notify.success(t("repo.toast.zip_downloaded", "ZIP downloaded"));
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : String(err);
      notify.error(t("repo.error.zip_failed", "Could not export ZIP") + ": " + message);
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
      const message = err instanceof ApiError ? err.detail : String(err);
      notify.error(t("repo.error.persist_failed", "Could not persist to git") + ": " + message);
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
          <Button
            type="button"
            variant="secondary"
            onClick={loadRepo}
            data-testid="repo-rerender-btn"
            aria-label={t("repo.action.rerender", "Re-render")}
            title={t("repo.action.rerender", "Re-render")}
          >
            <RefreshCw size={16} />
            <span className="hidden md:inline">{t("repo.action.rerender", "Re-render")}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadZip}
            data-testid="repo-download-zip-btn"
            aria-label={t("repo.action.download_zip", "Download ZIP")}
            title={t("repo.action.download_zip", "Download ZIP")}
          >
            <Download size={16} />
            <span className="hidden md:inline">
              {t("repo.action.download_zip", "Download ZIP")}
            </span>
          </Button>
          {/* Persist needs a server-side filesystem + git binary, so
              GIT_PERSIST is disabled in Dexie mode with a tooltip
              naming the desktop app (#335) instead of hidden. */}
          <Feature
            id={FEATURES.GIT_PERSIST}
            whenDisabled={
              <Button
                type="button"
                variant="secondary"
                disabled
                aria-label={t("repo.action.persist", "Persist to git")}
                title={t("feature.desktop_only", "Only available with the desktop app.")}
                data-testid="repo-persist-btn-desktop-only"
              >
                <GitCommit size={16} />
                <span className="hidden md:inline">
                  {t("repo.action.persist", "Persist to git")}
                </span>
              </Button>
            }
          >
            <Button
              type="button"
              variant="secondary"
              onClick={handlePersist}
              disabled={persisting}
              aria-label={t("repo.action.persist", "Persist to git")}
              title={t("repo.action.persist", "Persist to git")}
              data-testid="repo-persist-btn"
            >
              <GitCommit size={16} />
              <span className="hidden md:inline">
                {persisting
                  ? t("repo.action.persisting", "Persisting…")
                  : t("repo.action.persist", "Persist to git")}
              </span>
            </Button>
          </Feature>
        </div>
      </header>
      <p className="learning-repo-meta">
        {t("repo.page.rendered_at", "Rendered at")}: {new Date(state.rendered_at).toLocaleString()}{" "}
        · {t("repo.page.language", "Language")}: <code>{state.language}</code>
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
          {fileGroups.topics.map(({ folder, paths }) => (
            <details key={folder} className="learning-repo-topic-group" open>
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
        <article className="learning-repo-content markdown-body" data-testid="repo-content">
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
  const rootOrder = ["README.md", "LEARNING_STATS.md", "CHEATSHEET.md", "ROADMAP.md"];
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
  return { root, topics };
}

interface FileButtonProps {
  path: string;
  active: boolean;
  onClick: (path: string) => void;
  nested?: boolean;
}

function FileButton({ path, active, onClick, nested }: FileButtonProps) {
  const label = nested ? path.split("/").slice(1).join("/") : path;
  return (
    <button
      type="button"
      onClick={() => onClick(path)}
      className={`learning-repo-file ${active ? "active" : ""} ${nested ? "nested" : ""}`}
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
