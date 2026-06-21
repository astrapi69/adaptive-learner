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

import { ApiError } from "../../api/client";
import { Button } from "@/components/ui/button";
import { useFeature } from "@astrapi69/feature-strategy-react";

import ApiKeyRequiredNotice from "../../components/settings/ai/ApiKeyRequiredNotice";
import SaveOfflineLessonModal from "../../components/content/lessons/SaveOfflineLessonModal";
import ImportActionBar from "../../components/import/ImportActionBar";
import ImportGenerateExercisesButton from "../../components/import/ImportGenerateExercisesButton";
import GeneratedExercisesPreview from "../../components/import/GeneratedExercisesPreview";
import ImportLanguagePickers from "../../components/import/ImportLanguagePickers";
import AnalysisLoadingSection from "../../components/import/AnalysisLoadingSection";
import AnalysisResultsSection from "../../components/import/AnalysisResultsSection";
import ImportTranscript from "../../components/import/ImportTranscript";
import {
  ANALYSIS_PHASES,
  ANALYSIS_PHASE_INTERVAL_MS,
} from "../../lib/content/analysis/analysis-phases";
import { FEATURES } from "../../features/featureConfig";
import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { readLearnerState } from "../../lib/learning/learnerState";
import { getStorage } from "../../storage";
import { getDb } from "../../storage/dexie/db";
import { analyzeConversation } from "../../chat_import/analysis";
import { importHeadingTitle } from "../../lib/content/lesson/import-title";
import { detectLearningLanguage } from "../../lib/content/language/detect-chat-language";
import {
  resolveActiveAiProvider,
  type ResolvedAiProvider,
} from "../../lib/ai/resolve-provider";
import { useTheoryExercises } from "../../hooks/content/useTheoryExercises";
import { notify } from "../../utils/notify";
import type { AIProvider } from "../../lib/constants";
import type {
  Curriculum,
  ImportedConversationDetail,
  LearningSession,
} from "../../types/domain";

interface ImportDetailProps {
  /** Override the conversation id (tests only). */
  conversationIdOverride?: string;
  onNavigate?: (path: string) => void;
}

/** How long the "Done!" flash lingers before results fade in. */
const ANALYSIS_DONE_FLASH_MS = 500;

/** Resolve the active conversation id: explicit test override wins, else the
 * route param, else an empty string. Extracted to keep the component function
 * below the complexity gate. */
function resolveConversationId(
  override: string | undefined,
  routeParam: string | undefined,
): string {
  return override ?? routeParam ?? "";
}

