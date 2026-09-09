/**
 * useAiFix (AIV-07, #3060): the review-and-apply state behind the AI
 * check's "Apply suggestions" step.
 *
 * ``openReview`` loads the set's lessons through the editor's read path
 * (``fetchEditLessonSet``) and plans the applicable replacements
 * (``planFixes``); every candidate starts ticked and the learner unticks
 * prose rows. ``confirm`` writes the ticked fields through
 * ``saveUserSet`` (whole set, metadata carried over), records the undo
 * snapshot, drops the cached report (its version key never changes for a
 * user set) and reports the counts. ``undo`` plays the snapshot back
 * through the same write path. Every failure reaches the toast layer
 * with its detail and returns the learner to where they were.
 *
 * The caller gates the entry to the learner's own sets
 * (``isOwnEditableSet``); the hook itself only refuses to run without an
 * entry.
 *
 * @example
 * const fix = useAiFix(entry, t);
 * <Button onClick={() => fix.openReview(rows.map((r) => r.result))} />
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../api/client";
import type { ValidationResult } from "../../lib/ai/validation/content-validator";
import { fetchEditLessonSet } from "../../lib/content/lesson/edit/edit-session";
import {
  applyFixes,
  planFixes,
  undoFixes,
  type FixPlan,
} from "../../lib/content/validation/ai-fix";
import {
  clearFixSnapshot,
  readFixSnapshot,
  writeFixSnapshot,
} from "../../lib/content/validation/ai-fix-undo-store";
import { getStorage } from "../../storage";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";
import { notify } from "../../utils/notify";

type Translate = (key: string, fallback?: string) => string;

export type AiFixPhase = "idle" | "loading" | "review" | "busy" | "applied" | "undone";

export interface AiFixState {
  phase: AiFixPhase;
  plan: FixPlan | null;
  /** Candidate keys the learner left ticked. */
  selected: ReadonlySet<string>;
  appliedFields: number;
  appliedCards: number;
  restored: number;
  /** A snapshot of an earlier apply exists for this set. */
  canUndo: boolean;
  error: string | null;
}

export interface UseAiFix {
  state: AiFixState;
  /** Load the lessons, plan the replacements and enter the review step. */
  openReview: (results: readonly ValidationResult[]) => Promise<void>;
  toggle: (key: string) => void;
  /** Write the ticked replacements. */
  confirm: () => Promise<void>;
  /** Play the last apply back. */
  undo: () => Promise<void>;
  /** Leave the review step without writing. */
  back: () => void;
  reset: () => void;
}

const INITIAL: AiFixState = {
  phase: "idle",
  plan: null,
  selected: new Set(),
  appliedFields: 0,
  appliedCards: 0,
  restored: 0,
  canUndo: false,
  error: null,
};

function errorDetail(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  return err instanceof Error ? err.message : String(err);
}

function hasSnapshot(entry: ContentSetEntry | null): boolean {
  return entry !== null && readFixSnapshot(entry.source, entry.id) !== null;
}

export function useAiFix(entry: ContentSetEntry | null, t: Translate): UseAiFix {
  const [state, setState] = useState<AiFixState>(INITIAL);
  const lessonsRef = useRef<ContentLesson[]>([]);

  useEffect(() => {
    lessonsRef.current = [];
    setState({ ...INITIAL, canUndo: hasSnapshot(entry) });
  }, [entry]);

  const fail = useCallback(
    (err: unknown) => {
      const detail = errorDetail(err);
      notify.error(
        t("content.ai_check.fix.failed", "Could not apply the suggestions") + ": " + detail,
      );
      setState((prev) => ({
        ...prev,
        phase: prev.plan ? "review" : "idle",
        error: detail,
      }));
    },
    [t],
  );

  const openReview = useCallback(
    async (results: readonly ValidationResult[]) => {
      if (!entry) return;
      setState((prev) => ({ ...prev, phase: "loading", error: null }));
      try {
        const { lessons } = await fetchEditLessonSet(entry.source, entry.id);
        lessonsRef.current = lessons;
        const plan = planFixes(results, lessons);
        setState((prev) => ({
          ...prev,
          phase: "review",
          plan,
          selected: new Set(plan.candidates.map((c) => c.key)),
        }));
      } catch (err) {
        fail(err);
      }
    },
    [entry, fail],
  );

  const toggle = useCallback((key: string) => {
    setState((prev) => {
      const selected = new Set(prev.selected);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      return { ...prev, selected };
    });
  }, []);

  const confirm = useCallback(async () => {
    if (!entry || !state.plan) return;
    const chosen = state.plan.candidates.filter((c) => state.selected.has(c.key));
    if (chosen.length === 0) return;
    setState((prev) => ({ ...prev, phase: "busy", error: null }));
    try {
      const { input, snapshot } = applyFixes(
        entry,
        lessonsRef.current,
        chosen,
        new Date().toISOString(),
      );
      const storage = getStorage();
      await storage.contentLoader.saveUserSet(input);
      writeFixSnapshot(snapshot);
      await storage.contentLoader.deleteAiValidationCache(entry.source, entry.id);
      const cards = new Set(snapshot.changes.map((c) => c.cardId)).size;
      notify.success(
        t(
          "content.ai_check.fix.applied",
          "{fields} fields applied. The report is out of date, re-check the set.",
        ).replace("{fields}", String(snapshot.changes.length)),
      );
      setState((prev) => ({
        ...prev,
        phase: "applied",
        appliedFields: snapshot.changes.length,
        appliedCards: cards,
        canUndo: true,
      }));
    } catch (err) {
      fail(err);
    }
  }, [entry, state.plan, state.selected, t, fail]);

  const undo = useCallback(async () => {
    if (!entry) return;
    const snapshot = readFixSnapshot(entry.source, entry.id);
    if (!snapshot) return;
    setState((prev) => ({ ...prev, phase: "busy", error: null }));
    try {
      const { lessons } = await fetchEditLessonSet(entry.source, entry.id);
      const { input, restored } = undoFixes(entry, lessons, snapshot);
      const storage = getStorage();
      await storage.contentLoader.saveUserSet(input);
      clearFixSnapshot(entry.source, entry.id);
      await storage.contentLoader.deleteAiValidationCache(entry.source, entry.id);
      notify.success(t("content.ai_check.fix.undone", "Apply undone."));
      setState((prev) => ({ ...prev, phase: "undone", restored, canUndo: false }));
    } catch (err) {
      fail(err);
    }
  }, [entry, t, fail]);

  const back = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "idle", error: null }));
  }, []);

  const reset = useCallback(() => {
    lessonsRef.current = [];
    setState({ ...INITIAL, canUndo: hasSnapshot(entry) });
  }, [entry]);

  return { state, openReview, toggle, confirm, undo, back, reset };
}
