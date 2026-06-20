/**
 * AIX-02 (EXP-036) — "Generate exercises" button for theory-only lessons.
 *
 * A chat-imported lesson with prose theory but no exercises is read-only.
 * This button lets the user spend their own API tokens to turn the theory
 * into practiseable exercises (AIX-01 engine + AIX-02 quality gate), in
 * both storage modes (the provider config is resolved by the caller, so
 * Dexie resolves it browser-direct and a future API path can inject its
 * own).
 *
 * Self-contained: it owns the spinner, the no-key notice, the
 * regenerate-confirm, and the success/error toasts. The caller supplies
 * the theory steps, a provider resolver (a seam that returns ``null`` when
 * no key is configured), and an ``onGenerated`` callback that receives the
 * mapped exercises. The AI engine is injected (``generate``) so the unit
 * test runs without a real network call.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import ApiKeyRequiredNotice from "../ApiKeyRequiredNotice";
import { useConfirm } from "../../contexts/ConfirmContext";
import {
  browserDirectProvider,
  generateExercises as defaultGenerate,
} from "../../lib/ai/generate-exercises";
import { cardsToExercises } from "../../lib/ai/cards-to-exercises";
import type { TheoryStep } from "../../lib/ai/exercise-generation-prompt";
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

interface GenerateExercisesButtonProps {
  /** The lesson's theory steps (prose context for the AI). */
  theorySteps: TheoryStep[];
  /** Target language for the exercises (BCP47-ish); optional. */
  language?: string;
  /** True once exercises were already generated -> "Regenerate" + confirm. */
  hasGenerated: boolean;
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
  resolveProvider,
  onGenerated,
  t,
  generate = defaultGenerate,
}: GenerateExercisesButtonProps) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  async function handleClick() {
    if (busy) return;
    if (hasGenerated) {
      const ok = await confirm({
        message: t(
          "content.ai_exercises.regenerate_confirm",
          "Replace the generated exercises with a fresh set?",
        ),
        confirmLabel: t("content.ai_exercises.regenerate", "Regenerate"),
      });
      if (!ok) return;
    }
    setBusy(true);
    setNeedsKey(false);
    try {
      const config = await resolveProvider();
      if (!config) {
        setNeedsKey(true);
        return;
      }
      const provider = browserDirectProvider(config);
      const result = await generate(theorySteps, provider, { language });
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
      notify.success(
        t("content.ai_exercises.generated", "{n} exercises generated.").replace(
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

  return (
    <div className="contents">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        disabled={busy}
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
      {needsKey && (
        <div className="w-full" data-testid="generate-exercises-no-key">
          <ApiKeyRequiredNotice
            compact
            feature={t("content.ai_exercises.feature", "to generate exercises")}
          />
        </div>
      )}
    </div>
  );
}
