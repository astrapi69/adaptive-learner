/**
 * useConversationAnalysis (#1799 — extracted from ImportDetail.tsx).
 *
 * The AI analysis run of an imported conversation: the timed
 * fake-progress phases, the "Done!" flash, the friendly INLINE
 * error (not a raw toast), user cancel via AbortController, and the
 * #1739 unmount semantics — the cleanup aborts the in-flight run
 * and the suspended continuation skips every late state update
 * (a post-teardown setState crashed the vitest run with "window is
 * not defined").
 */

import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api/client";
import { getStorage } from "../../../storage";
import { getDb } from "../../../storage/dexie/db";
import { analyzeConversation } from "../../../chat_import/analysis";
import {
  ANALYSIS_PHASES,
  ANALYSIS_PHASE_INTERVAL_MS,
} from "../../../lib/content/analysis/analysis-phases";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { notify } from "../../../utils/notify";
import type { AIProvider } from "../../../lib/constants";
import type { ImportedConversationDetail } from "../../../types/domain";

/** i18n translate signature (key + fallback). */
type Translate = (key: string, fallback: string) => string;

/** How long the "Done!" flash lingers before results fade in. */
const ANALYSIS_DONE_FLASH_MS = 500;

/** The three per-provider model-override fields ``runAnalysis`` reads. */
type AnalysisModelOverrides = {
  model_override_anthropic: string | null;
  model_override_openai: string | null;
  model_override_gemini: string | null;
};

/**
 * The active provider's model override (#1750 — extracted from
 * ``runAnalysis`` so the handler stays under the complexity gate). Pure;
 * behaviour-identical to the prior inline ternary.
 */
export function pickModelOverride(
  provider: AIProvider,
  settings: AnalysisModelOverrides,
): string | null {
  if (provider === "anthropic") return settings.model_override_anthropic;
  if (provider === "openai") return settings.model_override_openai;
  return settings.model_override_gemini;
}

/**
 * Resolve the analysis prompt language: the live UI language wins, then the
 * saved setting, then the learner default, then ``"en"`` (#803 rationale;
 * extracted in #1750). Pure.
 */
export function resolveAnalysisLang(
  uiLang: string | null | undefined,
  settingsLang: string | null | undefined,
  learnerLang: string | null | undefined,
): string {
  return uiLang || settingsLang || learnerLang || "en";
}

/** First non-empty language of a captured pair side, else ``null`` (#1750). */
export function firstLang(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  return primary || fallback || null;
}

