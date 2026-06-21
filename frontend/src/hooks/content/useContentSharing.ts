/**
 * Community-share + opt-in AI-validation state and handlers for the
 * /content page (extracted from Content.tsx, #401).
 *
 * Owns the share-flow state (target / rule-based result / loaded lessons
 * / placement filenames / AI consent + result / applied auto-fixes) and
 * the handlers that drive it: open the share gate (validate), run the
 * optional AI review, apply an AI auto-fix, and reset on close. The page
 * keeps the contribution history (the "My Contributions" section reads
 * it); this hook only triggers a recorded share via the wizard.
 */

import { useState } from "react";

import { useI18n } from "../ui/useI18n";
import {
  validateSetForSharing,
  type ValidationIssue,
  type ValidationResult,
} from "../../lib/content/validation/content-validator";
import type { AiValidationResult } from "../../lib/content/validation/ai-content-validator";
import { USER_GENERATED_SOURCE } from "../../storage/types";
import { readLearnerState } from "../../lib/learnerState";
import { getStorage } from "../../storage";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";
import { notify } from "../../utils/notify";

interface UseContentSharingDeps {
  /** Full set list (for the same-pair/level placement + duplicate scan). */
  sets: ContentSetEntry[];
  /** Load every lesson of a set (page-level helper; reused for export). */
  fetchSetLessons: (entry: ContentSetEntry) => Promise<ContentLesson[]>;
}

/**
 * Share-flow view-model. Returned to the page, which renders the "My
 * Lessons" Share button against {@link handleShare} and passes the rest
 * into {@link ContentShareDialog}.
 */
