/**
 * useInfoHint (#1251) — drives the fading-blink info hint.
 *
 * On mount it records one visit for the given id (capped so storage never
 * grows past the blink window) and decides whether the button should blink:
 * only while the user has never opened the hint AND is still inside the first
 * {@link INFO_BLINK_MAX_VISITS} visits. Opening the hint marks it seen, which
 * stops the blink immediately and forever (persisted across re-mounts).
 *
 * Robust under React's double-mount: the visit number is computed once in a
 * pure initializer (a localStorage read), and the mount effect only *sets*
 * (never increments) that value, so running twice is idempotent.
 */

import { useCallback, useEffect, useState } from "react";

import {
  INFO_BLINK_MAX_VISITS,
  readInfoHint,
  writeInfoHint,
} from "./infoHintPref";

export interface UseInfoHintResult {
  /** Whether the explanatory text is currently expanded. */
  expanded: boolean;
  /** Whether the button should draw the gentle blink. */
  blink: boolean;
  /** Toggle the text and mark the hint seen (stops the blink for good). */
  toggle: () => void;
}

/**
 * @param storageId Per-hint id (one per tab, e.g. ``content_my``).
 */
export function useInfoHint(storageId: string): UseInfoHintResult {
  const [expanded, setExpanded] = useState(false);

  // Snapshot computed once on mount: the recorded visit number for THIS visit
  // (capped at the threshold + 1 sentinel so we stop writing once the window
  // closes), whether it was already seen, and the value to persist (or null
  // when nothing changed -> no write).
  const [snapshot] = useState(() => {
    const current = readInfoHint(storageId);
    if (current.seen) return { seen: true, blink: false, record: null as number | null };
    const recorded = Math.min(current.visits + 1, INFO_BLINK_MAX_VISITS + 1);
    return {
      seen: false,
      blink: recorded <= INFO_BLINK_MAX_VISITS,
      record: recorded !== current.visits ? recorded : null,
    };
  });

  const [seen, setSeen] = useState(snapshot.seen);

  useEffect(() => {
    if (snapshot.record !== null) {
      // SET (not increment) — idempotent under React's double-mount.
      writeInfoHint(storageId, { seen: false, visits: snapshot.record });
    }
    // Run once on mount; snapshot/storageId are stable for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blink = !seen && snapshot.blink;

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
    if (!seen) {
      setSeen(true);
      writeInfoHint(storageId, { seen: true, visits: INFO_BLINK_MAX_VISITS + 1 });
    }
  }, [seen, storageId]);

  return { expanded, blink, toggle };
}