async function readApiKeyFor(
  userId: string,
  provider: AIProvider,
): Promise<string | null> {
  try {
    const db = getDb();
    const row = await db.userSettings.where("user_id").equals(userId).first();
    if (!row) return null;
    if (provider === "anthropic") return row.api_key_anthropic ?? null;
    if (provider === "openai") return row.api_key_openai ?? null;
    if (provider === "gemini") return row.api_key_gemini ?? null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Own the conversation-analysis run state + lifecycle.
 *
 * @example
 * const analysisRun = useConversationAnalysis({
 *     detail, setDetail, sourceLang, targetLang, lang, t,
 * });
 * <ImportActionBar analyzing={analysisRun.analyzing}
 *     onAnalyze={analysisRun.runAnalysis} ... />
 */
export function useConversationAnalysis({
  detail,
  setDetail,
  sourceLang,
  targetLang,
  lang,
  t,
}: {
  detail: ImportedConversationDetail | null;
  setDetail: (next: ImportedConversationDetail) => void;
  sourceLang: string;
  targetLang: string;
  lang: string;
  t: Translate;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  // Loading-indicator state for the analysis run:
  //   - analysisPhase: index into ANALYSIS_PHASES (timed fake
  //     progress, capped at the last step).
  //   - analysisDone: brief "Done!" flash before results fade in.
  //   - analysisError: friendly inline message on failure (NOT a
  //     raw toast); the button re-enables so the user can retry.
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Abort any in-flight analysis + clear the phase timer if the
  // user navigates away mid-run (otherwise the fetch keeps going
  // and the interval leaks). ``mountedRef`` lets the suspended
  // ``runAnalysis`` continuation skip its late state updates after
  // unmount (#1739 — a post-teardown setState crashed the vitest
  // run with "window is not defined").
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (phaseTimerRef.current !== null) {
        clearInterval(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    };
  }, []);

  function stopPhaseTimer() {
    if (phaseTimerRef.current !== null) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }

  function cancelAnalysis() {
    abortRef.current?.abort();
  }

  async function runAnalysis() {
    if (!detail || analyzing) return;
    const { userId } = readLearnerState();
    if (!userId) {
      notify.error(t("import.no_user", "No active user."));
      return;
    }
    setAnalysisError(null);
    setAnalysisDone(false);
    setAnalysisPhase(0);
    setAnalyzing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    // Timed fake-progress: advance through the labelled phases,
    // capping at the last one until the real call resolves.
    phaseTimerRef.current = setInterval(() => {
      setAnalysisPhase((p) => Math.min(p + 1, ANALYSIS_PHASES.length - 1));
    }, ANALYSIS_PHASE_INTERVAL_MS);
    try {
      const settings = await getStorage().settings.get(userId);
      const provider = settings.active_provider as AIProvider;
      const apiKey = await readApiKeyFor(userId, provider);
      if (!apiKey) {
        notify.warning(
          t(
            "import.no_api_key",
            "Set an API key for the active AI provider in Settings to enable analysis.",
          ),
        );
        return;
      }
      // #1739 — the unmount cleanup aborts the controller while this
      // function may still be suspended on the storage reads above.
      // Bail before dialing the provider so no call escapes the
      // component's lifetime.
      if (controller.signal.aborted) {
        return;
      }
      const modelOverride = pickModelOverride(provider, settings);
      // #803 — thread the ACTIVE UI display language into the analysis
      // prompt so free-text fields come back in the language the user
      // actually selected. The live ``lang`` from ``useI18n()`` is the
      // source of truth (it reflects the user's current choice);
      // ``settings.language`` can be stale / out of sync, which made the
      // analysis come back in the wrong language. learnerState is the
      // last fallback (set during onboarding).
      const learnerLang = readLearnerState().language;
      const analysisLang = resolveAnalysisLang(
        lang,
        settings.language,
        learnerLang,
      );
      const result = await analyzeConversation({
        provider,
        apiKey,
        modelOverride,
        messages: detail.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ?? undefined,
        })),
        title: detail.title,
        lang: analysisLang,
        // v1.54.0 — pass the import-time language pair so the analysis
        // prompt knows who is learning what (sharper extraction).
        sourceLanguage: firstLang(sourceLang, detail.source_language),
        targetLanguage: firstLang(targetLang, detail.target_language),
        signal: controller.signal,
      });
      const updated = await getStorage().imports.saveAnalysis(detail.id, {
        analysis_result: result,
      });
      // Success transition: stop the ticker, fill the bar, flash
      // "Done!" briefly, then reveal the (fade-in) results.
      stopPhaseTimer();
      setAnalysisPhase(ANALYSIS_PHASES.length - 1);
      setAnalysisDone(true);
      if (result.fallback_used) {
        notify.warning(
          t(
            "import.analysis_fallback",
            "Analysis ran but the AI response could not be parsed cleanly.",
          ),
        );
      } else {
        notify.success(t("import.analysis_ready", "Analysis ready."));
      }
      await new Promise((resolve) =>
        setTimeout(resolve, ANALYSIS_DONE_FLASH_MS),
      );
      if (mountedRef.current) {
        setDetail(updated);
      }
    } catch (err) {
      // A user-triggered cancel returns silently to the
      // pre-analysis state — no error message, no toast.
      if (controller.signal.aborted) {
        return;
      }
      // Friendly INLINE error (not a raw toast). The button
      // re-enables in the finally block so the user can retry.
      if (mountedRef.current) {
        setAnalysisError(
          err instanceof ApiError
            ? err.detail
            : t(
                "import.analysis_failed_inline",
                "Analysis failed. Please try again.",
              ),
        );
      }
    } finally {
      stopPhaseTimer();
      if (abortRef.current === controller) abortRef.current = null;
      // #1739 — after unmount these setState calls are at best no-ops
      // and, when the test environment is already torn down, crash
      // with "window is not defined" as an unhandled rejection.
      if (mountedRef.current) {
        setAnalyzing(false);
        setAnalysisDone(false);
      }
    }
  }

  return {
    analyzing,
    analysisPhase,
    analysisDone,
    analysisError,
    runAnalysis,
    cancelAnalysis,
  };
}
