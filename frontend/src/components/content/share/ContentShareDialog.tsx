/**
 * The community-share dialog on /content (extracted from Content.tsx,
 * #401): the {@link ShareWizard} integration plus the opt-in AI-review
 * ``aiSection`` (consent → run → results with per-suggestion auto-fix).
 *
 * All share state + handlers come from {@link useContentSharing} (passed
 * as ``share``); contribution recording and the regenerate jump are
 * page-level callbacks. Renders nothing when no share is in flight.
 */

import type { NavigateFunction } from "react-router";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { UseContentSharingResult } from "../../../hooks/content/useContentSharing";
import type { ContentSetEntry } from "../../../storage/types";
import ShareWizard from "./ShareWizard";

interface ContentShareDialogProps {
  share: UseContentSharingResult;
  /** Published sets (the wizard's new-set detection). */
  knownSets: ContentSetEntry[];
  repo: string;
  branch: string;
  hasKey: boolean;
  activeProvider: string | null;
  navigate: NavigateFunction;
  /** Jump an analysis set back to its import page (regenerate path). */
  onEditUserSet: (entry: ContentSetEntry) => void;
  /** Record a successful share into the contribution history. */
  onShared: (url: string, title: string) => void;
}

export default function ContentShareDialog({
  share,
  knownSets,
  repo,
  branch,
  hasKey,
  activeProvider,
  navigate,
  onEditUserSet,
  onShared,
}: ContentShareDialogProps) {
  const { t } = useI18n();
  const {
    shareTarget,
    shareResult,
    shareChecking,
    shareLessons,
    shareExistingFilenames,
    aiConsent,
    setAiConsent,
    aiRunning,
    aiResult,
    appliedFixes,
    closeShareModal,
    applyAutoFix,
    handleRunAiValidation,
    validationMessage,
    loadSimilarLessonsFor,
  } = share;

  if (!shareTarget) return null;

  // Phase 60 C5b — render the AI review's issue groups. Translation
  // + grammar issues carry a concrete correction, so they get an
  // "Apply" auto-fix button; distractor + level + cultural items are
  // advisory only.
  const renderAiIssues = () => {
    if (!aiResult) return null;
    const fixBtn = (fixKey: string, kind: "card" | "step", targetId: string, text: string) =>
      text ? (
        appliedFixes.has(fixKey) ? (
          <span className="content-ai-applied">
            {t("content.ai_validation.applied", "applied")}
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="content-ai-fix"
            onClick={() => void applyAutoFix(fixKey, kind, targetId, text)}
            data-testid={`content-ai-fix-${fixKey}`}
          >
            {t("content.ai_validation.auto_fix", "Apply")}
          </Button>
        )
      ) : null;
    return (
      <ul className="content-ai-issues" data-testid="content-ai-issues">
        {aiResult.translation_issues.map((it, i) => (
          <li key={`tr-${i}`} className="content-ai-issue content-ai-issue-warn">
            <span>
              {it.card_id}: {it.issue}
              {it.suggestion && ` → ${it.suggestion}`}
            </span>
            {fixBtn(`tr-${it.card_id}-${i}`, "card", it.card_id, it.suggestion)}
          </li>
        ))}
        {aiResult.grammar_issues.map((it, i) => (
          <li key={`gr-${i}`} className="content-ai-issue content-ai-issue-warn">
            <span>
              {it.step_id}: {it.issue}
              {it.correction && ` → ${it.correction}`}
            </span>
            {fixBtn(`gr-${it.step_id}-${i}`, "step", it.step_id, it.correction)}
          </li>
        ))}
        {aiResult.distractor_issues.map((it, i) => (
          <li key={`di-${i}`} className="content-ai-issue">
            {it.exercise_id}: {it.issue}
            {it.suggestion && ` → ${it.suggestion}`}
          </li>
        ))}
        {aiResult.level_issues.map((it, i) => (
          <li key={`lv-${i}`} className="content-ai-issue">
            {it.item}: {it.issue}
            {it.suggestion && ` → ${it.suggestion}`}
          </li>
        ))}
        {aiResult.cultural_flags.map((flag, i) => (
          <li key={`cf-${i}`} className="content-ai-issue content-ai-issue-flag">
            {flag}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ShareWizard
      entry={shareTarget}
      lessons={shareLessons}
      validation={shareResult}
      checking={shareChecking}
      knownSets={knownSets}
      existingFilenames={shareExistingFilenames}
      loadSimilarLessons={() => loadSimilarLessonsFor(shareTarget)}
      validationMessage={validationMessage}
      repo={repo}
      branch={branch}
      onShared={onShared}
      onRegenerate={() => {
        // BUG B — rebuild an empty lesson from its source. Analysis
        // sets jump back to their import page (re-saving overwrites
        // the set); other origins go to the Lesson Creator.
        const target = shareTarget;
        closeShareModal();
        if (target.domain === "analysis") onEditUserSet(target);
        else navigate("/create-lesson");
      }}
      onClose={closeShareModal}
      aiSection={
        shareResult && hasKey ? (
          <section className="content-ai-validation" data-testid="content-ai-validation">
            {!aiResult && !aiRunning && (
              <>
                <p className="content-ai-intro">
                  {t(
                    "content.ai_validation.intro",
                    "An AI can additionally check translation accuracy, grammar and level fit.",
                  )}
                </p>
                <p className="content-ai-privacy">
                  {t(
                    "content.ai_validation.privacy",
                    "Your lesson content will be sent to {provider}. No personal data is transmitted.",
                  ).replace("{provider}", activeProvider ?? "the AI provider")}
                </p>
                <label className="form-row form-row-toggle">
                  <span className="form-label">
                    {t("content.ai_validation.consent", "Run AI validation")}
                  </span>
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                    data-testid="content-ai-consent"
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!aiConsent}
                  onClick={() => void handleRunAiValidation()}
                  data-testid="content-ai-run"
                >
                  {t("content.ai_validation.run", "Check with AI")}
                </Button>
              </>
            )}
            {aiRunning && (
              <p data-testid="content-ai-running">
                {t("content.ai_validation.running", "AI is reviewing your lesson…")}
              </p>
            )}
            {aiResult && (
              <div data-testid="content-ai-result">
                <p
                  className={
                    aiResult.overall === "pass" ? "content-share-passed" : "content-share-failed"
                  }
                >
                  {aiResult.overall === "pass"
                    ? t("content.ai_validation.ai_passed", "AI review: looks good.")
                    : t("content.ai_validation.ai_review", "AI review: suggestions below.")}{" "}
                  ({t("content.ai_validation.score", "score")}:{" "}
                  {aiResult.quality_score.toFixed(2)})
                </p>
                {renderAiIssues()}
              </div>
            )}
          </section>
        ) : null
      }
    />
  );
}
