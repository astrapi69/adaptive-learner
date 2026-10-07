import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { USER_GENERATED_SOURCE } from "../../storage/types";
import type { ContentSetEntry } from "../../storage/types";

/**
 * Open the share flow named by ``?share=<setId>`` once the sets are loaded
 * (#3660). "Save & share" in the lesson creator navigates to
 * ``/content?share=<id>`` after saving; only the learner's own sets can be
 * shared, so a downloaded set with the same id is not a match.
 *
 * The parameter is consumed: it is replaced by ``tab=my`` (unless a tab is
 * already set) so a reload does not reopen the dialog and the hub stays on
 * My content.
 *
 * @example
 * useShareDeepLink({ loading, sets, onShare: (e) => void share.handleShare(e) });
 */
export function useShareDeepLink({
  loading,
  sets,
  onShare,
}: {
  loading: boolean;
  sets: ContentSetEntry[];
  onShare: (entry: ContentSetEntry) => void;
}): void {
  const [params, setParams] = useSearchParams();
  const requested = params.get("share");

  useEffect(() => {
    if (loading || !requested) return;
    const next = new URLSearchParams(params);
    next.delete("share");
    if (!next.has("tab")) next.set("tab", "my");
    setParams(next, { replace: true });
    const entry = sets.find((s) => s.id === requested && s.source === USER_GENERATED_SOURCE);
    if (entry) onShare(entry);
    // Runs once per requested id after loading; sets / onShare change
    // identity on every render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, requested]);
}
