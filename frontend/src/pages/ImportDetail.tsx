/**
 * Import detail page (v0.9.0 / Phase 12E).
 *
 * Shows the full conversation transcript plus AI-analysis
 * results. Three actionable buttons land at the top:
 *
 *   - Analyze         (visible when the conversation is not yet
 *                      analyzed, OR to re-run)
 *   - Create curriculum (auto-generates a Curriculum +
 *                      LearningTopics from suggested_curriculum)
 *   - Start session   (jumps to /session with the project's
 *                      active state — uses the project assigned
 *                      to this conversation when set)
 *
 * Analysis result is rendered as structured cards:
 *   - Topic + Level badge
 *   - Strengths (green), Weaknesses (red), Error patterns (amber)
 *   - Recommended method
 *   - Suggested curriculum lessons (with priority)
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../api/client";
import {Button} from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ApiKeyRequiredNotice from "../components/ApiKeyRequiredNotice";
import HelpLink from "../components/help/HelpLink";
import SaveOfflineLessonModal from "../components/content/SaveOfflineLessonModal";
import { useApiKeyStatus } from "../hooks/useApiKeyStatus";
import { useI18n } from "../hooks/useI18n";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { readLearnerState } from "../lib/learnerState";
import { getStorage } from "../storage";
import { getDb } from "../storage/db";
import { analyzeConversation } from "../chat_import/analysis";
import { LANGUAGE_OPTIONS } from "../lib/content/language-options";
import { detectLearningLanguage } from "../lib/content/detect-chat-language";
import { notify } from "../utils/notify";
import type { AIProvider } from "../lib/constants";
import type {
  ConversationAnalysisResult,
  Curriculum,
  ImportedConversationDetail,
  LearningSession,
} from "../types/domain";

interface ImportDetailProps {
  /** Override the conversation id (tests only). */
  conversationIdOverride?: string;
  onNavigate?: (path: string) => void;
}

/**
 * Fake-progress phase model for the analysis loading panel. The
 * provider call is a single opaque request (no streaming
 * progress), so we cycle through three labelled steps on a timer
 * to make the wait feel intentional rather than frozen. The phase
 * advances every ``ANALYSIS_PHASE_INTERVAL_MS`` and caps at the
 * last step until the real call resolves.
 */
const ANALYSIS_PHASES = [
  "analysis_phase_reading",
  "analysis_phase_analyzing",
  "analysis_phase_preparing",
] as const;
/** English fallbacks, parallel to ANALYSIS_PHASES (for the t() default). */
const ANALYSIS_PHASE_FALLBACKS = [
  "Step 1/3: Reading chat…",
  "Step 2/3: Analyzing content…",
  "Step 3/3: Preparing results…",
];
const ANALYSIS_PHASE_INTERVAL_MS = 4000;
/** Phase-driven progress-bar fill (percent), indexed by phase. */
const ANALYSIS_PHASE_PROGRESS = [20, 60, 90];
/** How long the "Done!" flash lingers before results fade in. */
const ANALYSIS_DONE_FLASH_MS = 500;

