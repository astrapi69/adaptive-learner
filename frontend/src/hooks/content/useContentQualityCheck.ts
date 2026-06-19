/**
 * useContentQualityCheck — drives the EXP-032 deterministic content-quality
 * check (CQV-01..03) for one cached set.
 *
 * Loads the set's lessons through ``getStorage().contentLoader`` (both
 * storage modes), flattens their cards, and runs the offline accent /
 * article / duplicate checks. No API key, no network, no cost — instant.
 * All i18n/composition is left to the consuming dialog; this hook returns
 * the raw {@link QualityReport} plus per-card display metadata + phase.
 */

import { useCallback, useState } from "react";

import {
  countQualityFindings,
  runContentQualityChecks,
  type QualityCard,
  type QualityReport,
} from "../../lib/content-quality";
import { getStorage } from "../../storage";
import type { ContentSetEntry } from "../../storage/types";

export type QualityCheckPhase = "idle" | "loading" | "done" | "error";

/** Per-card display metadata, keyed by card id. */
export interface QualityCardMeta {
  front: string;
  lessonTitle: string;
}

export interface QualityCheckState {
  phase: QualityCheckPhase;
  report: QualityReport | null;
  meta: Map<string, QualityCardMeta>;
  cardCount: number;
  lessonCount: number;
  findingCount: number;
  error: string | null;
}

const INITIAL: QualityCheckState = {
  phase: "idle",
  report: null,
  meta: new Map(),
  cardCount: 0,
  lessonCount: 0,
  findingCount: 0,
  error: null,
};

export interface UseContentQualityCheck {
  state: QualityCheckState;
  /** Load the set, run the checks, and move to the report. */
  run: (entry: ContentSetEntry) => Promise<void>;
  /** Reset everything (close the dialog). */
  reset: () => void;
}

export function useContentQualityCheck(): UseContentQualityCheck {
  const [state, setState] = useState<QualityCheckState>(INITIAL);

  const reset = useCallback(() => setState(INITIAL), []);

  const run = useCallback(async (entry: ContentSetEntry) => {
    setState({ ...INITIAL, phase: "loading" });
    try {
      const storage = getStorage();
      const listing = await storage.contentLoader.listLessons(
        entry.source,
        entry.id,
      );
      const cards: QualityCard[] = [];
      const meta = new Map<string, QualityCardMeta>();
      let lessonCount = 0;
      for (const filename of listing.lessons) {
        const lesson = await storage.contentLoader.getLesson(
          entry.source,
          entry.id,
          filename,
        );
        lessonCount++;
        for (const c of lesson.cards) {
          cards.push({ id: c.id, front: c.front, back: c.back });
          meta.set(c.id, { front: c.front, lessonTitle: lesson.title });
        }
      }
      const report = runContentQualityChecks(cards, entry.target_language);
      setState({
        phase: "done",
        report,
        meta,
        cardCount: cards.length,
        lessonCount,
        findingCount: countQualityFindings(report),
        error: null,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        phase: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return { state, run, reset };
}
