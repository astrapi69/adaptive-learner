/**
 * useTheoryExercises (#826 / AIX-02) — derives the "generate exercises"
 * state for the import-analysis page.
 *
 * Extracted from ``ImportDetail`` so the page stays under the complexity
 * gate: this hook owns the deterministic base-lesson derivation (is the
 * lesson theory-only? what are its theory steps?), the generated-exercise
 * state, and the "previous questions" list a regeneration avoids.
 *
 * Library-grade within the app layer: pure derivation + one piece of
 * state, no DOM, no storage I/O.
 */

import { useMemo, useState } from "react";

import {
  generateLessonFromAnalysis,
  summarizeGeneratedLesson,
} from "../../lib/content/analysis/analysis-to-lesson";
import { analysisLessonLabels } from "../../lib/content/analysis/analysis-lesson-labels";
import type { TheoryStep } from "../../lib/ai/generation/exercise-generation-prompt";
import type { ContentLessonExercise } from "../../storage/types";
import type { ConversationAnalysisResult } from "../../types/domain";

type Translate = (key: string, fallback?: string) => string;

export interface TheoryExercisesState {
  /** True when the analysis lesson has theory but zero exercises. */
  isTheoryOnly: boolean;
  /** The lesson's theory steps (prose context for the AI). */
  theorySteps: TheoryStep[];
  /** Whether the "Generate exercises" button applies (theory-only or
   *  exercises already generated this session). */
  showGenerate: boolean;
  /** Exercises generated this session. */
  generatedExercises: ContentLessonExercise[];
  setGeneratedExercises: (exercises: ContentLessonExercise[]) => void;
  /** Questions of the current generation (avoided on a regeneration). */
  previousQuestions: string[];
}

/** Derive the theory-only / generated-exercise state for an analysis. */
export function useTheoryExercises(
  analysis: ConversationAnalysisResult | null,
  t: Translate,
): TheoryExercisesState {
  const [generatedExercises, setGeneratedExercises] = useState<ContentLessonExercise[]>([]);

  const { isTheoryOnly, theorySteps } = useMemo(() => {
    if (!analysis) return { isTheoryOnly: false, theorySteps: [] as TheoryStep[] };
    try {
      const baseLesson = generateLessonFromAnalysis(analysis, {
        id: "analysis-preview",
        labels: analysisLessonLabels(t),
      });
      const summary = summarizeGeneratedLesson(baseLesson);
      const steps = baseLesson.steps
        .filter((step) => step.type === "theory")
        .map((step) => ({ id: step.id, title: step.title, body: step.body }));
      return {
        isTheoryOnly: summary.theorySteps >= 1 && summary.exercises === 0,
        theorySteps: steps,
      };
    } catch {
      return { isTheoryOnly: false, theorySteps: [] as TheoryStep[] };
    }
  }, [analysis, t]);

  const previousQuestions = useMemo(
    () => generatedExercises.map((exercise) => exercise.sentence ?? exercise.prompt),
    [generatedExercises],
  );

  return {
    isTheoryOnly,
    theorySteps,
    showGenerate: isTheoryOnly || generatedExercises.length > 0,
    generatedExercises,
    setGeneratedExercises,
    previousQuestions,
  };
}
