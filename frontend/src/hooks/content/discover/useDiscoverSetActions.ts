/**
 * useDiscoverSetActions, split out of the Discover page (#3271): the
 * per-set "Download" (just that one set, with lesson progress) and "Remove"
 * actions of a discovery card or list row, plus their per-set state.
 *
 * @example
 * const { downloadState, downloadProgress, handleDownload, handleRemove, hasDownloaded } =
 *   useDiscoverSetActions({ setDownloadedKeys });
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { ApiError } from "../../../api/client";
import { dismissSet, undismissSet } from "../../../lib/content/browse/lifecycle/dismissed-sets";
import { discoverSetKey } from "../../../lib/content/repos/discover-index";
import type { SearchableSet } from "../../../lib/content/repos/search-index-loader";
import type { SetDiscoveryDownloadState } from "../../../shared/media/SetDiscoveryCard";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";

interface UseDiscoverSetActionsDeps {
  /** The catalogue's downloaded-key set, updated after a download/remove. */
  setDownloadedKeys: Dispatch<SetStateAction<Set<string>>>;
}

/** Download/remove handlers + per-set download state for Discover. */
export function useDiscoverSetActions({ setDownloadedKeys }: UseDiscoverSetActionsDeps) {
  const { t } = useI18n();
  const [downloadState, setDownloadState] = useState<
    Record<string, SetDiscoveryDownloadState>
  >({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { current: number; total: number }>
  >({});

  // #772 — once the learner has downloaded a set this session, point them
  // back to the Content Browser ("Meine Inhalte"), where it now lives.
  const hasDownloaded = useMemo(
    () => Object.values(downloadState).some((state) => state === "done"),
    [downloadState],
  );

  async function handleDownload(set: SearchableSet) {
    const key = discoverSetKey(set);
    setDownloadState((prev) => ({ ...prev, [key]: "downloading" }));
    setDownloadProgress((prev) => ({ ...prev, [key]: { current: 0, total: set.lesson_count } }));
    try {
      await getStorage().contentLoader.downloadSet(set.repo_url, set.id, (progress) =>
        setDownloadProgress((prev) => ({ ...prev, [key]: progress })),
      );
      // #1709 — an explicit (re-)download revives a previously deleted set in
      // "Meine Inhalte"; clear any stale dismissal record.
      undismissSet(set.repo_url, set.id);
      setDownloadState((prev) => ({ ...prev, [key]: "done" }));
      setDownloadedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      notify.success(t("discover.toast.downloaded", "Set downloaded and ready to use."));
    } catch (err) {
      setDownloadState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(t("discover.error.download_failed", "Could not download the set."), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    }
  }

  async function handleRemove(set: SearchableSet) {
    const key = discoverSetKey(set);
    try {
      await getStorage().contentLoader.deleteSet(set.repo_url, set.id);
      // #1709 — removing the download here is just as explicit as deleting in
      // "Meine Inhalte": remember it so a Refresh does not restore the set
      // there. Discover itself keeps listing the set (download it anytime).
      dismissSet(set.repo_url, set.id);
      setDownloadedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setDownloadState((prev) => ({ ...prev, [key]: "idle" }));
      notify.success(t("discover.toast.removed", "Set removed. You can download it again anytime."));
    } catch (err) {
      notify.error(t("discover.error.remove_failed", "Could not remove the set."), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    }
  }

  return { downloadState, downloadProgress, handleDownload, handleRemove, hasDownloaded };
}
