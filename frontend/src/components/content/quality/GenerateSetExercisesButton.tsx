/**
 * AIX-06 (EXP-036) — "Generate for all lessons" batch button.
 *
 * Sits on a user-generated set ("My Lessons"). One click generates
 * exercises for every theory-only lesson in the set, sequentially, with a
 * cost-estimate confirm, a live "Lesson n of m" progress line, a Cancel
 * control, and a result toast. Self-contained across both storage modes:
 * it resolves the provider + builds the batch deps itself; both are
 * injectable seams so the unit test runs without storage or network.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import ApiKeyRequiredNotice from "../../settings/ai/ApiKeyRequiredNotice";
import { useConfirm } from "../../../contexts/ConfirmContext";
import {
  estimateBatchTokens,
  generateExercisesForSet as defaultRunBatch,
  type SetBatchDeps,
} from "../../../lib/ai/generation/generate-exercises-for-set";
import { buildSetBatchDeps } from "../../../lib/ai/generation/set-batch-deps";
import { countLessonsWithoutExercises } from "../../../lib/ai/generation/set-exercise-candidates";
import { resolveActiveAiProvider } from "../../../lib/ai/providers/resolve-provider";
import { readLearnerState } from "../../../lib/learning/learnerState";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";

type Translate = (key: string, fallback?: string) => string;

interface GenerateSetExercisesButtonProps {
  entry: ContentSetEntry;
  t: Translate;
  /** Called after a successful (non-cancelled) batch. */
  onDone?: () => void;
  /**
   * Resolve the batch deps, or ``null`` when no API key is configured.
   * Defaults to resolving the active provider + building the real deps.
   */
  prepareDeps?: (entry: ContentSetEntry) => Promise<SetBatchDeps | null>;
  /** Test seam; defaults to the real orchestrator. */
  runBatch?: typeof defaultRunBatch;
  /**
   * #1896 — count the lessons that still lack exercises, so the button can
   * disable itself BEFORE the click when there is nothing to generate.
   * Defaults to reading the content store; a rejection fails open (the
   * button stays clickable and the click-path guard takes over).
   */
  countPending?: (entry: ContentSetEntry) => Promise<number>;
}

async function defaultPrepareDeps(
  entry: ContentSetEntry,
  clozePrompt: string,
): Promise<SetBatchDeps | null> {
  const { userId } = readLearnerState();
  if (!userId) return null;
  const config = await resolveActiveAiProvider(userId);
  if (!config) return null;
  return buildSetBatchDeps(entry, config, clozePrompt);
}

/** Batch "Generate for all lessons" button for one user set. */
export default function GenerateSetExercisesButton({
  entry,
  t,
  onDone,
  prepareDeps,
  runBatch = defaultRunBatch,
  countPending = countLessonsWithoutExercises,
}: GenerateSetExercisesButtonProps) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  /** ``null`` = probe not finished (or it failed) — treat as "may generate". */
  const [pending, setPending] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    countPending(entry)
      .then((count) => {
        if (!cancelled) setPending(count);
      })
      .catch(() => {
        if (!cancelled) setPending(null);
      });
    return () => {
      cancelled = true;
    };
    // ``countPending`` is a stable default or a caller-owned seam; re-probing
    // on identity change would loop on inline arrow props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.source, entry.id, entry.lesson_count]);

  const nothingToGenerate = pending === 0;
  const disabledReason = nothingToGenerate
    ? t("content.ai_exercises.batch.none", "All lessons already have exercises.")
    : undefined;

  async function handleClick() {
    if (busy || nothingToGenerate) return;
    setBusy(true);
    setNeedsKey(false);
    try {
      const resolve =
        prepareDeps ??
        ((e: ContentSetEntry) =>
          defaultPrepareDeps(
            e,
            t("content.lesson_gen.cloze_prompt", "Fill in the missing word."),
          ));
      const deps = await resolve(entry);
      if (!deps) {
        setNeedsKey(true);
        return;
      }
      const lessons = await deps.loadLessons();
      const candidates = lessons.filter((lesson) => lesson.exerciseCount === 0).length;
      if (candidates === 0) {
        // Stale probe (or a concurrent edit) — sync the button state too.
        setPending(0);
        notify.info(
          t("content.ai_exercises.batch.none", "All lessons already have exercises."),
        );
        return;
      }
      const ok = await confirm({
        message: t(
          "content.ai_exercises.batch.cost_confirm",
          "This generates exercises for {n} lessons (about {tokens} tokens). Continue?",
        )
          .replace("{n}", String(candidates))
          .replace("{tokens}", estimateBatchTokens(candidates).toLocaleString()),
        confirmLabel: t("content.ai_exercises.batch.button", "Generate for all lessons"),
      });
      if (!ok) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      setProgress({ current: 0, total: candidates });
      const result = await runBatch(entry.id, {
        deps,
        signal: controller.signal,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      notify.success(
        (result.cancelled
          ? t(
              "content.ai_exercises.batch.cancelled",
              "Stopped. {succeeded} of {total} lessons done, {generated} exercises.",
            )
          : t(
              "content.ai_exercises.batch.done",
              "{succeeded} of {total} lessons done: {generated} exercises, {skipped} skipped.",
            )
        )
          .replace("{succeeded}", String(result.succeeded))
          .replace("{total}", String(result.total))
          .replace("{generated}", String(result.generated))
          .replace("{skipped}", String(result.skipped)),
      );
      setPending(Math.max(0, result.total - result.succeeded));
      if (!result.cancelled) onDone?.();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.ai_exercises.batch.failed", "Batch generation failed. Please try again.")} ${detail}`,
      );
    } finally {
      setBusy(false);
      setProgress(null);
      controllerRef.current = null;
    }
  }

  return (
    <div className="contents">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        disabled={busy || nothingToGenerate}
        title={disabledReason}
        aria-label={
          disabledReason
            ? `${t("content.ai_exercises.batch.button", "Generate for all lessons")} — ${disabledReason}`
            : undefined
        }
        data-testid={`generate-set-exercises-${entry.id}`}
      >
        <Sparkles size={14} aria-hidden="true" />
        {busy
          ? t("content.ai_exercises.batch.running", "Generating…")
          : t("content.ai_exercises.batch.button", "Generate for all lessons")}
      </Button>
      {progress && (
        <span
          className="flex items-center gap-2 text-sm text-fg-muted"
          data-testid={`generate-set-progress-${entry.id}`}
        >
          {t("content.ai_exercises.batch.progress", "Lesson {current} of {total}…")
            .replace("{current}", String(progress.current))
            .replace("{total}", String(progress.total))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => controllerRef.current?.abort()}
            data-testid={`generate-set-cancel-${entry.id}`}
          >
            {t("content.ai_exercises.batch.cancel", "Cancel")}
          </Button>
        </span>
      )}
      {needsKey && (
        <div className="w-full" data-testid={`generate-set-no-key-${entry.id}`}>
          <ApiKeyRequiredNotice
            compact
            feature={t("content.ai_exercises.feature", "to generate exercises")}
          />
        </div>
      )}
    </div>
  );
}