export default function ImportDetail({
  conversationIdOverride,
  onNavigate,
}: ImportDetailProps = {}) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = conversationIdOverride ?? params.conversationId ?? "";
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  // Issue 4 — gate the AI-dependent buttons (Analyze,
  // Start Session, Extract Anki) on the active provider
  // having a key. ``ready=false`` means we don't yet know,
  // so buttons stay disabled until the settings fetch
  // resolves.
  const apiKey = useApiKeyStatus();

  const [detail, setDetail] = useState<ImportedConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Loading-indicator state for the analysis run (this branch):
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
  const [creatingCurriculum, setCreatingCurriculum] = useState(false);
  const [extractingAnki, setExtractingAnki] = useState(false);
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
  const [startingSession, setStartingSession] = useState(false);
  // Phase 59B — "Save as Offline Lesson" preview modal.
  const [showSaveLesson, setShowSaveLesson] = useState(false);

  // v1.54.0 — language pair captured at IMPORT time. Source = the chat
  // language (what the learner speaks) defaults to the app language;
  // target = the language being learned, auto-detected from the chat
  // content. Both flow downstream (analysis -> save -> share) so nothing
  // is guessed/patched later. Initialised once per loaded conversation.
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const langInitRef = useRef<string | null>(null);

  const go = (path: string) => (onNavigate ? onNavigate(path) : navigate(path));

  // Initialise the language pair when the conversation loads: keep saved
  // values when present, else app-language source + detected target.
  useEffect(() => {
    if (!detail || langInitRef.current === detail.id) return;
    langInitRef.current = detail.id;
    const app = (lang || "en").split("-")[0];
    setSourceLang((detail.source_language || app).split("-")[0]);
    const savedTarget = detail.target_language
      ? detail.target_language.split("-")[0]
      : "";
    if (savedTarget) {
      setTargetLang(savedTarget);
    } else {
      const text = detail.messages.map((m) => m.content).join("\n");
      setTargetLang(detectLearningLanguage(text, app) ?? "");
    }
  }, [detail, lang]);

  // Persist the chosen languages onto the import record so every
  // downstream step (analysis, save-as-lesson, share) inherits them.
  // Best-effort: a failed write keeps the local selection usable.
  const persistLanguages = async (next: {
    source?: string;
    target?: string;
  }): Promise<void> => {
    if (!detail) return;
    const source_language = next.source ?? sourceLang;
    const target_language = next.target ?? targetLang;
    try {
      await getStorage().imports.update(detail.id, {
        source_language: source_language || null,
        target_language: target_language || null,
      });
      setDetail({ ...detail, source_language, target_language });
    } catch {
      /* non-fatal — keep the in-memory selection */
    }
  };

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

  // Abort any in-flight analysis + clear the phase timer if the
  // user navigates away mid-run (otherwise the fetch keeps going
  // and the interval leaks).
  useEffect(() => {
    return () => {
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
      const modelOverride =
        provider === "anthropic"
          ? settings.model_override_anthropic
          : provider === "openai"
            ? settings.model_override_openai
            : settings.model_override_gemini;
      // Phase 36 Bug 2 — thread the learner's display language
      // through to the analysis prompt so free-text fields come
      // back in DE / ES / FR / etc. instead of always English.
      // Settings.language mirrors User.language; learnerState is
      // the fallback because it's set during onboarding.
      const learnerLang = readLearnerState().language;
      const lang = settings.language || learnerLang || "en";
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
        lang,
        // v1.54.0 — pass the import-time language pair so the analysis
        // prompt knows who is learning what (sharper extraction).
        sourceLanguage: sourceLang || detail.source_language || null,
        targetLanguage: targetLang || detail.target_language || null,
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
      setDetail(updated);
    } catch (err) {
      // A user-triggered cancel returns silently to the
      // pre-analysis state — no error message, no toast.
      if (controller.signal.aborted) {
        return;
      }
      // Friendly INLINE error (not a raw toast). The button
      // re-enables in the finally block so the user can retry.
      setAnalysisError(
        err instanceof ApiError
          ? err.detail
          : t(
              "import.analysis_failed_inline",
              "Analysis failed. Please try again.",
            ),
      );
    } finally {
      stopPhaseTimer();
      if (abortRef.current === controller) abortRef.current = null;
      setAnalyzing(false);
      setAnalysisDone(false);
    }
  }

  async function startOrResumeSession() {
    // Phase 36 Bug 4 — if an active session already exists,
    // navigate to it. Otherwise create a new session linked
    // back to this conversation so the next return-visit
    // resumes instead of duplicating.
    if (!detail || startingSession) return;
    if (activeSession) {
      // Phase 38 Bug 7 — use ``?session=`` so Session.tsx
      // takes the resume path (fetches existing record +
      // chat history) instead of calling start() and
      // creating a new session.
      go(`/session?session=${encodeURIComponent(activeSession.id)}`);
      return;
    }
    const { projectId } = readLearnerState();
    if (!projectId) {
      // No active project — fall back to the generic
      // /session route which routes the user to onboarding.
      // Keeps the legacy behaviour for free-form learners.
      go("/session");
      return;
    }
    setStartingSession(true);
    try {
      const learnerLang = readLearnerState().language;
      const result = await getStorage().session.start({
        project_id: projectId,
        lang: learnerLang ?? "en",
        imported_conversation_id: detail.id,
      });
      // Update the local state in case the user comes back
      // before navigating away.
      setActiveSession(result.session);
      go(`/session?session=${encodeURIComponent(result.session.id)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.session_start_error", "Could not start the session.");
      notify.error(msg, { persistent: true });
    } finally {
      setStartingSession(false);
    }
  }

  async function createCurriculumFromAnalysis() {
    if (!detail?.analysis_result || creatingCurriculum) return;
    // Phase 36 Bug 3 — if a curriculum already exists for this
    // conversation, navigate to it instead of generating a
    // duplicate. The button text already says "Go to
    // curriculum" in this state, but defence in depth: the
    // user might double-click before the state observed the
    // initial load.
    if (existingCurriculum) {
      go(`/curriculum?id=${encodeURIComponent(existingCurriculum.id)}`);
      return;
    }
    const { userId } = readLearnerState();
    if (!userId) {
      notify.error(t("import.no_user", "No active user."));
      return;
    }
    const lessons = detail.analysis_result.suggested_curriculum ?? [];
    if (lessons.length === 0) {
      notify.warning(
        t("import.no_lessons", "The analysis did not suggest any lessons."),
      );
      return;
    }
    setCreatingCurriculum(true);
    try {
      const curriculum = await getStorage().curricula.create(userId, {
        title:
          detail.analysis_result.topic ??
          detail.title ??
          t("import.default_curriculum_title", "Imported curriculum"),
        description:
          detail.analysis_result.summary ??
          t(
            "import.curriculum_description",
            "Generated from an imported conversation.",
          ),
        imported_conversation_id: detail.id,
      });
      setExistingCurriculum(curriculum);
      // Sort by priority before persisting; lower number = higher priority.
      const sorted = [...lessons].sort((a, b) => a.priority - b.priority);
      for (let i = 0; i < sorted.length; i++) {
        const lesson = sorted[i];
        await getStorage().curricula.createTopic(curriculum.id, {
          title: lesson.title,
          description: lesson.description,
          order_index: i,
        });
      }
      notify.success(
        t("import.curriculum_created", "Curriculum created from the analysis."),
      );
      go(`/curriculum?id=${encodeURIComponent(curriculum.id)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.curriculum_error", "Could not create the curriculum.");
      notify.error(msg);
    } finally {
      setCreatingCurriculum(false);
    }
  }

  if (loading) {
    return (
      <main id="main" style={{ padding: "2rem" }}>
        <p>{t("common.loading", "Loading…")}</p>
      </main>
    );
  }
  if (error || !detail) {
    return (
      <main
        id="main"
        style={{ padding: "2rem" }}
        data-testid="import-detail-error"
      >
        <h1>{t("errors.not_found", "Not found.")}</h1>
        <p>{error}</p>
        <Button type="button" onClick={() => go("/import")}>
          {t("import.back_to_list", "Back to imports")}
        </Button>
      </main>
    );
  }

  const analysis = detail.analysis_result;

  return (
    <main
      id="main"
      className="page-import-detail"
      data-testid="page-import-detail"
      style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <Button
          type="button"
          variant="outline"
          onClick={() => go("/import")}
          className="mb-4"
          data-testid="back-to-list"
        >
          ← {t("import.back_to_list", "Back to imports")}
        </Button>
        <h1 style={{ margin: 0 }}>{detail.title}</h1>
        <p style={{ margin: "0.5rem 0 0", opacity: 0.7, fontSize: "0.9rem" }}>
          {detail.source} · {detail.message_count}{" "}
          {t("import.messages", "messages")}
          {detail.model ? ` · ${detail.model}` : ""}
        </p>
        {apiKey.ready && !apiKey.hasKey && (
          <ApiKeyRequiredNotice
            feature={t(
              "ui.api_key.feature_analyze",
              "to analyze conversations",
            )}
          />
        )}
        {/* v1.54.0 — set the language pair BEFORE analysis so it flows
            through the whole pipeline. Source = chat language (app
            default); target = detected learning language. Both editable. */}
        <div
          className="import-language-pickers"
          data-testid="import-language-pickers"
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div className="form-row">
            <span className="form-label">
              {t("import.chat_language", "Chat language (you speak)")}
            </span>
            <Select
              value={sourceLang || undefined}
              onValueChange={(v) => {
                setSourceLang(v);
                void persistLanguages({ source: v });
              }}
            >
              <SelectTrigger data-testid="import-source-language">
                <SelectValue
                  placeholder={t(
                    "import.select_language",
                    "Select a language…",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.name} ({opt.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-row">
            <span className="form-label">
              {t("import.learning_language", "Learning language")}
            </span>
            <Select
              value={targetLang || undefined}
              onValueChange={(v) => {
                setTargetLang(v);
                void persistLanguages({ target: v });
              }}
            >
              <SelectTrigger data-testid="import-target-language">
                <SelectValue
                  placeholder={t(
                    "import.select_language",
                    "Select a language…",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.name} ({opt.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing || !apiKey.ready || !apiKey.hasKey || !online}
            title={
              !online
                ? t("pwa.action_unavailable", "Not available offline")
                : apiKey.ready && !apiKey.hasKey
                  ? t("ui.api_key.required", "API key required.")
                  : undefined
            }
            data-testid="analyze-button"
          >
            {analyzing && (
              <span
                className="btn-spinner"
                data-testid="analyze-spinner"
                aria-hidden="true"
              />
            )}
            {analyzing
              ? t("import.analyzing", "Analyzing…")
              : analysis
                ? t("import.reanalyze", "Re-analyze")
                : t("import.analyze", "Analyze")}
          </Button>
          {analysis && (analysis.suggested_curriculum?.length ?? 0) > 0 && (
            <Button
              type="button"
              variant="secondary"
              // Phase 36 Bug 3 — when a curriculum
              // already exists for this
              // conversation, the click navigates
              // to it (handled inside
              // ``createCurriculumFromAnalysis``).
              // Otherwise the handler generates a
              // new curriculum linked back via the
              // ``imported_conversation_id`` FK.
              onClick={createCurriculumFromAnalysis}
              disabled={creatingCurriculum}
              data-testid={
                existingCurriculum
                  ? "goto-curriculum-button"
                  : "create-curriculum-button"
              }
            >
              {creatingCurriculum
                ? t("common.loading", "Loading…")
                : existingCurriculum
                  ? t("import.go_to_curriculum", "Go to curriculum")
                  : t("import.create_curriculum", "Create curriculum")}
            </Button>
          )}
          {analysis && (
            <Button
              type="button"
              variant="secondary"
              data-testid="save-offline-lesson-button"
              onClick={() => setShowSaveLesson(true)}
            >
              {t("content.save_lesson.button", "Save as Offline Lesson")}
            </Button>
          )}
          {analysis && (
            <Button
              type="button"
              variant="secondary"
              // Phase 36 Bug 4 — when an active
              // session for this conversation
              // already exists, the click navigates
              // back to it. Otherwise we start a
              // new session linked back via the
              // ``imported_conversation_id`` FK so a
              // future return-visit resumes cleanly.
              //
              // Issue 4 — disable when no API key is
              // configured (NEW sessions need AI;
              // resuming an EXISTING session does
              // not, so the gate only fires when
              // ``activeSession`` is null).
              onClick={startOrResumeSession}
              disabled={
                startingSession ||
                (!activeSession && apiKey.ready && !apiKey.hasKey)
              }
              title={
                !activeSession && apiKey.ready && !apiKey.hasKey
                  ? t("ui.api_key.required", "API key required.")
                  : undefined
              }
              data-testid={
                activeSession
                  ? "continue-session-button"
                  : "start-session-button"
              }
            >
              {startingSession
                ? t("common.loading", "Loading…")
                : activeSession
                  ? t("import.continue_session", "Continue session")
                  : t("import.start_session", "Start session")}
            </Button>
          )}
          {analysis && (
            <Button
              type="button"
              variant="secondary"
              disabled={extractingAnki || !apiKey.ready || !apiKey.hasKey}
              title={
                apiKey.ready && !apiKey.hasKey
                  ? t("ui.api_key.required", "API key required.")
                  : undefined
              }
              data-testid="extract-anki-button"
              onClick={async () => {
                if (!detail) return;
                setExtractingAnki(true);
                try {
                  const cards = await getStorage().anki.extractFromConversation(
                    detail.id,
                  );
                  if (cards.length === 0) {
                    notify.info(
                      t("import.anki_no_cards", "No Anki cards extracted."),
                    );
                  } else {
                    notify.success(
                      t(
                        "import.anki_extracted",
                        "Extracted {n} Anki card(s). Review them on the Anki page.",
                      ).replace("{n}", String(cards.length)),
                    );
                  }
                } catch (err) {
                  const msg =
                    err instanceof ApiError
                      ? err.detail
                      : t(
                          "import.anki_extract_failed",
                          "Could not extract Anki cards.",
                        );
                  notify.error(msg);
                } finally {
                  setExtractingAnki(false);
                }
              }}
            >
              {extractingAnki
                ? t("import.anki_extracting", "Extracting cards…")
                : t("import.anki_extract", "Extract Anki cards")}
            </Button>
          )}
        </div>
      </header>

      {analyzing && (
        <section
          className="analysis-loading"
          data-testid="analysis-loading"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="analysis-loading-phase" data-testid="analysis-phase">
            {analysisDone
              ? t("import.analysis_done", "Done!")
              : t(
                  `import.${ANALYSIS_PHASES[analysisPhase]}`,
                  ANALYSIS_PHASE_FALLBACKS[analysisPhase],
                )}
          </p>
          <div
            className="analysis-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              analysisDone ? 100 : ANALYSIS_PHASE_PROGRESS[analysisPhase]
            }
          >
            <div
              className="analysis-progress-fill"
              style={{
                width: `${
                  analysisDone ? 100 : ANALYSIS_PHASE_PROGRESS[analysisPhase]
                }%`,
              }}
            />
          </div>
          {!analysisDone && (
            <p className="analysis-loading-estimate">
              {t(
                "import.analysis_estimate",
                "Analysis takes approximately 15-30 seconds…",
              )}
            </p>
          )}
          {!analysisDone && (
            <Button
              variant="link"
              data-testid="cancel-analysis-button"
              onClick={cancelAnalysis}
              type="button"
            >
              {t("import.analysis_cancel", "Cancel")}
            </Button>
          )}
        </section>
      )}

      {!analyzing && analysisError && (
        <section
          className="analysis-error-inline"
          data-testid="analysis-error-inline"
          aria-live="assertive"
        >
          <p>{analysisError}</p>
        </section>
      )}

      {analysis && (
        <section
          style={{ marginBottom: "2rem" }}
          className="analysis-results-fade-in"
          data-testid="analysis-results"
        >
          <h2>
            {t("import.analysis_title", "Analysis")}
            <HelpLink glossaryKey="feature_conversation_analysis" />
          </h2>
          {analysis.fallback_used && (
            <p
              style={{
                background: "var(--warning-bg)",
                color: "var(--warning)",
                padding: "0.5rem 0.75rem",
                borderRadius: 4,
              }}
              data-testid="analysis-fallback-notice"
            >
              {t(
                "import.analysis_fallback_long",
                "The AI response was not parseable as structured JSON. The summary below is a fallback.",
              )}
            </p>
          )}
          {analysis.summary && (
            <p
              data-testid="analysis-summary"
              style={{
                fontStyle: "italic",
                opacity: 0.9,
              }}
            >
              {analysis.summary}
            </p>
          )}
          <AnalysisGrid result={analysis} t={t} />
        </section>
      )}

      <section data-testid="conversation-transcript">
        <h2>{t("import.transcript", "Transcript")}</h2>
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {detail.messages.map((m) => (
            <li
              key={m.id}
              data-testid={`msg-${m.order_index}`}
              style={{
                background: m.role === "user" ? "var(--surface)" : "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.75rem 1rem",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                  color: m.role === "user" ? "var(--accent)" : "var(--text)",
                }}
              >
                {m.role === "user"
                  ? t("import.role_user", "You")
                  : m.role === "assistant"
                    ? t("import.role_assistant", "AI")
                    : t("import.role_system", "System")}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </li>
          ))}
        </ol>
      </section>
      {analysis && (
        <SaveOfflineLessonModal
          open={showSaveLesson}
          analysis={analysis}
          conversationId={detail.id}
          conversationTitle={detail.title}
          language={readLearnerState().language ?? "en"}
          // v1.54.0 — inherit the import-time language pair so the modal
          // doesn't guess (falls back to its own guess only if absent).
          sourceLanguage={sourceLang || detail.source_language || null}
          targetLanguage={targetLang || detail.target_language || null}
          onCancel={() => setShowSaveLesson(false)}
          onSaved={() => {
            setShowSaveLesson(false);
            go("/content");
          }}
        />
      )}
    </main>
  );
}

function AnalysisGrid({
  result,
  t,
}: {
  result: ConversationAnalysisResult;
  t: (k: string, fb?: string) => string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "0.75rem",
        marginTop: "1rem",
      }}
    >
      {result.topic && (
        <Card title={t("import.field_topic", "Topic")} tone="default">
          {result.topic}
          {result.user_level && (
            <span
              style={{
                marginLeft: "0.5rem",
                padding: "0.15rem 0.5rem",
                borderRadius: 3,
                background: "var(--accent)",
                color: "white",
                fontSize: "0.75rem",
                textTransform: "uppercase",
              }}
            >
              {result.user_level}
            </span>
          )}
        </Card>
      )}
      {result.recommended_method && (
        <Card
          title={t("import.field_method", "Recommended method")}
          tone="default"
        >
          {result.recommended_method}
          {result.recommended_focus && (
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.85rem",
                opacity: 0.8,
              }}
            >
              {result.recommended_focus}
            </p>
          )}
        </Card>
      )}
      {result.strengths && result.strengths.length > 0 && (
        <Card title={t("import.field_strengths", "Strengths")} tone="ok">
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {result.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.weaknesses && result.weaknesses.length > 0 && (
        <Card title={t("import.field_weaknesses", "Weaknesses")} tone="bad">
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {result.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.error_patterns && result.error_patterns.length > 0 && (
        <Card title={t("import.field_errors", "Error patterns")} tone="warn">
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {result.error_patterns.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.subtopics && result.subtopics.length > 0 && (
        <Card title={t("import.field_subtopics", "Subtopics")} tone="default">
          {result.subtopics.join(" · ")}
        </Card>
      )}
      {result.suggested_curriculum &&
        result.suggested_curriculum.length > 0 && (
          <Card
            title={t("import.field_curriculum", "Suggested curriculum")}
            tone="default"
            wide
          >
            <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {result.suggested_curriculum.map((l, i) => (
                <li
                  key={i}
                  data-testid={`lesson-${i}`}
                  style={{ marginBottom: "0.5rem" }}
                >
                  <strong>{l.title}</strong>{" "}
                  <small style={{ opacity: 0.6 }}>
                    ({t("import.priority", "priority")} {l.priority})
                  </small>
                  {l.description && (
                    <p
                      style={{
                        margin: "0.15rem 0 0",
                        opacity: 0.85,
                      }}
                    >
                      {l.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}
    </div>
  );
}

function Card({
  title,
  tone,
  wide,
  children,
}: {
  title: string;
  tone: "ok" | "bad" | "warn" | "default";
  wide?: boolean;
  children: React.ReactNode;
}) {
  const toneStyles: Record<typeof tone, React.CSSProperties> = {
    ok: { borderColor: "var(--success)" },
    bad: { borderColor: "var(--danger)" },
    warn: { borderColor: "var(--warning)" },
    default: {},
  };
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "0.75rem 1rem",
        background: "var(--surface)",
        gridColumn: wide ? "1 / -1" : undefined,
        ...toneStyles[tone],
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{title}</h3>
      {children}
    </div>
  );
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
