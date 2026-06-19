/**
 * useAiCardValidation — drives the EXP-033 set-wide AI content check
 * (AIV-02/03/05): flatten a set's cards, estimate the cost, run the
 * batched provider check with progress + cancel, and expose the per-card
 * report.
 *
 * The actual provider call runs through ``getStorage().contentLoader
 * .aiValidateCards`` (Dexie = browser-direct; API mode throws — the
 * caller gates the trigger). All i18n/composition is left to the
 * consuming dialog; this hook returns raw data + phase state.
 */

import { useCallback, useRef, useState } from "react";

import type {
  ValidationCard,
  ValidationResult,
} from "../../lib/ai/content-validator";
import {
  estimateValidationCost,
  type CostEstimate,
} from "../../lib/ai/validation-cost";
import { MAX_CARDS_PER_RUN } from "../../lib/ai/validation-runner";
import { computeContentHash } from "../../lib/ai/content-hash";
import { buildSignature } from "../../lib/ai/validation-signature";
import { resolveModel } from "../../storage/ai-providers";
import { getStorage } from "../../storage";
import { readLearnerState } from "../../lib/learnerState";
import type { AIProvider } from "../../lib/constants";
import type { ContentSetEntry } from "../../storage/types";

/** Minimum gap between runs (EXP-033 §3.3 — max 1 per minute). */
export const MIN_RUN_INTERVAL_MS = 60_000;

export type AiCheckPhase = "idle" | "confirm" | "running" | "done" | "error";

/** Per-card report row, enriched with a display label + lesson title. */
export interface AiCheckReportRow {
  cardId: string;
  /** The card front (target-language term). */
  front: string;
  /** Title of the lesson the card belongs to. */
  lessonTitle: string;
  result: ValidationResult;
}

export interface AiCheckState {
  phase: AiCheckPhase;
  entry: ContentSetEntry | null;
  estimate: CostEstimate | null;
  progress: { current: number; total: number } | null;
  /** Cards with at least one issue, enriched for the report. */
  issueRows: AiCheckReportRow[];
  checkedCards: number;
  okCount: number;
  lessonCount: number;
  /** Provider response ids (AIV-09 signature, captured for AIV-04/09). */
  responseIds: string[];
  provider: string;
  model: string;
  /** True when the displayed report was loaded from the cache (AIV-04). */
  cached: boolean;
  /** ISO timestamp of the displayed report (cached or just-run). */
  checkedAt: string | null;
  error: string | null;
}

// Module-level rate-limit clock (one run per minute across the app).
let lastRunAt = 0;

/** Test-only: clear the module-level rate-limit clock so each case starts
 *  fresh. Production code must not call this. */
export function __resetRateLimitForTests(): void {
  lastRunAt = 0;
}

const INITIAL: AiCheckState = {
  phase: "idle",
  entry: null,
  estimate: null,
  progress: null,
  issueRows: [],
  checkedCards: 0,
  okCount: 0,
  lessonCount: 0,
  responseIds: [],
  provider: "",
  model: "",
  cached: false,
  checkedAt: null,
  error: null,
};

/** Build report rows (cards with issues) from results + the card lookup. */
function buildIssueRows(
  results: ValidationResult[],
  meta: Map<string, { front: string; lessonTitle: string }>,
): AiCheckReportRow[] {
  return results
    .filter((r) => !r.ok)
    .map((r) => ({
      cardId: r.card_id,
      front: meta.get(r.card_id)?.front ?? r.card_id,
      lessonTitle: meta.get(r.card_id)?.lessonTitle ?? "",
      result: r,
    }));
}

interface FlattenResult {
  cards: ValidationCard[];
  meta: Map<string, { front: string; lessonTitle: string }>;
  lessonCount: number;
  truncated: boolean;
}

/** Load the set's lessons and flatten their cards (capped at the per-run
 *  limit). Returns the cards + a per-card lesson/front lookup. */
async function flattenSetCards(entry: ContentSetEntry): Promise<FlattenResult> {
  const storage = getStorage();
  const listing = await storage.contentLoader.listLessons(entry.source, entry.id);
  const cards: ValidationCard[] = [];
  const meta = new Map<string, { front: string; lessonTitle: string }>();
  let lessonCount = 0;
  let truncated = false;
  for (const filename of listing.lessons) {
    if (cards.length >= MAX_CARDS_PER_RUN) {
      truncated = true;
      break;
    }
    const lesson = await storage.contentLoader.getLesson(entry.source, entry.id, filename);
    lessonCount++;
    for (const card of lesson.cards) {
      if (cards.length >= MAX_CARDS_PER_RUN) {
        truncated = true;
        break;
      }
      cards.push({ id: card.id, front: card.front, back: card.back, notes: card.notes });
      meta.set(card.id, { front: card.front, lessonTitle: lesson.title });
    }
  }
  return { cards, meta, lessonCount, truncated };
}

