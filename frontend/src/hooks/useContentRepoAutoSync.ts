/**
 * Auto-sync the connected user content repository on app start
 * (EXP-023 Phase A, commit 5).
 *
 * Runs once per app load: if a user repo is connected and its last sync is
 * older than the 24h threshold (or it has never synced), it re-syncs in the
 * background. It is best-effort — offline is skipped, and any failure is
 * swallowed (the manual "Sync now" button in Settings is the recovery
 * path; a background failure must never surface a toast or block the app).
 */

import { useEffect } from "react";

import {
  isUserRepoSyncDue,
  readUserRepos,
  syncUserRepo,
  userRepoSource,
} from "../lib/content/content-repos";

export function useContentRepoAutoSync(): void {
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
          await syncUserRepo(userRepoSource(repo.owner, repo.repo));
        } catch {
          /* background sync is best-effort; manual Sync is the recovery */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
