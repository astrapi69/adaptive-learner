/**
 * /content — Set Browser page (Phase 43 / EXP-002 / F-100 + F-101).
 *
 * Lists every content set the configured sources publish, plus
 * every cached set the user has downloaded. Each row renders:
 * title / language / level / lesson count / download status
 * (not downloaded | downloading | ready | update available) +
 * a single primary action button per row.
 *
 * Storage-mode-agnostic: routes every call through
 * ``getStorage().contentLoader.*`` so the same page works in
 * API mode (backend orchestrator) and Dexie mode (in-browser
 * fetch + IndexedDB cache). The Phase 44 viewer (next phase)
 * will pick up from here — for v1.27.0 the page only manages
 * downloads.
 *
 * Mobile-first responsive: rows stack tightly on viewports
 * narrower than 600px; the action button stays full-width so
 * touch targets stay above 44px.
 */

import {
  BookOpen,
  Download,
  FolderOpen,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ImportLessonModal from "../components/content/ImportLessonModal";
import { useI18n } from "../hooks/useI18n";
import {
  buildContentSetZip,
  communityIssueUrl,
  contentSetFileName,
  downloadLessonJson,
  triggerDownload,
  type ExportSetMeta,
} from "../lib/content/lesson-export";
import { getStorage } from "../storage";
import { USER_GENERATED_SOURCE } from "../storage/types";
import type {
  ContentLesson,
  ContentSetEntry,
  ContentSetSource,
} from "../storage/types";
import { notify } from "../utils/notify";

/** Community contribution target repo (manual maintainer review). */
const COMMUNITY_REPO = "astrapi69/adaptive-learner-content";

/** "Share with Community" opens a GitHub issue on COMMUNITY_REPO.
 *  Enabled now that the content repo exists; set false to gate the
 *  button off again (e.g. if the repo is unavailable). Export (JSON /
 *  ZIP) is independent of this — it's a local download. */
const COMMUNITY_SHARING_ENABLED = true;

type DownloadState = "idle" | "downloading" | "done" | "error";

export default function ContentPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sets, setSets] = useState<ContentSetEntry[]>([]);
  const [sources, setSources] = useState<ContentSetSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perSetState, setPerSetState] = useState<Record<string, DownloadState>>(
    {},
  );
  // Phase 59C — My Lessons delete-confirm modal target.
  const [deleteTarget, setDeleteTarget] = useState<ContentSetEntry | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  // Phase 59E — import-lesson modal.
  const [showImport, setShowImport] = useState(false);

  const loadSets = useCallback(async () => {
    try {
      const data = await getStorage().contentLoader.listSets();
      setSets(data.sets);
      setSources(data.sources);
    } catch (err) {
      notify.error(
        t("content.error.list_failed", "Could not load content sets."),
        { apiError: err instanceof Error ? undefined : undefined },
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSets();
  };

  const setKey = (entry: ContentSetEntry): string =>
    `${entry.source}#${entry.id}`;

  const handleOpenLesson = async (entry: ContentSetEntry) => {
    // Phase 44 / EXP-002 / 3B: jump to the set's first
    // cached lesson. Future enhancements can swap this for
    // a dedicated per-set lesson list page.
    try {
      const listing = await getStorage().contentLoader.listLessons(
        entry.source,
        entry.id,
      );
      const first = listing.lessons[0];
      if (!first) {
        notify.warning(
          t(
            "content.warning.no_lessons_in_set",
            "This set has no lessons yet.",
          ),
        );
        return;
      }
      const slug = entry.source.replace(/\//g, "--");
      navigate(
        `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(entry.id)}/${encodeURIComponent(first)}`,
      );
    } catch (err) {
      notify.error(
        t("content.error.open_failed", "Could not open the lesson."),
        {
          apiError: err instanceof Error ? undefined : undefined,
        },
      );
    }
  };

  // Phase 59C — edit a user-generated lesson: jump back to its
  // source conversation's import page, where re-saving overwrites
  // the set in place. Only analysis-sourced sets carry a
  // recoverable conversation id (set id is ``analysis-{convId}``).
  const handleEditUserSet = (entry: ContentSetEntry) => {
    const convId = entry.id.replace(/^analysis-/, "");
    navigate(`/import/${encodeURIComponent(convId)}`);
  };

  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(
        deleteTarget.source,
        deleteTarget.id,
      );
      setSets((prev) =>
        prev.filter(
          (row) =>
            !(row.source === deleteTarget.source && row.id === deleteTarget.id),
        ),
      );
      notify.success(t("content.my_lessons.deleted", "Lesson deleted."));
      setDeleteTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.my_lessons.delete_failed", "Could not delete the lesson.")} ${detail}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  // Phase 59D — export + community sharing.
  const exportMeta = (entry: ContentSetEntry): ExportSetMeta => ({
    set_id: entry.id,
    title: entry.title,
    language: entry.language,
    level: entry.level,
    description: entry.description,
  });

  const fetchSetLessons = async (
    entry: ContentSetEntry,
  ): Promise<ContentLesson[]> => {
    const listing = await getStorage().contentLoader.listLessons(
      entry.source,
      entry.id,
    );
    return Promise.all(
      listing.lessons.map((f) =>
        getStorage().contentLoader.getLesson(entry.source, entry.id, f),
      ),
    );
  };

  const handleExportJson = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      if (lessons.length === 1) {
        downloadLessonJson(lessons[0]);
      } else {
        const blob = await buildContentSetZip(exportMeta(entry), lessons);
        triggerDownload(blob, contentSetFileName(entry.title));
      }
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`,
      );
    }
  };

  const handleExportSet = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      const blob = await buildContentSetZip(exportMeta(entry), lessons);
      triggerDownload(blob, contentSetFileName(entry.title));
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`,
      );
    }
  };

  const handleShare = (entry: ContentSetEntry) => {
    const url = communityIssueUrl(
      COMMUNITY_REPO,
      exportMeta(entry),
      entry.lesson_count,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async (entry: ContentSetEntry) => {
    const key = setKey(entry);
    setPerSetState((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      const updated = await getStorage().contentLoader.downloadSet(
        entry.source,
        entry.id,
      );
      setSets((prev) =>
        prev.map((row) =>
          row.source === entry.source && row.id === entry.id ? updated : row,
        ),
      );
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      notify.success(
        t("content.toast.downloaded", "Set downloaded and ready to use."),
      );
    } catch (err) {
      setPerSetState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(
        t("content.error.download_failed", "Could not download the set."),
        {
          apiError: err instanceof Error ? undefined : undefined,
        },
      );
    }
  };

  if (loading) {
    return (
      <main
        id="main"
        className="page content-page"
        data-testid="content-loading"
      >
        <p>{t("content.loading", "Loading content sets…")}</p>
      </main>
    );
  }

  // Phase 59C — user-generated lessons ("My Lessons") render in
  // their own section, separate from downloaded content sets.
  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);
  const originLabel = (entry: ContentSetEntry): string => {
    if (entry.domain === "adaptive")
      return t("content.my_lessons.from_adaptive", "from adaptive lesson");
    if (entry.domain === "imported")
      return t("content.my_lessons.from_imported", "imported");
    return t("content.my_lessons.from_analysis", "from analysis");
  };

  return (
    <main id="main" className="page content-page" data-testid="content-page">
      <header className="content-header">
        <h1>{t("content.page_title", "Content sets")}</h1>
        <button
          type="button"
          className="content-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="content-refresh"
          aria-label={t("content.action.refresh", "Refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing
            ? t("content.action.refreshing", "Refreshing…")
            : t("content.action.refresh", "Refresh")}
        </button>
      </header>
      <p className="content-intro">
        {t(
          "content.intro",
          "Pre-built lesson sets you can use without an API key. Downloads are cached locally and work offline after the first fetch.",
        )}
      </p>

      {sources.length > 0 && (
        <p className="content-sources" data-testid="content-sources">
          {t("content.sources", "Sources")}:{" "}
          {sources.map((src) => `${src.source} @ ${src.branch}`).join(", ")}
        </p>
      )}

      {/* Phase 59C — My Lessons (user-generated sets). */}
      <section
        className="content-section content-my-lessons"
        data-testid="content-my-lessons"
      >
        <div className="content-section-head">
          <h2>{t("content.my_lessons.title", "My Lessons")}</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowImport(true)}
            data-testid="content-import-lesson"
          >
            {t("content.import_lesson.button", "Import Lesson")}
          </button>
        </div>
        {userSets.length === 0 ? (
          <p className="content-empty" data-testid="content-my-lessons-empty">
            {t(
              "content.my_lessons.empty",
              "Import a chat and analyze it to create your first lesson.",
            )}
          </p>
        ) : (
          <ul
            className="content-set-list"
            data-testid="content-my-lessons-list"
          >
            {userSets.map((entry) => (
              <li
                key={setKey(entry)}
                className="content-set-row"
                data-testid={`my-lesson-${entry.id}`}
              >
                <div className="content-set-meta">
                  <h3>{entry.title}</h3>
                  <p className="content-set-tags">
                    <span>
                      {entry.language.toUpperCase()}
                      {" · "}
                      {entry.lesson_count} {t("content.lessons", "lessons")}
                      {" · "}
                      {originLabel(entry)}
                    </span>
                  </p>
                </div>
                <div className="content-set-action">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenLesson(entry)}
                    data-testid={`my-lesson-${entry.id}-play`}
                  >
                    <Play size={14} aria-hidden="true" />
                    {t("content.my_lessons.play", "Play")}
                  </button>
                  {entry.domain === "analysis" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleEditUserSet(entry)}
                      data-testid={`my-lesson-${entry.id}-edit`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      {t("content.my_lessons.edit", "Edit")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleExportJson(entry)}
                    data-testid={`my-lesson-${entry.id}-export`}
                  >
                    <Download size={14} aria-hidden="true" />
                    {t("content.my_lessons.export", "Export")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleExportSet(entry)}
                    data-testid={`my-lesson-${entry.id}-export-set`}
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    {t("content.my_lessons.export_set", "Export as set")}
                  </button>
                  {COMMUNITY_SHARING_ENABLED && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleShare(entry)}
                      data-testid={`my-lesson-${entry.id}-share`}
                    >
                      {t("content.my_lessons.share", "Share with Community")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(entry)}
                    data-testid={`my-lesson-${entry.id}-delete`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("content.my_lessons.delete", "Delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="content-section-title">
        {t("content.my_lessons.downloaded_title", "Downloaded sets")}
      </h2>
      {downloadedSets.length === 0 ? (
        <p className="content-empty" data-testid="content-empty">
          {t(
            "content.empty",
            "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
          )}
        </p>
      ) : (
        <ul className="content-set-list" data-testid="content-set-list">
          {downloadedSets.map((entry) => {
            const key = setKey(entry);
            const downloadState = perSetState[key] ?? "idle";
            const isCached = entry.cached_version !== null;
            return (
              <li
                key={key}
                className="content-set-row"
                data-testid={`content-set-${entry.id}`}
              >
                <div className="content-set-meta">
                  <h2>
                    {entry.title}
                    <span
                      className="content-set-source"
                      data-testid={`content-set-${entry.id}-source`}
                    >
                      {entry.source.startsWith("bundled:")
                        ? t("content.source.bundled", "Bundled")
                        : t("content.source.github", "GitHub")}
                    </span>
                  </h2>
                  <p className="content-set-tags">
                    <span>
                      {entry.language.toUpperCase()}
                      {" · "}
                      {entry.level}
                      {" · "}
                      {entry.lesson_count} {t("content.lessons", "lessons")}
                    </span>
                    {isCached && (
                      <span
                        className="content-set-cached"
                        data-testid={`content-set-${entry.id}-cached`}
                      >
                        {t("content.status.ready", "Ready")} (
                        {entry.cached_version})
                      </span>
                    )}
                    {entry.update_available && (
                      <span
                        className="content-set-update"
                        data-testid={`content-set-${entry.id}-update`}
                      >
                        {t(
                          "content.status.update_available",
                          "Update available",
                        )}
                      </span>
                    )}
                  </p>
                  {entry.description && (
                    <p className="content-set-desc">{entry.description}</p>
                  )}
                </div>
                <div className="content-set-action">
                  {/* Phase 58I a11y: announce download
                                        status changes to screen readers
                                        (the button text alone isn't
                                        re-announced; errors surface via
                                        the toast's own live region). */}
                  <span
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    data-testid={`content-set-${entry.id}-status`}
                  >
                    {downloadState === "downloading"
                      ? t("content.status.downloading", "Downloading…")
                      : isCached && !entry.update_available
                        ? t("content.status.ready", "Ready")
                        : entry.update_available
                          ? t(
                              "content.status.update_available",
                              "Update available",
                            )
                          : ""}
                  </span>
                  {isCached && (
                    <button
                      type="button"
                      className="btn btn-primary content-set-open-btn"
                      onClick={() => handleOpenLesson(entry)}
                      data-testid={`content-set-${entry.id}-open`}
                    >
                      <BookOpen size={14} aria-hidden="true" />
                      {t("content.action.open", "Open")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn content-set-download-btn"
                    onClick={() => handleDownload(entry)}
                    disabled={
                      downloadState === "downloading" ||
                      (isCached && !entry.update_available)
                    }
                    data-testid={`content-set-${entry.id}-action`}
                  >
                    {downloadState === "downloading" ? (
                      <>
                        <Download size={14} aria-hidden="true" />
                        {t("content.status.downloading", "Downloading…")}
                      </>
                    ) : isCached && !entry.update_available ? (
                      <>
                        <FolderOpen size={14} aria-hidden="true" />
                        {t("content.action.installed", "Installed")}
                      </>
                    ) : entry.update_available ? (
                      <>
                        <Download size={14} aria-hidden="true" />
                        {t("content.action.update", "Update")}
                      </>
                    ) : (
                      <>
                        <Download size={14} aria-hidden="true" />
                        {t("content.action.download", "Download")}
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ImportLessonModal
        open={showImport}
        onCancel={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          void loadSets();
        }}
      />

      {deleteTarget && (
        <div className="modal-overlay" data-testid="my-lesson-delete-modal">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lesson-title"
          >
            <h2 id="delete-lesson-title" className="modal-title">
              {deleteTarget.title}
            </h2>
            <p>
              {t(
                "content.my_lessons.delete_confirm",
                "Delete this lesson? This cannot be undone.",
              )}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                data-testid="my-lesson-delete-cancel"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteUserSet}
                disabled={deleting}
                data-testid="my-lesson-delete-confirm"
              >
                {deleting
                  ? t("common.loading", "Loading…")
                  : t("content.my_lessons.delete", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
