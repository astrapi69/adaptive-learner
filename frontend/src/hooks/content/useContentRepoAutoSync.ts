/**
 * Auto-sync the connected user content repository on app start
 * (EXP-023 Phase A, commit 5).
 *
 * Runs once per app load: if a user repo is connected and its last sync is
 * older than the 24h threshold (or it has never synced), it re-syncs in the
 * background. It is best-effort — offline is skipped, and any failure is
 * swallowed (the manual "Sync now" button in Settings is the recovery
 * path; a background failure must never surface a toast or block the app).
 * The one exception that DOES toast is not a failure: an auto-applied update
 * that archived author-retired progress surfaces its one-time count notice
 * (#2188, architect decision — the learner must learn of it once).
 */

import { useEffect } from "react";

import {
  isUserRepoSyncDue,
  readUserRepos,
  syncUserRepo,
  userRepoSource,
} from "../../lib/content/repos/content-repos";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

export function useContentRepoAutoSync(): void {
  const { t } = useI18n();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }
      const repos = await readUserRepos();
      for (const repo of repos) {
        if (cancelled) return;
        if (!repo.connected || !isUserRepoSyncDue(repo.last_synced)) continue;
        try {
          const result = await syncUserRepo(userRepoSource(repo.owner, repo.repo));
          // #2188 — an auto-applied update declared retirements: tell the
          // learner once, with the count (architect decision on #2188).
          if (result.retiredArchived > 0) {
            notify.info(
              t(
                "content.update_guard.retired_archived",
                "{count} exercises were retired by the author; the related progress is archived.",
              ).replace("{count}", String(result.retiredArchived)),
            );
          }
        } catch {
          /* background sync is best-effort; manual Sync is the recovery */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once per app load; ``t`` is only the toast wording and must not
    // re-trigger a sync on locale change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
