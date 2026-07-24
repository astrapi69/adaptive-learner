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
 *
 * Split (#1799): the page is the composition shell. Its former 17
 * state atoms live in four hooks under ``hooks/content/import/`` —
 * ``useImportDetailData`` (load + linked curriculum/session),
 * ``useImportLanguagePair`` (v1.54.0 import-time pair),
 * ``useConversationAnalysis`` (the #1739-hardened analysis run),
 * ``useImportActions`` (session/curriculum/Anki). Only the two
 * UI-local toggles (save-lesson modal, transcript) stay here.
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useFeature } from "@astrapi69/feature-strategy-react";
import { useApiKeyStatus } from "../../hooks/settings/useApiKeyStatus";

import ApiKeyRequiredNotice from "../../components/settings/ai/ApiKeyRequiredNotice";
import SaveOfflineLessonModal from "../../components/content/lessons/SaveOfflineLessonModal";
import ImportActionBar from "../../components/import/ImportActionBar";
import ImportGenerateExercisesButton from "../../components/import/ImportGenerateExercisesButton";
import GeneratedExercisesPreview from "../../components/import/GeneratedExercisesPreview";
import ImportLanguagePickers from "../../components/import/ImportLanguagePickers";
import AnalysisLoadingSection from "../../components/import/AnalysisLoadingSection";
import AnalysisResultsSection from "../../components/import/AnalysisResultsSection";
import ImportTranscript from "../../components/import/ImportTranscript";
import { FEATURES } from "../../features/featureConfig";
import {
  useConversationAnalysis,
  useImportActions,
  useImportDetailData,
  useImportLanguagePair,
} from "../../hooks/content/import";
import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { readLearnerState } from "../../lib/learning/learnerState";
import { importHeadingTitle } from "../../lib/content/lesson/import-title";
import {
  resolveActiveAiProvider,
  type ResolvedAiProvider,
} from "../../lib/ai/providers/resolve-provider";
import { useTheoryExercises } from "../../hooks/content/useTheoryExercises";

interface ImportDetailProps {
  /** Override the conversation id (tests only). */
  conversationIdOverride?: string;
  onNavigate?: (path: string) => void;
}

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
  // #1133 — only surface the "API key required" notice once the key status is
  // actually known. Before that (``ready=false``), the feature reads disabled
  // (we don't know yet), and showing the notice flashes a false warning to a
  // user who DOES have a key — especially on a direct navigation to this page.
  const { ready: apiKeyReady } = useApiKeyStatus();

  const go = (path: string) => (onNavigate ? onNavigate(path) : navigate(path));

  const {
    detail,
    setDetail,
    loading,
    error,
    existingCurriculum,
    setExistingCurriculum,
    activeSession,
    setActiveSession,
  } = useImportDetailData({ conversationId, t });

  const { sourceLang, targetLang, changeSource, changeTarget } =
    useImportLanguagePair({ detail, setDetail, lang });

  const {
    analyzing,
    analysisPhase,
    analysisDone,
    analysisError,
    runAnalysis,
    cancelAnalysis,
  } = useConversationAnalysis({
    detail,
    setDetail,
    sourceLang,
    targetLang,
    lang,
    t,
  });

  const {
    creatingCurriculum,
    startingSession,
    extractingAnki,
    startOrResumeSession,
    createCurriculumFromAnalysis,
    extractAnkiCards,
  } = useImportActions({
    detail,
    existingCurriculum,
    setExistingCurriculum,
    activeSession,
    setActiveSession,
    go,
    t,
  });

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
        {apiKeyReady && analyzeFeature.isDisabled && (
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
          onSourceChange={changeSource}
          onTargetChange={changeTarget}
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
          {/* #1585: margin/color moved off the legacy `.analysis-error-inline p`
              rule (deleted so the block wraps into @layer legacy) onto the
              element as token-backed utilities - same rendering. */}
          <p className="m-0 text-[var(--error)]">{analysisError}</p>
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
            // #1253 — the saved lesson appears in "My Lessons", which moved
            // to the Import tab.
            go("/content?tab=import");
          }}
        />
      )}
    </main>
  );
}
