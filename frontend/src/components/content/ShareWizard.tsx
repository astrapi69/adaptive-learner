/**
 * Community sharing wizard (Phase 64C).
 *
 * Redesigns the one-shot "Share with Community" modal into a friendly
 * four-step flow that makes contributing feel rewarding, not
 * bureaucratic:
 *
 *   1. Preview + automatic PLACEMENT (where the lesson lands + a
 *      suggested filename, or "you're the first" for a new set).
 *   2. DUPLICATE scan against the lessons already in that tree path —
 *      advisory only: offer "share as variation" or "suggest only the
 *      new exercises" when something similar exists.
 *   3. Quality summary (the existing rule-based validator + optional
 *      AI review, passed in as a node) — warnings never block.
 *   4. One-click share + a celebration (confetti + thank-you + a link
 *      to the created GitHub issue / PR).
 *
 * The wizard owns the share ACTION (it has the loaded candidate
 * lessons needed for variation/supplement), reusing computePlacement
 * (64A), detectDuplicate / markAsVariation / extractSupplement (64B),
 * communityPrUrl / communityIssueUrl, and the v1.38.0 celebration bus.
 * It calls back onShared(url) so the page can record the contribution
 * (64D). Duplicate/variation/supplement apply to the single-lesson
 * case (the common path for user-generated sets); a multi-lesson set
 * shares whole, skipping the lesson-level scan.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  readContributorName,
  writeContributorName,
} from "../../lib/content/contribution-history";
import type {
  ValidationIssue,
  ValidationResult,
} from "../../lib/content/content-validator";
import {
  detectDuplicate,
  extractSupplement,
  markAsVariation,
  type DuplicateResult,
} from "../../lib/content/duplicate-detection";
import {
  communityIssueUrl,
  communityPrUrl,
  type ExportSetMeta,
} from "../../lib/content/lesson-export";
import { computePlacement } from "../../lib/content/placement-engine";
import { emitCelebration } from "../../lib/praise/celebration-bus";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";

export interface ShareWizardProps {
  entry: ContentSetEntry;
  lessons: ContentLesson[];
  validation: ValidationResult | null;
  checking: boolean;
  /** Published sets (for new-set detection). */
  knownSets: ContentSetEntry[];
  /** Filenames already in the matching published set (auto-numbering). */
  existingFilenames: string[];
  /** Lessons of the published sets in the same pair + level — loaded
   *  on demand for the duplicate scan (step 2). */
  loadSimilarLessons: () => Promise<ContentLesson[]>;
  /** Localise a validation issue/warning code. */
  validationMessage: (issue: ValidationIssue) => string;
  /** The existing opt-in AI-review block, rendered inside step 3. */
  aiSection?: ReactNode;
  repo: string;
  branch: string;
  /** Records a successful share for the contribution history (64D). */
  onShared: (url: string, title: string) => void;
  onClose: () => void;
  /** Test seam; defaults to window.open in a new tab. */
  openUrl?: (url: string) => void;
}

type Step = 1 | 2 | 3 | 4;
type ShareMode = "full" | "variation" | "supplement";

const TOTAL_STEPS = 4;