export default function ImportDetail({
  conversationIdOverride,
  onNavigate,
}: ImportDetailProps = {}) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = resolveConversationId(
    conversationIdOverride,
    params.conversationId,
  );
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  // Issue 4 — gate the AI-dependent buttons (Analyze,
  // Start Session, Extract Anki) on the active provider
  // having a key. ``ready=false`` means we don't yet know,
  // so buttons stay disabled until the settings fetch
  // resolves.
  const analyzeFeature = useFeature(FEATURES.CONVERSATION_ANALYZE);
  const sessionFeature = useFeature(FEATURES.SESSION_START);
  const ankiFeature = useFeature(FEATURES.ANKI_EXTRACT);

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
  const [existingCurriculum, setExistingCurriculum] = useState<Curriculum | null>(null);
  // Phase 36 Bug 4 — same idea for sessions: when there's an
  // active session for this conversation, "Start session" flips
  // into "Continue session" and the click resumes instead of
  // creating a duplicate session.
  const [activeSession, setActiveSession] = useState<LearningSession | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  // Phase 59B — "Save as Offline Lesson" preview modal.
  const [showSaveLesson, setShowSaveLesson] = useState(false);
  // AIX-02 (#826) — theory-only detection + generated-exercise state
  // (derivation extracted into the hook to keep this page under the
  // complexity gate). ``detail`` may be null on the first render.
  const {
    theorySteps,
    showGenerate,
    generatedExercises,
    setGeneratedExercises,
    previousQuestions,
  } = useTheoryExercises(detail?.analysis_result ?? null, t);
  // #240 — the raw transcript is collapsed by default so the analysis
  // results stay front-and-center; long chats no longer bury them.
  const [transcriptOpen, setTranscriptOpen] = useState(false);

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
    const savedTarget = detail.target_language ? detail.target_language.split("-")[0] : "";
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
  const persistLanguages = async (next: { source?: string; target?: string }): Promise<void> => {
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
          const linked = await getStorage().curricula.getForConversation(conversationId);
          if (!cancelled) setExistingCurriculum(linked);
        } catch {
          // Older backends without the /curriculum lookup
          // endpoint fall through gracefully.
        }
        // Phase 36 Bug 4 — same shape for the active
        // session lookup; missing endpoint / null is
        // non-fatal (CTA stays on "Start session").
        try {
          const sess = await getStorage().session.getActiveForConversation(conversationId);
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
      // #803 — thread the ACTIVE UI display language into the analysis
      // prompt so free-text fields come back in the language the user
      // actually selected. The live ``lang`` from ``useI18n()`` is the
      // source of truth (it reflects the user's current choice);
      // ``settings.language`` can be stale / out of sync, which made the
      // analysis come back in the wrong language. learnerState is the
      // last fallback (set during onboarding).
      const learnerLang = readLearnerState().language;
      const analysisLang = lang || settings.language || learnerLang || "en";
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
      await new Promise((resolve) => setTimeout(resolve, ANALYSIS_DONE_FLASH_MS));
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
          : t("import.analysis_failed_inline", "Analysis failed. Please try again."),
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
      notify.warning(t("import.no_lessons", "The analysis did not suggest any lessons."));
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
          t("import.curriculum_description", "Generated from an imported conversation."),
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
      notify.success(t("import.curriculum_created", "Curriculum created from the analysis."));
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

  async function extractAnkiCards() {
    if (!detail) return;
    setExtractingAnki(true);
    try {
      const cards = await getStorage().anki.extractFromConversation(detail.id);
      if (cards.length === 0) {
        notify.info(t("import.anki_no_cards", "No Anki cards extracted."));
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
          : t("import.anki_extract_failed", "Could not extract Anki cards.");
      notify.error(msg);
    } finally {
      setExtractingAnki(false);
    }
  }

  // AIX-02 (#826) — resolve the active provider's config for browser-direct
  // exercise generation. Returns null when no key is configured (the button
  // then shows the inline "API key required" notice).
  async function resolveExerciseProvider(): Promise<ResolvedAiProvider | null> {
    const { userId } = readLearnerState();
    if (!userId) return null;
    return resolveActiveAiProvider(userId);
  }

  if (loading) {
    return (
      <main id="main" className="p-8">
        <p>{t("common.loading", "Loading…")}</p>
      </main>
    );
  }
  if (error || !detail) {
    return (
      <main id="main" className="p-8" data-testid="import-detail-error">
        <h1>{t("errors.not_found", "Not found.")}</h1>
        <p>{error}</p>
        <Button type="button" onClick={() => go("/content?tab=import")}>
          {t("import.back_to_list", "Back to imports")}
        </Button>
      </main>
    );
  }

  const analysis = detail.analysis_result;

  return (
    <main
      id="main"
      className="page-import-detail max-w-4xl mx-auto p-6"
      data-testid="page-import-detail"
    >
      <header className="mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => go("/content?tab=import")}
          className="mb-4"
          data-testid="back-to-list"
        >
          ← {t("import.back_to_list", "Back to imports")}
        </Button>
        <h1 className="m-0" data-testid="import-detail-title">
          {importHeadingTitle(detail.title, analysis?.topic)}
        </h1>
        <p className="mt-2 mb-0 text-sm text-fg-muted">
          {detail.source} · {detail.message_count} {t("import.messages", "messages")}
          {detail.model ? ` · ${detail.model}` : ""}
        </p>
        {analyzeFeature.isDisabled && (
          <ApiKeyRequiredNotice
            feature={t("ui.api_key.feature_analyze", "to analyze conversations")}
          />
        )}
        {/* v1.54.0 — set the language pair BEFORE analysis so it flows
            through the whole pipeline. Source = chat language (app
            default); target = detected learning language. Both editable. */}
        <ImportLanguagePickers
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceChange={(v) => {
            setSourceLang(v);
            void persistLanguages({ source: v });
          }}
          onTargetChange={(v) => {
            setTargetLang(v);
            void persistLanguages({ target: v });
          }}
          t={t}
        />
        <ImportActionBar
          t={t}
          online={online}
          analysis={analysis}
          analyzing={analyzing}
          analyzeFeature={analyzeFeature}
          onAnalyze={runAnalysis}
          creatingCurriculum={creatingCurriculum}
          existingCurriculum={existingCurriculum}
          onCurriculum={createCurriculumFromAnalysis}
          onSaveLesson={() => setShowSaveLesson(true)}
          sessionFeature={sessionFeature}
          startingSession={startingSession}
          activeSession={activeSession}
          onSession={startOrResumeSession}
          ankiFeature={ankiFeature}
          extractingAnki={extractingAnki}
          onExtractAnki={extractAnkiCards}
          extraActions={
            <ImportGenerateExercisesButton
              analysis={analysis}
              show={showGenerate}
              theorySteps={theorySteps}
              sourceLang={sourceLang}
              generatedExercises={generatedExercises}
              previousQuestions={previousQuestions}
              resolveProvider={resolveExerciseProvider}
              onGenerated={setGeneratedExercises}
              t={t}
            />
          }
        />
      </header>

      <AnalysisLoadingSection
        analyzing={analyzing}
        analysisPhase={analysisPhase}
        analysisDone={analysisDone}
        onCancel={cancelAnalysis}
        t={t}
      />

      {!analyzing && analysisError && (
        <section
          className="analysis-error-inline"
          data-testid="analysis-error-inline"
          aria-live="assertive"
        >
          <p>{analysisError}</p>
        </section>
      )}

      <AnalysisResultsSection analysis={analysis} t={t} />

      <GeneratedExercisesPreview exercises={generatedExercises} t={t} />

      <ImportTranscript
        messages={detail.messages}
        messageCount={detail.message_count}
        open={transcriptOpen}
        onToggle={() => setTranscriptOpen((v) => !v)}
        t={t}
      />
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
          extraExercises={generatedExercises}
          onCancel={() => setShowSaveLesson(false)}
          onSaved={() => {
            setShowSaveLesson(false);
            go("/content?tab=my");
          }}
        />
      )}
    </main>
  );
}

async function readApiKeyFor(userId: string, provider: AIProvider): Promise<string | null> {
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
