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

import {Download, FolderOpen, RefreshCw} from "lucide-react";
import {useCallback, useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {getStorage} from "../storage";
import type {
    ContentSetEntry,
    ContentSetSource,
} from "../storage/types";
import {notify} from "../utils/notify";

type DownloadState = "idle" | "downloading" | "done" | "error";

export default function ContentPage() {
    const {t} = useI18n();
    const [sets, setSets] = useState<ContentSetEntry[]>([]);
    const [sources, setSources] = useState<ContentSetSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [perSetState, setPerSetState] = useState<
        Record<string, DownloadState>
    >({});

    const loadSets = useCallback(async () => {
        try {
            const data = await getStorage().contentLoader.listSets();
            setSets(data.sets);
            setSources(data.sources);
        } catch (err) {
            notify.error(
                t(
                    "content.error.list_failed",
                    "Could not load content sets.",
                ),
                {apiError: err instanceof Error ? undefined : undefined},
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

    const handleDownload = async (entry: ContentSetEntry) => {
        const key = setKey(entry);
        setPerSetState((prev) => ({...prev, [key]: "downloading"}));
        try {
            const updated = await getStorage().contentLoader.downloadSet(
                entry.source,
                entry.id,
            );
            setSets((prev) =>
                prev.map((row) =>
                    row.source === entry.source && row.id === entry.id
                        ? updated
                        : row,
                ),
            );
            setPerSetState((prev) => ({...prev, [key]: "done"}));
            notify.success(
                t(
                    "content.toast.downloaded",
                    "Set downloaded and ready to use.",
                ),
            );
        } catch (err) {
            setPerSetState((prev) => ({...prev, [key]: "error"}));
            notify.error(
                t(
                    "content.error.download_failed",
                    "Could not download the set.",
                ),
                {
                    apiError:
                        err instanceof Error
                            ? undefined
                            : undefined,
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

    return (
        <main
            id="main"
            className="page content-page"
            data-testid="content-page"
        >
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
                <p
                    className="content-sources"
                    data-testid="content-sources"
                >
                    {t("content.sources", "Sources")}:{" "}
                    {sources
                        .map((src) => `${src.source} @ ${src.branch}`)
                        .join(", ")}
                </p>
            )}

            {sets.length === 0 ? (
                <p
                    className="content-empty"
                    data-testid="content-empty"
                >
                    {t(
                        "content.empty",
                        "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
                    )}
                </p>
            ) : (
                <ul
                    className="content-set-list"
                    data-testid="content-set-list"
                >
                    {sets.map((entry) => {
                        const key = setKey(entry);
                        const downloadState =
                            perSetState[key] ?? "idle";
                        const isCached = entry.cached_version !== null;
                        return (
                            <li
                                key={key}
                                className="content-set-row"
                                data-testid={`content-set-${entry.id}`}
                            >
                                <div className="content-set-meta">
                                    <h2>{entry.title}</h2>
                                    <p className="content-set-tags">
                                        <span>
                                            {entry.language.toUpperCase()}
                                            {" · "}
                                            {entry.level}
                                            {" · "}
                                            {entry.lesson_count}{" "}
                                            {t(
                                                "content.lessons",
                                                "lessons",
                                            )}
                                        </span>
                                        {isCached && (
                                            <span
                                                className="content-set-cached"
                                                data-testid={`content-set-${entry.id}-cached`}
                                            >
                                                {t(
                                                    "content.status.ready",
                                                    "Ready",
                                                )}{" "}
                                                ({entry.cached_version})
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
                                        <p className="content-set-desc">
                                            {entry.description}
                                        </p>
                                    )}
                                </div>
                                <div className="content-set-action">
                                    <button
                                        type="button"
                                        className="btn content-set-download-btn"
                                        onClick={() =>
                                            handleDownload(entry)
                                        }
                                        disabled={
                                            downloadState ===
                                                "downloading" ||
                                            (isCached &&
                                                !entry.update_available)
                                        }
                                        data-testid={`content-set-${entry.id}-action`}
                                    >
                                        {downloadState ===
                                        "downloading" ? (
                                            <>
                                                <Download
                                                    size={14}
                                                    aria-hidden="true"
                                                />
                                                {t(
                                                    "content.status.downloading",
                                                    "Downloading…",
                                                )}
                                            </>
                                        ) : isCached &&
                                          !entry.update_available ? (
                                            <>
                                                <FolderOpen
                                                    size={14}
                                                    aria-hidden="true"
                                                />
                                                {t(
                                                    "content.action.installed",
                                                    "Installed",
                                                )}
                                            </>
                                        ) : entry.update_available ? (
                                            <>
                                                <Download
                                                    size={14}
                                                    aria-hidden="true"
                                                />
                                                {t(
                                                    "content.action.update",
                                                    "Update",
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Download
                                                    size={14}
                                                    aria-hidden="true"
                                                />
                                                {t(
                                                    "content.action.download",
                                                    "Download",
                                                )}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
