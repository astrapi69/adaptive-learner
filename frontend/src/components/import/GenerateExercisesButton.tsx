/**
 * AIX-02 / AIX-05 (EXP-036) — "Generate exercises" button for theory-only
 * lessons, with a feedback-driven regeneration loop.
 *
 * A chat-imported lesson with prose theory but no exercises is read-only.
 * This button lets the user spend their own API tokens to turn the theory
 * into practiseable exercises (AIX-01 engine + AIX-03 quality gate +
 * AIX-04 balancing), in both storage modes (the provider config is
 * resolved by the caller, so Dexie resolves it browser-direct and a future
 * API path can inject its own).
 *
 * AIX-05: the FIRST generation is one click. A REGENERATION opens a
 * feedback dialog (too easy / too hard / wrong language / more variety /
 * free text); the choice becomes prompt feedback and the previous
 * questions are sent as "avoid these", so the new set is genuinely
 * different. A lesson allows at most {@link MAX_REGENERATIONS}
 * regenerations; after that the button disables with an explanatory note.
 *
 * Self-contained: it owns the spinner, the no-key notice, the feedback
 * dialog, the retry counter, and the success/error toasts. The AI engine
 * is injected (``generate``) so the unit test runs without a real network
 * call.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import ApiKeyRequiredNotice from "../ApiKeyRequiredNotice";
import RegenerateFeedbackDialog, {
  feedbackForReason,
  type RegenerateFeedback,
} from "./RegenerateFeedbackDialog";
import {
  browserDirectProvider,
  generateExercises as defaultGenerate,
} from "../../lib/ai/generate-exercises";
import { cardsToExercises } from "../../lib/ai/cards-to-exercises";
import type { TheoryStep } from "../../lib/ai/exercise-generation-prompt";
import { LANGUAGE_OPTIONS } from "../../lib/content/language-options";
import type { AIProvider } from "../../lib/constants";
import type { ContentLessonExercise } from "../../storage/types";
import { notify } from "../../utils/notify";

type Translate = (key: string, fallback?: string) => string;

/** Provider config resolved by the caller (mode-specific). */
export interface ResolvedAiProvider {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/** Max regenerations per lesson before the button disables (AIX-05). */
export const MAX_REGENERATIONS = 3;

interface GenerateExercisesButtonProps {
  /** The lesson's theory steps (prose context for the AI). */
  theorySteps: TheoryStep[];
  /** Target language for the exercises (BCP47-ish); optional. */
  language?: string;
  /** True once exercises were already generated -> "Regenerate" + feedback. */
  hasGenerated: boolean;
  /** Questions from the current generation, sent as "avoid these" on a
   *  regeneration so the new set is fresh (AIX-05). */
  previousQuestions?: string[];
  /**
   * Resolve the active provider's config, or ``null`` when no key is set.
   * The Dexie caller reads it from IndexedDB settings (browser-direct).
   */
  resolveProvider: () => Promise<ResolvedAiProvider | null>;
  /** Receives the mapped exercises (and the count dropped by the gate). */
  onGenerated: (exercises: ContentLessonExercise[], skipped: number) => void;
  t: Translate;
  /** Test seam; defaults to the real AIX-01 engine. */
  generate?: typeof defaultGenerate;
}

/** Sparkles button that generates exercises from theory via the AI. */
export default function GenerateExercisesButton({
  theorySteps,
  language,
  hasGenerated,
  previousQuestions,
  resolveProvider,
  onGenerated,
  t,
  generate = defaultGenerate,
}: GenerateExercisesButtonProps) {
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [regenCount, setRegenCount] = useState(0);

  const maxReached = regenCount >= MAX_REGENERATIONS;

  async function runGeneration(feedbackOpts?: {
    feedback?: string;
    language?: string;
  }) {
    if (busy) return;
    setBusy(true);
    setNeedsKey(false);
    try {
      const config = await resolveProvider();
      if (!config) {
        setNeedsKey(true);
        return;
      }
      const provider = browserDirectProvider(config);
      const result = await generate(theorySteps, provider, {
        language: feedbackOpts?.language ?? language,
        feedback: feedbackOpts?.feedback,
        avoidQuestions: feedbackOpts?.feedback ? previousQuestions : undefined,
      });
      const { exercises, skipped } = cardsToExercises(result.cards, {
        clozePrompt: t("content.lesson_gen.cloze_prompt", "Fill in the missing word."),
      });
      if (exercises.length === 0) {
        notify.error(
          t(
            "content.ai_exercises.none",
            "The AI returned no usable exercises. Please try again.",
          ),
        );
        return;
      }
      const rejected = (result.rejected?.length ?? 0) + skipped;
      notify.success(
        rejected > 0
          ? t(
              "content.ai_exercises.generated_with_rejected",
              "{n} exercises generated, {r} rejected for quality.",
            )
              .replace("{n}", String(exercises.length))
              .replace("{r}", String(rejected))
          : t("content.ai_exercises.generated", "{n} exercises generated.").replace(
              "{n}",
              String(exercises.length),
            ),
      );
      onGenerated(exercises, skipped);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.ai_exercises.failed", "Could not generate exercises. Please try again.")} ${detail}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function handleClick() {
    if (busy || maxReached) return;
    if (hasGenerated) {
      setFeedbackOpen(true);
      return;
    }
    void runGeneration();
  }

  function handleFeedback(feedback: RegenerateFeedback) {
    setFeedbackOpen(false);
    const languageName = feedback.language
      ? LANGUAGE_OPTIONS.find((o) => o.code === feedback.language)?.name
      : undefined;
    setRegenCount((count) => count + 1);
    void runGeneration({
      feedback: feedbackForReason(feedback.reason, feedback.freeText, languageName),
      language: feedback.language,
    });
  }

  return (
    <div className="contents">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        disabled={busy || maxReached}
        title={
          maxReached
            ? t(
                "content.ai_exercises.max_reached",
                "Maximum regeneration attempts reached. Edit the exercises manually or import a longer chat.",
              )
            : undefined
        }
        data-testid="generate-exercises-button"
      >
        {busy ? (
          <span
            className="btn-spinner"
            data-testid="generate-exercises-spinner"
            aria-hidden="true"
          />
        ) : (
          <Sparkles size={16} aria-hidden="true" className="mr-1" />
        )}
        {busy
          ? t("content.ai_exercises.generating", "Generating exercises…")
          : hasGenerated
            ? t("content.ai_exercises.regenerate", "Regenerate")
            : t("content.ai_exercises.button", "Generate exercises")}
      </Button>
      {maxReached && (
        <p
          className="w-full text-sm text-fg-muted"
          data-testid="generate-exercises-max-reached"
        >
          {t(
            "content.ai_exercises.max_reached",
            "Maximum regeneration attempts reached. Edit the exercises manually or import a longer chat.",
          )}
        </p>
      )}
      {needsKey && (
        <div className="w-full" data-testid="generate-exercises-no-key">
          <ApiKeyRequiredNotice
            compact
            feature={t("content.ai_exercises.feature", "to generate exercises")}
          />
        </div>
      )}
      <RegenerateFeedbackDialog
        open={feedbackOpen}
        defaultLanguage={language}
        onSubmit={handleFeedback}
        onCancel={() => setFeedbackOpen(false)}
        t={t}
      />
    </div>
  );
}
