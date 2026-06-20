/**
 * ImportGenerateExercisesButton (#826 / AIX-02) — the import-page wrapper
 * around {@link GenerateExercisesButton}.
 *
 * Holds the "should this action show?" decision (an analysis exists AND the
 * lesson is theory-only / already has generated exercises) so the
 * ImportDetail page body stays under the complexity gate. Renders nothing
 * when the action does not apply.
 */

import GenerateExercisesButton, {
  type ResolvedAiProvider,
} from "./GenerateExercisesButton";
import type { TheoryStep } from "../../lib/ai/exercise-generation-prompt";
import type { ContentLessonExercise } from "../../storage/types";
import type { ConversationAnalysisResult } from "../../types/domain";

type Translate = (key: string, fallback?: string) => string;

interface Props {
  analysis: ConversationAnalysisResult | null | undefined;
  show: boolean;
  theorySteps: TheoryStep[];
  /** Source/content language for the generated exercises. */
  sourceLang: string;
  generatedExercises: ContentLessonExercise[];
  previousQuestions: string[];
  resolveProvider: () => Promise<ResolvedAiProvider | null>;
  onGenerated: (exercises: ContentLessonExercise[]) => void;
  t: Translate;
}

/** Renders the generate-exercises action only when it applies. */
export default function ImportGenerateExercisesButton({
  analysis,
  show,
  theorySteps,
  sourceLang,
  generatedExercises,
  previousQuestions,
  resolveProvider,
  onGenerated,
  t,
}: Props) {
  if (!analysis || !show) return null;
  return (
    <GenerateExercisesButton
      theorySteps={theorySteps}
      language={sourceLang || undefined}
      hasGenerated={generatedExercises.length > 0}
      previousQuestions={previousQuestions}
      resolveProvider={resolveProvider}
      onGenerated={onGenerated}
      t={t}
    />
  );
}
