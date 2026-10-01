/**
 * Set lifecycle status for the /content page, split out of
 * ``useContentSetActions`` (#3271): the per-set and bulk status change
 * (#1300, #1351) and the "Set erneut durcharbeiten" restart of a completed
 * set (EXP-051 / #2125).
 *
 * Status persists to the mode-agnostic set-status store, the single source
 * of truth in BOTH storage modes (the prior Dexie-row-only persistence left
 * API mode a no-op, so the status reverted to "active" on every reload).
 *
 * @example
 * const lifecycle = useSetLifecycle({ setSets });
 * lifecycle.handleSetStatus(entry, "deferred");
 * lifecycle.requestRestartSet(entry); // then handleConfirmRestartSet()
 */

import { useState } from "react";

import {
  storeSetStatus,
  storeSetStatuses,
} from "../../../lib/content/browse/lifecycle/set-status-store";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";
import { setKey } from "./set-entry";
import type { SetSetsDispatch } from "./types";

interface UseSetLifecycleDeps {
  setSets: SetSetsDispatch;
}

/** Status changes + the restart-confirm state for downloaded sets. */
export function useSetLifecycle({ setSets }: UseSetLifecycleDeps) {
  const { t } = useI18n();
  // EXP-051 / #2125 — "Set erneut durcharbeiten" confirm target + in-flight.
  const [restartSetTarget, setRestartSetTarget] = useState<ContentSetEntry | null>(null);
  const [restarting, setRestarting] = useState(false);

  // #1300 — move a downloaded set between lifecycle statuses. Optimistic:
  // the list updates immediately, then persists to the set-status store.
  const handleSetStatus = (entry: ContentSetEntry, status: SetStatus) => {
    setSets((prev) =>
      prev.map((row) =>
        row.source === entry.source && row.id === entry.id ? { ...row, status } : row,
      ),
    );
    storeSetStatus(entry.source, entry.id, status);
    notify.success(t("content.set_status.changed", "Status updated."));
  };

  // #1351 — bulk status change over the selected sets. One optimistic list
  // update + one write to the set-status store. On success the caller clears
  // the selection; a short toast confirms.
  const handleBulkSetStatus = (
    entries: ContentSetEntry[],
    status: SetStatus,
  ) => {
    if (entries.length === 0) return;
    const keys = new Set(entries.map(setKey));
    setSets((prev) =>
      prev.map((row) => (keys.has(setKey(row)) ? { ...row, status } : row)),
    );
    storeSetStatuses(
      entries.map((e) => ({ source: e.source, setId: e.id })),
      status,
    );
    notify.success(
      t("content.set_status.bulk_changed", "Status updated for {n} sets.").replace(
        "{n}",
        String(entries.length),
      ),
    );
  };

  // EXP-051 / #2125 — request a new Durchgang (run/pass) of a COMPLETED set
  // ("Set erneut durcharbeiten"). Opens a simple confirmation; the actual
  // work runs in ``handleConfirmRestartSet``.
  const requestRestartSet = (entry: ContentSetEntry) => {
    setRestartSetTarget(entry);
  };

  // EXP-051 / #2125 — start the new run: the prior run's element-error
  // history is kept (frozen for the Fehlerhistorie), a fresh run opens with
  // cold SRS scheduling, and the set is reactivated so it shows in the
  // active view for reworking. Routes through ``getStorage`` so it works in
  // both storage modes.
  const handleConfirmRestartSet = async () => {
    const target = restartSetTarget;
    if (!target) return;
    const userId = readLearnerState().userId;
    if (!userId) {
      setRestartSetTarget(null);
      return;
    }
    setRestarting(true);
    try {
      await getStorage().elementErrors.startRun(userId, target.id);
      setSets((prev) =>
        prev.map((row) =>
          row.source === target.source && row.id === target.id
            ? { ...row, status: "active" as SetStatus }
            : row,
        ),
      );
      storeSetStatus(target.source, target.id, "active");
      notify.success(
        t(
          "content.set_status.restarted",
          "A new run has started. Your previous run is kept.",
        ),
      );
      setRestartSetTarget(null);
    } catch (err) {
      notify.error(
        t("content.set_status.restart_failed", "Could not start a new run."),
        { error: err },
      );
    } finally {
      setRestarting(false);
    }
  };

  return {
    handleSetStatus,
    handleBulkSetStatus,
    restartSetTarget,
    setRestartSetTarget,
    restarting,
    requestRestartSet,
    handleConfirmRestartSet,
  };
}
