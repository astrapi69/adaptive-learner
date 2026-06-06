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
  readUserRepo,
  syncUserRepo,
} from "../lib/content/content-repos";

export function useContentRepoAutoSync(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }
      const repo = await readUserRepo();
      if (cancelled || !repo?.connected) return;
      if (!isUserRepoSyncDue(repo.last_synced)) return;
      try {
        await syncUserRepo();
      } catch {
        /* background sync is best-effort; manual Sync is the recovery path */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