export interface UseAiCardValidation {
  state: AiCheckState;
  /** Whether the last attempt was blocked by the rate limit. */
  rateLimited: boolean;
  /** Load the set, estimate cost, and move to the confirm step (or show a
   *  still-valid cached report). */
  begin: (entry: ContentSetEntry, activeProvider: AIProvider | null) => Promise<void>;
  /** Discard the cached report and move to the confirm step for a fresh run. */
  recheck: () => void;
  /** Run the check (after the user confirms). */
  run: () => Promise<void>;
  /** Abort an in-flight run. */
  abort: () => void;
  /** Reset everything (close the dialog). */
  reset: () => void;
}

export function useAiCardValidation(): UseAiCardValidation {
  const [state, setState] = useState<AiCheckState>(INITIAL);
  const [rateLimited, setRateLimited] = useState(false);
  const cardsRef = useRef<ValidationCard[]>([]);
  const metaRef = useRef<Map<string, { front: string; lessonTitle: string }>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cardsRef.current = [];
    metaRef.current = new Map();
    setRateLimited(false);
    setState(INITIAL);
  }, []);

  const begin = useCallback(
    async (entry: ContentSetEntry, activeProvider: AIProvider | null) => {
      setRateLimited(false);
      setState({ ...INITIAL, phase: "running", entry });
      try {
        const { cards, meta, lessonCount } = await flattenSetCards(entry);
        cardsRef.current = cards;
        metaRef.current = meta;
        const provider = activeProvider ?? "openai";
        const model = resolveModel(provider, null);
        const estimate = estimateValidationCost(cards.length, provider, model);
        // AIV-04 — show the cached report (no API call) when it's still
        // valid for the current download (same cached_version).
        const cache = await getStorage().contentLoader.getAiValidationCache(
          entry.source,
          entry.id,
        );
        if (cache && cache.set_version === entry.cached_version) {
          setState({
            ...INITIAL,
            phase: "done",
            entry,
            estimate,
            lessonCount,
            issueRows: buildIssueRows(cache.results, meta),
            checkedCards: cache.card_count,
            okCount: Math.max(0, cache.card_count - cache.issue_count),
            responseIds: cache.response_ids,
            provider: cache.provider,
            model: cache.model,
            cached: true,
            checkedAt: cache.checked_at,
          });
          return;
        }
        setState({ ...INITIAL, phase: "confirm", entry, estimate, lessonCount });
      } catch (err) {
        setState({
          ...INITIAL,
          phase: "error",
          entry,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [],
  );

  /** Force a fresh check, bypassing the cached report. */
  const recheck = useCallback(() => {
    setRateLimited(false);
    setState((prev) => ({ ...prev, phase: "confirm", cached: false }));
  }, []);

  const run = useCallback(async () => {
    setState((prev) => {
      if (!prev.entry) return prev;
      return prev;
    });
    const entry = state.entry;
    if (!entry) return;
    const userId = readLearnerState().userId;
    if (!userId) {
      setState((prev) => ({ ...prev, phase: "error", error: "No active user" }));
      return;
    }
    const now = Date.now();
    if (now - lastRunAt < MIN_RUN_INTERVAL_MS) {
      setRateLimited(true);
      return;
    }
    lastRunAt = now;
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, phase: "running", progress: null, error: null }));
    try {
      const result = await getStorage().contentLoader.aiValidateCards({
        user_id: userId,
        source_language: entry.source_language,
        target_language: entry.target_language,
        level: entry.level,
        cards: cardsRef.current,
        signal: controller.signal,
        onProgress: (progress) =>
          setState((prev) => ({ ...prev, progress })),
      });
      const meta = metaRef.current;
      const issueRows = buildIssueRows(result.results, meta);
      const checkedAt = new Date().toISOString();
      // AIV-08/09 — anchor a signature to the checked cards. A signature
      // needs a real provider response id; without one (provider omitted
      // it) we still cache the report but leave the signature null.
      const contentHash = await computeContentHash(cardsRef.current);
      const responseId = result.response_ids[0] ?? "";
      const signature = responseId
        ? buildSignature({
            contentHash,
            checkedCards: result.checked_cards,
            issuesFound: result.issue_count,
            provider: result.provider,
            model: result.model,
            responseId,
            timestamp: checkedAt,
          })
        : null;
      // AIV-04 — persist so the report re-shows without another API call.
      try {
        await getStorage().contentLoader.saveAiValidationCache({
          source: entry.source,
          set_id: entry.id,
          set_version: entry.cached_version,
          content_hash: contentHash,
          results: result.results,
          response_ids: result.response_ids,
          provider: result.provider,
          model: result.model,
          card_count: result.checked_cards,
          issue_count: result.issue_count,
          checked_at: checkedAt,
          signature,
        });
      } catch {
        /* cache write is best-effort; the report still displays */
      }
      setState((prev) => ({
        ...prev,
        phase: "done",
        progress: null,
        issueRows,
        checkedCards: result.checked_cards,
        okCount: Math.max(0, result.checked_cards - result.issue_count),
        responseIds: result.response_ids,
        provider: result.provider,
        model: result.model,
        cached: false,
        checkedAt,
      }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState((prev) => ({ ...prev, phase: "idle", progress: null }));
        return;
      }
      setState((prev) => ({
        ...prev,
        phase: "error",
        progress: null,
        error: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      abortRef.current = null;
    }
  }, [state.entry]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, rateLimited, begin, recheck, run, abort, reset };
}
