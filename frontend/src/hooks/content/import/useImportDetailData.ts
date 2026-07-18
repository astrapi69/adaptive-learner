/**
 * useImportDetailData (#1799 — extracted from ImportDetail.tsx).
 *
 * Loads the conversation detail plus its two linked records: the
 * curriculum already generated from it (Phase 36 Bug 3 — the CTA
 * flips to "Go to curriculum") and the active session (Phase 36
 * Bug 4 — "Start" flips to "Continue"). Both side-lookups tolerate
 * older backends without the endpoints.
 */

import { useEffect, useState } from "react";

import { ApiError } from "../../../api/client";
import { getStorage } from "../../../storage";
import type {
  Curriculum,
  ImportedConversationDetail,
  LearningSession,
} from "../../../types/domain";

/** i18n translate signature (key + fallback). */
type Translate = (key: string, fallback: string) => string;

/**
 * Load the conversation + linked curriculum/session state.
 *
 * @example
 * const data = useImportDetailData({conversationId, t});
 * if (data.loading) return <Spinner />;
 */
export function useImportDetailData({
  conversationId,
  t,
}: {
  conversationId: string;
  t: Translate;
}) {
  const [detail, setDetail] = useState<ImportedConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Phase 36 Bug 3 — track the curriculum already generated from
  // this conversation (if any). The CTA flips from "Create
  // curriculum" to "Go to curriculum" when set, so users no
  // longer accidentally generate duplicates by clicking twice.
  const [existingCurriculum, setExistingCurriculum] =
    useState<Curriculum | null>(null);
  // Phase 36 Bug 4 — same idea for sessions: when there's an
  // active session for this conversation, "Start session" flips
  // into "Continue session" and the click resumes instead of
  // creating a duplicate session.
  const [activeSession, setActiveSession] = useState<LearningSession | null>(
    null,
  );

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getStorage().imports.get(conversationId);
        if (!cancelled) setDetail(d);
        // Phase 36 Bug 3 — load the linked curriculum in
        // parallel; missing endpoint / null result is
        // non-fatal (the CTA just stays on "Create").
        try {
          const linked =
            await getStorage().curricula.getForConversation(conversationId);
          if (!cancelled) setExistingCurriculum(linked);
        } catch {
          // Older backends without the /curriculum lookup
          // endpoint fall through gracefully.
        }
        // Phase 36 Bug 4 — same shape for the active
        // session lookup; missing endpoint / null is
        // non-fatal (CTA stays on "Start session").
        try {
          const sess =
            await getStorage().session.getActiveForConversation(conversationId);
          if (!cancelled) setActiveSession(sess);
        } catch {
          /* tolerate missing endpoint */
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.detail
              : t("import.load_error", "Could not load the conversation.");
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, t]);

  return {
    detail,
    setDetail,
    loading,
    error,
    existingCurriculum,
    setExistingCurriculum,
    activeSession,
    setActiveSession,
  };
}
