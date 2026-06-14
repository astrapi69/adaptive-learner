/**
 * Action bar for the import-detail page (extracted from ImportDetail for
 * the complexity burn-down #419).
 *
 * Renders the analyze / create-curriculum / save-lesson / start-session /
 * extract-anki buttons. Each button is its own self-gating component so
 * its inline disabled / title / label conditionals live in their own
 * scope. Behaviour-preserving: all data-testids, titles, and copy are
 * unchanged.
 */

import { Button } from "@/components/ui/button";
import type {
  ConversationAnalysisResult,
  Curriculum,
  LearningSession,
} from "../../types/domain";

type Translate = (key: string, fallback?: string) => string;

/** The slice of a feature-strategy result the buttons consume. */
interface FeatureGate {
  isActive: boolean;
  isDisabled: boolean;
  reason?: string;
}

interface ImportActionBarProps {
  t: Translate;
  online: boolean;
  analysis: ConversationAnalysisResult | null | undefined;
  analyzing: boolean;
  analyzeFeature: FeatureGate;
  onAnalyze: () => void;
  creatingCurriculum: boolean;
  existingCurriculum: Curriculum | null;
  onCurriculum: () => void;
  onSaveLesson: () => void;
  sessionFeature: FeatureGate;
  startingSession: boolean;
  activeSession: LearningSession | null;
  onSession: () => void;
  ankiFeature: FeatureGate;
  extractingAnki: boolean;
  onExtractAnki: () => void;
}

/** Analyze / curriculum / save-lesson / session / anki action buttons. */
export default function ImportActionBar(props: ImportActionBarProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <AnalyzeButton {...props} />
      <CurriculumButton {...props} />
      <SaveLessonButton {...props} />
      <SessionButton {...props} />
      <AnkiButton {...props} />
    </div>
  );
}

function AnalyzeButton({
  t,
  online,
  analysis,
  analyzing,
  analyzeFeature,
  onAnalyze,
}: ImportActionBarProps) {
  return (
    <Button
      type="button"
      onClick={onAnalyze}
      disabled={analyzing || !analyzeFeature.isActive || !online}
      title={
        !online
          ? t("pwa.action_unavailable", "Not available offline")
          : analyzeFeature.isDisabled
            ? t(`feature.${analyzeFeature.reason}`, "API key required.")
            : undefined
      }
      data-testid="analyze-button"
    >
      {analyzing && (
        <span className="btn-spinner" data-testid="analyze-spinner" aria-hidden="true" />
      )}
      {analyzing
        ? t("import.analyzing", "Analyzing…")
        : analysis
          ? t("import.reanalyze", "Re-analyze")
          : t("import.analyze", "Analyze")}
    </Button>
  );
}

function CurriculumButton({
  t,
  analysis,
  creatingCurriculum,
  existingCurriculum,
  onCurriculum,
}: ImportActionBarProps) {
  const hasCurriculum = !!analysis && (analysis.suggested_curriculum?.length ?? 0) > 0;
  if (!hasCurriculum) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      // Phase 36 Bug 3 — when a curriculum already exists for this
      // conversation, the click navigates to it (handled inside
      // ``createCurriculumFromAnalysis``). Otherwise the handler
      // generates a new curriculum linked back via the
      // ``imported_conversation_id`` FK.
      onClick={onCurriculum}
      disabled={creatingCurriculum}
      data-testid={
        existingCurriculum ? "goto-curriculum-button" : "create-curriculum-button"
      }
    >
      {creatingCurriculum
        ? t("common.loading", "Loading…")
        : existingCurriculum
          ? t("import.go_to_curriculum", "Go to curriculum")
          : t("import.create_curriculum", "Create curriculum")}
    </Button>
  );
}

function SaveLessonButton({ t, analysis, onSaveLesson }: ImportActionBarProps) {
  if (!analysis) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      data-testid="save-offline-lesson-button"
      onClick={onSaveLesson}
    >
      {t("content.save_lesson.button", "Save as Offline Lesson")}
    </Button>
  );
}

function SessionButton({
  t,
  analysis,
  sessionFeature,
  startingSession,
  activeSession,
  onSession,
}: ImportActionBarProps) {
  if (!analysis) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      // Phase 36 Bug 4 — when an active session for this conversation
      // already exists, the click navigates back to it. Otherwise we
      // start a new session linked back via the
      // ``imported_conversation_id`` FK so a future return-visit resumes
      // cleanly.
      //
      // Issue 4 — disable when no API key is configured (NEW sessions
      // need AI; resuming an EXISTING session does not, so the gate only
      // fires when ``activeSession`` is null).
      onClick={onSession}
      disabled={startingSession || (!activeSession && sessionFeature.isDisabled)}
      title={
        !activeSession && sessionFeature.isDisabled
          ? t(`feature.${sessionFeature.reason}`, "API key required.")
          : undefined
      }
      data-testid={activeSession ? "continue-session-button" : "start-session-button"}
    >
      {startingSession
        ? t("common.loading", "Loading…")
        : activeSession
          ? t("import.continue_session", "Continue session")
          : t("import.start_session", "Start session")}
    </Button>
  );
}

function AnkiButton({
  t,
  analysis,
  ankiFeature,
  extractingAnki,
  onExtractAnki,
}: ImportActionBarProps) {
  if (!analysis) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={extractingAnki || ankiFeature.isDisabled}
      title={
        ankiFeature.isDisabled
          ? t(`feature.${ankiFeature.reason}`, "API key required.")
          : undefined
      }
      data-testid="extract-anki-button"
      onClick={onExtractAnki}
    >
      {extractingAnki
        ? t("import.anki_extracting", "Extracting cards…")
        : t("import.anki_extract", "Extract Anki cards")}
    </Button>
  );
}