export function useContentSharing({ sets, fetchSetLessons }: UseContentSharingDeps) {
  const { t } = useI18n();

  const [shareTarget, setShareTarget] = useState<ContentSetEntry | null>(null);
  const [shareResult, setShareResult] = useState<ValidationResult | null>(null);
  const [shareChecking, setShareChecking] = useState(false);
  // Phase 60 C5b — opt-in AI validation layer.
  const [shareLessons, setShareLessons] = useState<ContentLesson[]>([]);
  const [aiConsent, setAiConsent] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<AiValidationResult | null>(null);
  // Phase 64C — filenames already in the matching published set, for the
  // wizard's placement auto-numbering (empty => brand-new set).
  const [shareExistingFilenames, setShareExistingFilenames] = useState<string[]>([]);
  // Keys of AI suggestions the user has auto-applied (so the button
  // flips to "applied" and isn't re-run).
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  // Phase 64C — published sets in the SAME language pair + level as
  // ``entry`` (excluding user-generated drafts + the set itself). Used
  // for the wizard's placement (auto-numbering) and duplicate scan.
  const samePairLevelSets = (entry: ContentSetEntry): ContentSetEntry[] => {
    const baseOf = (code: string) => (code || "").split("-")[0].toLowerCase();
    return sets.filter(
      (s) =>
        s.source !== USER_GENERATED_SOURCE &&
        s.id !== entry.id &&
        baseOf(s.source_language) === baseOf(entry.source_language) &&
        baseOf(s.target_language) === baseOf(entry.target_language) &&
        (s.level || "").toLowerCase() === (entry.level || "").toLowerCase(),
    );
  };

  // Load every lesson of the published sets that share the entry's pair
  // + level — the candidate pool for the wizard's lesson-level
  // duplicate scan. Best-effort: a set that fails to load is skipped.
  const loadSimilarLessonsFor = async (entry: ContentSetEntry): Promise<ContentLesson[]> => {
    const pool: ContentLesson[] = [];
    for (const candidate of samePairLevelSets(entry)) {
      try {
        pool.push(...(await fetchSetLessons(candidate)));
      } catch {
        /* skip a set we cannot load; the scan stays advisory */
      }
    }
    return pool;
  };

  // Phase 60 — gate "Share with Community" behind the client-side
  // validation pipeline. Fetch the set's lessons, validate schema +
  // language pair + quality minimums; warnings never block (the
  // wizard shares as a pull request either way).
  const closeShareModal = () => {
    setShareTarget(null);
    setShareResult(null);
    setShareLessons([]);
    setAiConsent(false);
    setAiResult(null);
    setAiRunning(false);
    setAppliedFixes(new Set());
    setShareExistingFilenames([]);
  };

  // Phase 60 C5b — auto-fix one AI suggestion: apply the correction
  // to the in-memory lessons, re-save the set, and mark it applied.
  // Only translation (card back) + grammar (theory body) corrections
  // have a concrete target; distractor/level issues stay advisory.
  const applyAutoFix = async (
    fixKey: string,
    kind: "card" | "step",
    targetId: string,
    text: string,
  ) => {
    if (!shareTarget || !text) return;
    const next: ContentLesson[] = shareLessons.map((lesson) => ({
      ...lesson,
      cards:
        kind === "card"
          ? lesson.cards.map((c) => (c.id === targetId ? { ...c, back: text } : c))
          : lesson.cards,
      steps:
        kind === "step"
          ? lesson.steps.map((s) => (s.id === targetId ? { ...s, body: text } : s))
          : lesson.steps,
    }));
    try {
      await getStorage().contentLoader.saveUserSet({
        set_id: shareTarget.id,
        title: shareTarget.title,
        title_native: shareTarget.title_native,
        language: shareTarget.target_language,
        target_language: shareTarget.target_language,
        source_language: shareTarget.source_language,
        level: shareTarget.level,
        origin: shareTarget.domain as "analysis" | "adaptive" | "imported",
        lessons: next,
      });
      setShareLessons(next);
      setAppliedFixes((prev) => new Set(prev).add(fixKey));
      notify.success(t("content.ai_validation.fix_applied", "Suggestion applied."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.ai_validation.fix_failed", "Could not apply the suggestion.")} ${detail}`,
      );
    }
  };

  const handleShare = async (entry: ContentSetEntry) => {
    setShareTarget(entry);
    setShareResult(null);
    setShareLessons([]);
    setAiConsent(false);
    setAiResult(null);
    setShareChecking(true);
    try {
      const lessons = await fetchSetLessons(entry);
      setShareLessons(lessons);
      // Placement auto-numbering needs the filenames already in the
      // matching published set (if one exists); best-effort.
      const matches = samePairLevelSets(entry);
      if (matches.length > 0) {
        try {
          const listing = await getStorage().contentLoader.listLessons(
            matches[0].source,
            matches[0].id,
          );
          setShareExistingFilenames(listing.lessons);
        } catch {
          setShareExistingFilenames([]);
        }
      } else {
        setShareExistingFilenames([]);
      }
      const result = validateSetForSharing(
        {
          title: entry.title,
          title_native: entry.title_native,
          target_language: entry.target_language,
          source_language: entry.source_language,
          level: entry.level,
        },
        lessons,
      );
      setShareResult(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
      setShareTarget(null);
    } finally {
      setShareChecking(false);
    }
  };

  // Phase 60 C5b — opt-in AI review. Failure is NON-fatal: the
  // rule-based pass already qualifies the set for sharing.
  const handleRunAiValidation = async () => {
    if (!shareTarget) return;
    const userId = readLearnerState().userId;
    if (!userId) return;
    setAiRunning(true);
    setAiResult(null);
    try {
      const result = await getStorage().contentLoader.aiValidate({
        user_id: userId,
        title: shareTarget.title,
        title_native: shareTarget.title_native,
        target_language: shareTarget.target_language,
        source_language: shareTarget.source_language,
        level: shareTarget.level,
        lessons: shareLessons,
      });
      setAiResult(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.warning(
        `${t("content.ai_validation.failed", "AI review unavailable. You can still share — the quality check passed.")} ${detail}`,
      );
    } finally {
      setAiRunning(false);
    }
  };

  // Localise a validation issue, interpolating its params into the
  // ``content.validation.{code}`` message.
  const validationMessage = (issue: ValidationIssue): string => {
    let msg = t(`content.validation.${issue.code}`, issue.code);
    for (const [k, v] of Object.entries(issue.params ?? {})) {
      msg = msg.replace(`{${k}}`, String(v));
    }
    return msg;
  };

  return {
    shareTarget,
    shareResult,
    shareChecking,
    shareLessons,
    aiConsent,
    setAiConsent,
    aiRunning,
    aiResult,
    shareExistingFilenames,
    appliedFixes,
    closeShareModal,
    applyAutoFix,
    handleShare,
    handleRunAiValidation,
    validationMessage,
    loadSimilarLessonsFor,
  };
}

/** Return shape of {@link useContentSharing}. */
export type UseContentSharingResult = ReturnType<typeof useContentSharing>;