function defaultOpen(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ShareWizard({
  entry,
  lessons,
  validation,
  checking,
  knownSets,
  existingFilenames,
  loadSimilarLessons,
  validationMessage,
  aiSection,
  repo,
  branch,
  onShared,
  onClose,
  openUrl,
}: ShareWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [scanning, setScanning] = useState(false);
  const [dup, setDup] = useState<DuplicateResult | null>(null);
  const [candidates, setCandidates] = useState<ContentLesson[]>([]);
  const [mode, setMode] = useState<ShareMode>("full");
  const [note, setNote] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  // Phase 64C-2 — optional author credit, remembered across shares.
  const [authorName, setAuthorName] = useState(() => readContributorName());
  const [showName, setShowName] = useState(() => readContributorName() !== "");

  const primary = lessons[0] ?? null;
  const singleLesson = lessons.length === 1 && primary != null;

  const placement = computePlacement({
    meta: {
      source_language: entry.source_language,
      target_language: entry.target_language,
      level: entry.level,
    },
    topic: primary?.title || entry.title,
    existingLessonFilenames: existingFilenames,
    knownSets,
  });

  const cardCount = lessons.reduce((n, l) => n + l.cards.length, 0);
  const exerciseCount = lessons.reduce(
    (n, l) => n + l.steps.filter((s) => s.type === "exercise").length,
    0,
  );
  const minutes = lessons.reduce((n, l) => n + (l.estimated_minutes || 0), 0);

  // Step 2: scan once on entry. Single-lesson sets only — a
  // multi-lesson set shares whole, so there's no lesson-level dup.
  useEffect(() => {
    if (step !== 2 || dup !== null) return;
    if (!singleLesson || !primary) {
      setDup({ tier: "none", match: null, comparisons: [] });
      return;
    }
    let cancelled = false;
    setScanning(true);
    loadSimilarLessons()
      .then((cands) => {
        if (cancelled) return;
        setCandidates(cands);
        setDup(detectDuplicate(primary, cands));
      })
      .catch(() => {
        if (!cancelled) setDup({ tier: "none", match: null, comparisons: [] });
      })
      .finally(() => {
        if (!cancelled) setScanning(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function buildShareUrl(): string {
    let lessonToShip = primary;
    if (singleLesson && primary && dup?.match) {
      if (mode === "variation") {
        lessonToShip = markAsVariation(primary, dup.match.candidateId, note);
      } else if (mode === "supplement") {
        const original = candidates.find(
          (c) => c.id === dup.match!.candidateId,
        );
        const supplement = original
          ? extractSupplement(primary, original, note)
          : null;
        if (supplement) lessonToShip = supplement;
      }
    }
    // Phase 64C-2 — stamp the author credit onto the shipped lesson
    // (serialised in the PR fast lane) when the user opted in.
    const credited = showName && authorName.trim().length > 0;
    if (credited && lessonToShip) {
      lessonToShip = {
        ...lessonToShip,
        contributed_by: authorName.trim(),
        contributed_at: new Date().toISOString(),
      };
    }
    const meta: ExportSetMeta = {
      set_id: entry.id,
      title: entry.title,
      language: entry.target_language,
      level: entry.level,
      description: entry.description,
    };
    const validationIssues =
      validation && !validation.ok
        ? validation.issues.map(validationMessage)
        : undefined;
    // PR fast lane: one lesson, no acknowledged findings, JSON fits.
    let url: string | null = null;
    if (singleLesson && lessonToShip && validation?.ok) {
      url = communityPrUrl({
        repo,
        branch,
        placement: placement.path,
        lesson: lessonToShip,
      });
    }
    if (!url) {
      url = communityIssueUrl(repo, meta, lessons.length, {
        sourceLanguage: placement.source,
        targetLanguage: placement.target,
        placement: placement.path,
        exerciseCount,
        cardCount,
        validationIssues,
        author: credited ? authorName.trim() : undefined,
      });
    }
    return url;
  }

  function doShare(): void {
    // Remember the name for next time (or clear it if blanked).
    writeContributorName(authorName);
    const url = buildShareUrl();
    (openUrl ?? defaultOpen)(url);
    setSharedUrl(url);
    onShared(url, entry.title);
    emitCelebration({ type: "confetti" });
  }

  const stepLabel = t("content.wizard.step_label", "Step {n} of {total}")
    .replace("{n}", String(step))
    .replace("{total}", String(TOTAL_STEPS));

  return (
    <div className="modal-overlay" data-testid="content-share-wizard">
      <div
        className="modal-card share-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-wizard-title"
      >
        <header className="share-wizard-header">
          <h2 id="share-wizard-title" className="modal-title">
            {t("content.wizard.title", "Share with the community")}
          </h2>
          <p
            className="share-wizard-progress"
            data-testid="share-wizard-progress"
          >
            {stepLabel}
          </p>
        </header>

        {/* Step 1 — Preview + placement */}
        {step === 1 && (
          <section data-testid="share-wizard-step-1">
            <ul className="share-wizard-summary">
              <li>
                <strong>{entry.title}</strong>
                {entry.title_native ? ` (${entry.title_native})` : ""}
              </li>
              <li>
                {t("content.wizard.summary_counts", "{lessons} lesson(s), {exercises} exercises, {cards} cards, ~{minutes} min")
                  .replace("{lessons}", String(lessons.length))
                  .replace("{exercises}", String(exerciseCount))
                  .replace("{cards}", String(cardCount))
                  .replace("{minutes}", String(minutes))}
              </li>
            </ul>

            <div
              className="share-wizard-placement"
              data-testid="share-wizard-placement"
            >
              <p className="share-wizard-placement-line">
                {t("content.wizard.lands_under", "Your lesson lands under")}:
              </p>
              <p className="share-wizard-breadcrumb">
                <strong>
                  {placement.source.toUpperCase()} →{" "}
                  {placement.target.toUpperCase()} → {placement.level}
                </strong>
              </p>
              <code className="share-wizard-path">
                {placement.path}/lessons/
                {singleLesson ? placement.filename : ""}
              </code>
              {placement.isNewSet ? (
                <p
                  className="share-wizard-newset"
                  data-testid="share-wizard-newset"
                >
                  {t("content.wizard.new_set", "New set! You're the first to contribute here.")}
                </p>
              ) : (
                <p
                  className="share-wizard-existing"
                  data-testid="share-wizard-existing"
                >
                  {t("content.wizard.next_to_existing", "Next to {count} existing lesson(s) in this set.")
                    .replace("{count}", String(placement.existingLessonCount))}
                </p>
              )}
            </div>

            {/* Phase 64C-2 — optional author credit. */}
            <div
              className="share-wizard-author"
              data-testid="share-wizard-author"
            >
              <label className="form-row">
                <span className="form-label">
                  {t("content.credit.name_label", "Your name (optional)")}
                </span>
                <input
                  type="text"
                  className="share-wizard-author-name"
                  placeholder={t("content.credit.name_placeholder", "e.g. Maria S.")}
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    if (e.target.value.trim() && !showName) setShowName(true);
                  }}
                  data-testid="share-wizard-author-name"
                />
              </label>
              {authorName.trim() && (
                <label className="form-row form-row-toggle">
                  <span className="form-label">
                    {t("content.credit.show_name", "Show name in lesson")}
                  </span>
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={(e) => setShowName(e.target.checked)}
                    data-testid="share-wizard-author-show"
                  />
                </label>
              )}
              {authorName.trim() && showName && (
                <p className="share-wizard-author-privacy">
                  {t(
                    "content.credit.privacy",
                    "Your name will be shown in the lesson and the GitHub issue.",
                  )}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Step 2 — Duplicate / variation check */}
        {step === 2 && (
          <section data-testid="share-wizard-step-2">
            {scanning || dup === null ? (
              <p data-testid="share-wizard-scanning">
                {t("content.wizard.checking", "Checking for similar lessons…")}
              </p>
            ) : dup.tier === "none" ? (
              <p
                className="content-share-passed"
                data-testid="share-wizard-unique"
              >
                {t("content.wizard.no_duplicates", "No duplicates found. Your lesson is unique!")}
              </p>
            ) : (
              <div data-testid="share-wizard-duplicate">
                <p className="content-share-warning">
                  {(dup.tier === "near_duplicate"
                    ? t("content.wizard.near_duplicate", "This lesson already exists: \"{title}\".")
                    : t("content.wizard.similar_found", "Similar lesson found: \"{title}\".")
                  ).replace("{title}", dup.match?.candidateTitle ?? "")}
                </p>
                <p
                  className="share-wizard-overlap"
                  data-testid="share-wizard-overlap"
                >
                  {t("content.wizard.overlap", "{cards} of {total} cards in common, {ex} matching exercises.")
                    .replace("{cards}", String(dup.match?.matchedCards ?? 0))
                    .replace("{total}", String(dup.match?.totalQueryCards ?? 0))
                    .replace("{ex}", String(dup.match?.matchedExercises ?? 0))}
                </p>

                {showDiff && dup.match && (
                  <ul
                    className="share-wizard-diff"
                    data-testid="share-wizard-diff"
                  >
                    <li>
                      {t("content.wizard.diff_cards", "Cards: {m}/{t} shared")
                        .replace("{m}", String(dup.match.matchedCards))
                        .replace("{t}", String(dup.match.totalQueryCards))}
                    </li>
                    <li>
                      {t("content.wizard.diff_exercises", "Exercises: {m}/{t} shared")
                        .replace("{m}", String(dup.match.matchedExercises))
                        .replace("{t}", String(dup.match.totalQueryExercises))}
                    </li>
                  </ul>
                )}

                <div className="share-wizard-dup-actions">
                  {dup.tier === "near_duplicate" && (
                    <label className="share-wizard-mode">
                      <input
                        type="radio"
                        name="share-mode"
                        checked={mode === "supplement"}
                        onChange={() => setMode("supplement")}
                        data-testid="share-wizard-mode-supplement"
                      />
                      {t("content.wizard.suggest_new_only", "Suggest only the new exercises")}
                    </label>
                  )}
                  <label className="share-wizard-mode">
                    <input
                      type="radio"
                      name="share-mode"
                      checked={mode === "variation"}
                      onChange={() => setMode("variation")}
                      data-testid="share-wizard-mode-variation"
                    />
                    {t("content.wizard.share_as_variation", "Share anyway — as a variation")}
                  </label>
                  <label className="share-wizard-mode">
                    <input
                      type="radio"
                      name="share-mode"
                      checked={mode === "full"}
                      onChange={() => setMode("full")}
                      data-testid="share-wizard-mode-full"
                    />
                    {t("content.wizard.share_full", "Share the full lesson anyway")}
                  </label>

                  {mode !== "full" && (
                    <input
                      type="text"
                      className="share-wizard-note"
                      placeholder={t("content.wizard.variation_note_placeholder", "How does your version differ? (optional)")}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      data-testid="share-wizard-note"
                    />
                  )}

                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => setShowDiff((v) => !v)}
                    data-testid="share-wizard-toggle-diff"
                  >
                    {t("content.wizard.show_differences", "Show differences")}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 3 — Quality summary */}
        {step === 3 && (
          <section data-testid="share-wizard-step-3">
            {checking || !validation ? (
              <p>{t("content.validation.checking", "Checking your lesson…")}</p>
            ) : validation.ok ? (
              <p
                className="content-share-passed"
                data-testid="share-wizard-quality-ok"
              >
                {t("content.validation.passed", "Quality check passed. Ready to share with the community.")}
              </p>
            ) : (
              <>
                <p
                  className="content-share-failed"
                  data-testid="share-wizard-quality-issues"
                >
                  {t("content.validation.failed_share_anyway", "Quality check found issues. You can share anyway — reviewers will see the findings noted in the issue.")}
                </p>
                <ul className="content-share-issues">
                  {validation.issues.map((issue, i) => (
                    <li key={`${issue.code}-${i}`}>{validationMessage(issue)}</li>
                  ))}
                </ul>
              </>
            )}
            {validation && validation.warnings.length > 0 && (
              <ul className="content-share-warnings">
                {validation.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{validationMessage(w)}</li>
                ))}
              </ul>
            )}
            {aiSection}
          </section>
        )}

        {/* Step 4 — Share + celebration */}
        {step === 4 && (
          <section data-testid="share-wizard-step-4">
            {sharedUrl ? (
              <div
                className="share-wizard-celebration"
                data-testid="share-wizard-celebration"
              >
                <p className="share-wizard-thanks">
                  {t("content.wizard.thanks", "Thanks for sharing! Your contribution helps other learners.")}
                </p>
                <p>
                  {t("content.wizard.submitted", "Your lesson was submitted as a suggestion. A maintainer will review it.")}
                </p>
                <a
                  href={sharedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-wizard-issue-link"
                >
                  {t("content.wizard.view_submission", "View your submission on GitHub")}
                </a>
              </div>
            ) : (
              <div data-testid="share-wizard-confirm">
                <p>
                  {t("content.wizard.ready_to_share", "Everything's ready. Share your lesson with the community?")}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doShare}
                  data-testid="share-wizard-share"
                >
                  {t("content.wizard.share_button", "Share")}
                </button>
              </div>
            )}
          </section>
        )}

        <div className="form-actions share-wizard-nav">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            data-testid="share-wizard-close"
          >
            {sharedUrl
              ? t("content.wizard.done", "Done")
              : t("content.validation.cancel", "Close")}
          </button>
          {step > 1 && !sharedUrl && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep((s) => (s - 1) as Step)}
              data-testid="share-wizard-back"
            >
              {t("content.wizard.back", "Back")}
            </button>
          )}
          {step < TOTAL_STEPS && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep((s) => (s + 1) as Step)}
              data-testid="share-wizard-next"
            >
              {t("content.wizard.next", "Continue")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
