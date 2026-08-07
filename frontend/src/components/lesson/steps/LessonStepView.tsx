/**
 * The step body of a lesson (extracted from LessonPage for the
 * complexity burn-down #417).
 *
 * Renders the active step's title, the #140 re-read-theory link, and
 * one of three bodies: a theory step (with the back-to-exercise link),
 * a legacy reviewed-fallback panel, or the controlled exercise
 * dispatcher. Owns the dispatcher's ``onComplete`` persistence
 * (per-step result + per-element attempts), extracted verbatim.
 */

import type { Ref } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import TheoryStep from "./TheoryStep";
import StepExamples from "./StepExamples";
import AskAiPanel from "../ask/AskAiPanel";
import ReviewedFallbackPanel from "../summary/ReviewedFallbackPanel";
import { AutoAdvanceSuppressedProvider } from "../../exercises/feedback/auto-advance-gate";
import { ExerciseDispatcher } from "../../exercises";
import type {
  ExerciseHandle,
  ExerciseScored,
} from "../../exercises";
import type { ReadAloudController } from "../../../hooks/lesson/audio/useReadAloud";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useLessonMode } from "../../../hooks/lesson/modes/useLessonMode";
import { useTestMode } from "../../../hooks/lesson/modes/useTestMode";
import { stampHintUsage, wasHintUsed } from "../../../lib/hints/hint-usage";
import { exerciseIdentityOf } from "../../../lib/srs/exercise-identity";
import { stampExamAttempts } from "../../../lib/srs/exam-attempt";
import { formatUserAnswer } from "../../../lib/lesson/result-export";
import { rewriteAnchors } from "../../../lib/lesson/lesson-anchors";
import { getStorage } from "../../../storage";
import type {
  ContentLesson,
  ContentLessonStep,
  LessonProgress,
  LessonStepResult,
  RawAnswer,
} from "../../../storage/types";

interface LessonStepViewProps {
  step: ContentLessonStep;
  lesson: ContentLesson;
  setId: string;
  lessonFilename: string;
  source: string;
  tts: ReadAloudController;
  precedingTheoryIndex: number | null;
  theoryReturnIndex: number | null;
  openTheoryFromExercise: () => void;
  returnToExercise: () => void;
  goToStepById: (stepId: string) => void;
  enteredReviewed: boolean;
  reviewedRaw: RawAnswer | null;
  progress: LessonProgress | null;
  exerciseRef: Ref<ExerciseHandle>;
  learnerUserId: string | null;
  onInteraction: (answerable: boolean) => void;
  onChecked: () => void;
  recordStepResult: (result: LessonStepResult) => Promise<void>;
  /** #1218 — advance to the next step (the lesson's ``goNext``). Threaded
   *  to the exercise so a fully-correct answer can offer an in-context
   *  "Continue" via the success-merge. */
  onAdvance: () => void;
  /** #1218 — localised label for that "Continue" button ("Next" /
   *  "Finish lesson"). */
  advanceLabel: string;
}

/** #140 / #2453 — the "Re-read theory" link shown on an exercise step when a
 *  theory chapter precedes it and the recap aid is on. Self-hiding: returns
 *  null when it should not show, so the caller renders it unconditionally
 *  without carrying the visibility branches itself. The matching renderer
 *  receives this element (theoryLink prop) and places it in its top button
 *  row; every other renderer gets it from the chrome. */
function ExerciseTheoryReadLink({
  stepType,
  precedingTheoryIndex,
  showTheoryRecap,
  onReadTheory,
}: {
  stepType: string;
  precedingTheoryIndex: number | null;
  showTheoryRecap: boolean;
  onReadTheory: () => void;
}) {
  const { t } = useI18n();
  if (stepType === "theory" || precedingTheoryIndex === null || !showTheoryRecap) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto min-h-11 gap-1.5 px-3 py-1.5 text-[var(--fg-secondary)] hover:text-[var(--accent-text)]"
      onClick={onReadTheory}
      data-testid="exercise-theory-link"
    >
      <BookOpen size={14} aria-hidden="true" />
      {t("lesson.exercise.reread_theory", "Re-read theory")}
    </Button>
  );
}

/** The active lesson step: theory, reviewed-fallback, or exercise. */
export default function LessonStepView({
  step,
  lesson,
  setId,
  lessonFilename,
  source,
  tts,
  precedingTheoryIndex,
  theoryReturnIndex,
  openTheoryFromExercise,
  returnToExercise,
  goToStepById,
  enteredReviewed,
  reviewedRaw,
  progress,
  exerciseRef,
  learnerUserId,
  onInteraction,
  onChecked,
  recordStepResult,
  onAdvance,
  advanceLabel,
}: LessonStepViewProps) {
  const { t } = useI18n();
  // Exam mode (#1007): "Re-read theory" is a scaffolding aid — hidden.
  // #1040 — ``mode`` also flags exam-mode attempts so the SRS layer
  // lengthens the review interval for a correct answer under pressure.
  const { showTheoryRecap, mode } = useLessonMode();
  // #2319 test mode: a device walk-through must not pollute the very data it
  // is meant to verify, so NO progress and NO SRS/error rows are written.
  const { enabled: testMode } = useTestMode();

  const handleComplete = async (scored: ExerciseScored) => {
    if (!step.exercise) return;
    // Flip to the "Weiter" phase the moment the answer is graded
    // (Problem 1).
    onChecked();
    // Test mode writes nothing: no per-step progress, no review cards, no
    // error counters. The step still advances (onChecked above).
    if (testMode) return;
    // Persist the user's text-form answer. free_text + word_tiles carry
    // a coherent text answer in the attempt; matching + picture_choice
    // store only a structured raw_answer, so #167 bug 1 reconstructs a
    // readable form (the chosen image label / the user's pairings)
    // instead of leaving it null. cloze stays null (its blanks are
    // diffed in-context).
    const exerciseType = step.exercise.type;
    const stepUserAnswer =
      exerciseType === "free_text" || exerciseType === "word_tiles"
        ? (scored.attempts[0]?.user_answer ?? null)
        : formatUserAnswer(step.exercise, scored.raw_answer ?? null);
    // #594 Hint Economy — whether the learner revealed a hint on this
    // exercise (the ExerciseHint reveal marked it). Persisted on the
    // step result so the summary can count it. Same identity the reveal
    // marked (#2130: stable_id ?? id).
    const hintUsed = wasHintUsed(exerciseIdentityOf(step.exercise) ?? step.exercise.id);
    await recordStepResult({
      step_id: step.id,
      correct: scored.correct,
      total: scored.total,
      user_answer: stepUserAnswer,
      // BUG P1 / Problem 2 — persist the raw answer so a revisit
      // re-renders the exact locked visual.
      raw_answer: scored.raw_answer ?? null,
      hint_used: hintUsed,
    });
    // Phase 46B — persist per-element attempts alongside the per-step
    // score. Failures here MUST NOT block the step from advancing (the
    // per-step score is the user's primary feedback). #594 — stamp the
    // hint flag so the SRS layer shortens this element's interval.
    if (scored.attempts.length > 0 && learnerUserId) {
      try {
        await getStorage().elementErrors.recordBulk(
          learnerUserId,
          // #594 stamp hints, then #1040 stamp the exam flag — the SRS
          // layer shortens hint-assisted intervals and lengthens correct
          // exam intervals.
          stampExamAttempts(stampHintUsage(scored.attempts), mode === "exam"),
        );
      } catch (err) {
        console.warn("elementErrors.recordBulk failed:", err);
      }
    }
  };

  // #140 / #2453 — the self-hiding "Re-read theory" link (visibility lives in
  // ExerciseTheoryReadLink). For a matching step it is handed to the matching
  // renderer (theoryLink prop) so it shares the top button row with the "How
  // it works" disclosure; every other renderer keeps the chrome copy below.
  const theoryLink = (
    <ExerciseTheoryReadLink
      stepType={step.type}
      precedingTheoryIndex={precedingTheoryIndex}
      showTheoryRecap={showTheoryRecap}
      onReadTheory={openTheoryFromExercise}
    />
  );
  const exerciseIsMatching = step.exercise?.type === "matching";

  return (
    <article
      key={step.id}
      className="lesson-step flex-auto"
      data-testid={`lesson-step-${step.id}`}
      data-step-type={step.type}
    >
      {step.title && <h2>{step.title}</h2>}
      {/* #140 — the re-read-theory link, subtle so it doesn't distract from
          practising. #2453 — matching relocates it into its own top button
          row, so the chrome omits its copy for matching steps. The link is
          self-hiding, so it renders directly (no wrapper that could leave an
          empty margin when there is no preceding theory). */}
      {!exerciseIsMatching && <div className="mb-2 empty:hidden">{theoryLink}</div>}
      {step.type === "theory" ? (
        <>
          {theoryReturnIndex !== null && (
            <div className="mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 gap-1.5"
                onClick={returnToExercise}
                data-testid="theory-back-to-exercise"
              >
                <ChevronLeft aria-hidden="true" />
                {t("lesson.exercise.back_to_exercise", "Back to exercise")}
              </Button>
            </div>
          )}
          <TheoryStep
            body={step.body ?? ""}
            stepId={step.id}
            ttsLang={lesson.target_language}
            tts={tts}
            lessonRewriteFn={(s) => rewriteAnchors(s, lesson)}
            onAnchorClick={goToStepById}
            exampleUrl={step.example_url}
            exampleLabel={step.example_label}
            examples={step.examples}
          />
        </>
      ) : enteredReviewed && reviewedRaw === null && step.exercise != null ? (
        // Legacy revisit: the step was completed before raw answers were
        // persisted, so reconstruct nothing — show a compact locked
        // "completed" panel so the learner cannot re-answer it.
        <ReviewedFallbackPanel
          exercise={step.exercise}
          stored={progress?.step_results?.[step.id]}
        />
      ) : (
        <>
          {/* #1326 — inline worked examples shown BEFORE the answer
                    controls, to help the learner understand the task. */}
          {step.exercise?.examples && step.exercise.examples.length > 0 ? (
            <StepExamples
              examples={step.exercise.examples}
              context="exercise"
            />
          ) : null}
          {/* #1921 — a step entered in its already-completed (reviewed)
                    state via Back / resume / deep-link must NOT auto-advance;
                    only a fresh check earns the automatic jump. The manual
                    "Continue" success button stays live regardless. */}
          <AutoAdvanceSuppressedProvider suppressed={enteredReviewed}>
            <ExerciseDispatcher
              ref={exerciseRef}
              controlled
              onInteraction={onInteraction}
              reviewed={reviewedRaw}
              step={step}
              setId={setId}
              lessonId={lessonFilename}
              source={source}
              targetLanguage={lesson.target_language}
              sourceLanguage={lesson.source_language}
              domain={lesson.domain}
              cards={lesson.cards}
              theoryLink={theoryLink}
              onComplete={handleComplete}
              onAdvance={onAdvance}
              advanceLabel={advanceLabel}
            />
          </AutoAdvanceSuppressedProvider>
          {/* #1321 — deepen the current exercise via the existing BYOK AI
                    path. Self-gating (no key → discreet hint). */}
          {step.exercise && (
            <AskAiPanel
              context={{
                kind: "exercise",
                blockText: step.exercise.prompt ?? "",
                targetLanguage: lesson.target_language,
                sourceLanguage: lesson.source_language,
                domain: lesson.domain,
              }}
              testId="ask-ai-exercise"
            />
          )}
        </>
      )}
    </article>
  );
}
