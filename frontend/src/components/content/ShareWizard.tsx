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
 *   4. One-click share as a PULL REQUEST + a celebration (confetti +
 *      thank-you + a link to the opened PR). Small lessons use a
 *      pre-filled GitHub create-file URL (the PR title + body seed
 *      from the commit); large / multi-lesson sets download the
 *      JSON and open the repo's upload page (drag-drop → PR).
 *
 * The wizard owns the share ACTION (it has the loaded candidate
 * lessons needed for variation/supplement), reusing computePlacement
 * (64A), detectDuplicate / markAsVariation / extractSupplement (64B),
 * communityPrUrl / communityUploadUrl, and the v1.38.0 celebration bus.
 * It calls back onShared(url) so the page can record the contribution
 * (64D). Duplicate/variation/supplement apply to the single-lesson
 * case (the common path for user-generated sets); a multi-lesson set
 * shares whole, skipping the lesson-level scan.
 */

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "../../hooks/useI18n";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import {
  readContributorName,
  writeContributorName,
} from "../../lib/content/contribution-history";
import {
  validateSetForSharing,
  type ValidationIssue,
  type ValidationMeta,
  type ValidationResult,
} from "../../lib/content/content-validator";
import {
  detectDuplicate,
  extractSupplement,
  markAsVariation,
  type DuplicateResult,
} from "../../lib/content/duplicate-detection";
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from "../../lib/content/language-options";
import {
  buildPrBody,
  buildPrTitle,
  communityPrUrl,
  communityUploadUrl,
  downloadLessonJson,
  type CommunityPrDetails,
} from "../../lib/content/lesson-export";
import {
  autoDetectTargetLanguage,
  computePlacement,
  estimateLevel,
  suggestFilename,
} from "../../lib/content/placement-engine";
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
  /** Re-run the lesson generator when the lesson is empty (BUG B):
   *  e.g. jump back to the analysis import page so the user can
   *  rebuild a real lesson. Optional — the "Regenerate" button only
   *  renders when provided. */
  onRegenerate?: () => void;
  onClose: () => void;
  /** Test seam; defaults to window.open in a new tab. Returns false
   *  when the popup was blocked so the wizard can surface a manual
   *  fallback link. */
  openUrl?: (url: string) => boolean;
  /** Test seam; defaults to downloadLessonJson (DOM download). */
  downloadLesson?: (lesson: ContentLesson, filename: string) => void;
}

type Step = 1 | 2 | 3 | 4;
type ShareMode = "full" | "variation" | "supplement";
/** Which GitHub flow the share used (drives the step-4 copy). */
type ShareMethod = "pr" | "upload";

const TOTAL_STEPS = 4;

/** Base subtag of a language code ("de-DE" -> "de"), lowercased. */
function baseLang(code: string | null | undefined): string {
  return (code || "").split("-")[0].toLowerCase();
}

/** A plain ISO 639-1 base subtag (exactly two letters) — what the
 *  community tree requires. */
function isIsoLang(code: string | null | undefined): boolean {
  return /^[a-z]{2}$/.test(baseLang(code));
}

const CEFR_SET: ReadonlySet<string> = new Set(CEFR_LEVELS as readonly string[]);

/** A valid CEFR level (A1..C2), case-insensitive. "imported" and other
 *  non-CEFR placeholders are rejected (BUG C). */
function isCefr(level: string | null | undefined): boolean {
  return CEFR_SET.has((level || "").trim().toUpperCase());
}

/** Content domains the share validator recognises as NON-language —
 *  source == target is allowed for these (mirrors the content repo's
 *  validate_content.py domain relaxation). */
const KNOWN_CONTENT_DOMAINS: ReadonlySet<string> = new Set([
  "knowledge",
  "programming",
  "psychology",
  "math",
]);

function defaultOpen(url: string): boolean {
  // window.open returns null when the popup is blocked; the caller
  // uses that to show a manual fallback link.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return win != null;
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
  onRegenerate,
  onClose,
  openUrl,
  downloadLesson,
}: ShareWizardProps) {
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const [step, setStep] = useState<Step>(1);
  const [scanning, setScanning] = useState(false);
  const [dup, setDup] = useState<DuplicateResult | null>(null);
  const [candidates, setCandidates] = useState<ContentLesson[]>([]);
  const [mode, setMode] = useState<ShareMode>("full");
  const [note, setNote] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  // True when window.open was blocked by the popup blocker — step 4
  // then promotes the manual "open on GitHub" link.
  const [popupBlocked, setPopupBlocked] = useState(false);
  // Which GitHub flow ran (PR create-file URL vs upload page) + the
  // generated PR body, surfaced on step 4 (the upload path can't
  // pre-fill the body, so we offer a copy button).
  const [shareMethod, setShareMethod] = useState<ShareMethod | null>(null);
  // True when the create-file editor opened with the lesson CONTENT
  // pre-filled (small single lesson). False when the user must
  // paste/attach the downloaded file (large lesson) or drag it into the
  // upload page (multi-lesson set).
  const [prefilled, setPrefilled] = useState(true);
  const [prBody, setPrBody] = useState("");
  const [copied, setCopied] = useState(false);
  // Phase 64C-2 — optional author credit, remembered across shares.
  const [authorName, setAuthorName] = useState(() => readContributorName());
  const [showName, setShowName] = useState(() => readContributorName() !== "");

  const primary = lessons[0] ?? null;
  const singleLesson = lessons.length === 1 && primary != null;

  // BUG A/C — editable lesson metadata, still correctable by the user.
  const appLang = baseLang(lang);
  const [editTitle, setEditTitle] = useState(() => entry.title || "");
  // SOURCE (the language the learner SPEAKS). v1.54.0: now that the
  // import pipeline sets languages correctly, INHERIT the lesson's saved
  // source when it's a valid ISO code DIFFERENT from the target. Fall
  // back to the app language only when it's missing, invalid, or
  // collides with the target (old pre-pipeline lessons saved with a bad
  // "en"/"en"). The dropdown stays editable for the remaining edge
  // cases. (Supersedes the v1.53.2 "always app language" stopgap.)
  const initialSource =
    isIsoLang(entry.source_language) &&
    baseLang(entry.source_language) !== baseLang(entry.target_language)
      ? baseLang(entry.source_language)
      : appLang;
  const [editSource, setEditSource] = useState(initialSource);
  // TARGET (the language the learner LEARNS) keeps the saved value when
  // it's a valid, different language; otherwise content detection;
  // otherwise empty so the user picks it.
  const [editTarget, setEditTarget] = useState(() => {
    if (
      isIsoLang(entry.target_language) &&
      baseLang(entry.target_language) !== initialSource
    )
      return baseLang(entry.target_language);
    const detected = autoDetectTargetLanguage(
      primary?.title || entry.title,
      primary?.cards ?? [],
    );
    return detected && detected !== initialSource ? detected : "";
  });
  const [editLevel, setEditLevel] = useState(() =>
    isCefr(entry.level)
      ? entry.level.trim().toUpperCase()
      : estimateLevel(primary?.cards ?? []),
  );

  const cardCount = lessons.reduce((n, l) => n + l.cards.length, 0);
  const exerciseCount = lessons.reduce(
    (n, l) => n + l.steps.filter((s) => s.type === "exercise").length,
    0,
  );
  const minutes = lessons.reduce((n, l) => n + (l.estimated_minutes || 0), 0);

  // v1.54.0 — domain-aware sharing. A LANGUAGE set needs source !=
  // target; when they're equal the material is non-language (grammar, a
  // subject, …) and ships as a NON-language domain, which the validator
  // + content-repo CI allow with source == target. Honour an explicit
  // content domain on the set; otherwise infer from the language pair.
  const sameLanguage =
    isIsoLang(editSource) &&
    isIsoLang(editTarget) &&
    baseLang(editSource) === baseLang(editTarget);
  const resolvedDomain =
    entry.domain && KNOWN_CONTENT_DOMAINS.has(entry.domain.toLowerCase())
      ? entry.domain.toLowerCase()
      : sameLanguage
        ? "knowledge"
        : "language";

  // The corrected metadata that drives placement, validation, and the
  // pull request — NOT the (possibly broken) saved entry values.
  const editedMeta: ValidationMeta = {
    title: editTitle,
    title_native: entry.title_native,
    source_language: editSource,
    target_language: editTarget,
    level: editLevel,
    domain: resolvedDomain,
  };

  const placement = computePlacement({
    meta: {
      source_language: editSource,
      target_language: editTarget,
      level: editLevel,
    },
    topic: primary?.title || editTitle,
    existingLessonFilenames: existingFilenames,
    knownSets,
  });

  // Re-run the quality validator against the CORRECTED metadata so
  // step 3 reflects what will actually be shared. Falls back to the
  // parent-provided result while the lessons are still loading.
  const liveValidation = useMemo(
    () =>
      lessons.length > 0 ? validateSetForSharing(editedMeta, lessons) : validation,
    // editedMeta is rebuilt every render; depend on its primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editTitle, editSource, editTarget, editLevel, lessons, validation],
  );

  // BUG B — an empty lesson (0 exercises / 0 cards) must never be
  // shareable. Only flag it once the lessons have loaded.
  const isEmptyLesson = !checking && (exerciseCount === 0 || cardCount === 0);

  // Step-1 gate: block "Continue" until the metadata is shareable.
  const step1Errors: string[] = [];
  if (!editTitle.trim())
    step1Errors.push(t("content.wizard.err_title", "Add a title."));
  if (!isIsoLang(editSource))
    step1Errors.push(
      t("content.wizard.err_source", "Choose the source language."),
    );
  if (!isIsoLang(editTarget))
    step1Errors.push(
      t("content.wizard.err_target", "Choose the target language."),
    );
  // No same-language block: source == target is allowed and ships as
  // non-language (knowledge) domain content (see resolvedDomain).
  if (!isCefr(editLevel))
    step1Errors.push(
      t("content.wizard.err_level", "Choose a CEFR level (A1-C2)."),
    );
  if (isEmptyLesson)
    step1Errors.push(
      t(
        "content.wizard.err_empty",
        "This lesson has no exercises. Please recreate the lesson.",
      ),
    );
  const step1Blocked = step1Errors.length > 0;

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

  /** Apply the variation/supplement choice (single-lesson only) and
   *  the optional author credit, returning the lesson(s) to ship. */
  function computeShippedLessons(author?: string): ContentLesson[] {
    let shipped: ContentLesson[] = lessons;
    if (singleLesson && primary && dup?.match) {
      let ship = primary;
      if (mode === "variation") {
        ship = markAsVariation(primary, dup.match.candidateId, note);
      } else if (mode === "supplement") {
        const original = candidates.find(
          (c) => c.id === dup.match!.candidateId,
        );
        const supplement = original
          ? extractSupplement(primary, original, note)
          : null;
        if (supplement) ship = supplement;
      }
      shipped = [ship];
    }
    // Stamp the CORRECTED languages onto the shipped file so the shared
    // JSON matches the placement + PR metadata (BUG A), plus the
    // optional author credit.
    const stampedAt = author ? new Date().toISOString() : null;
    shipped = shipped.map((l) => ({
      ...l,
      source_language: editSource,
      target_language: editTarget,
      domain: resolvedDomain,
      ...(author ? { contributed_by: author, contributed_at: stampedAt } : {}),
    }));
    return shipped;
  }

  function doShare(): void {
    // Remember the name for next time (or clear it if blanked).
    writeContributorName(authorName);
    const author =
      showName && authorName.trim().length > 0 ? authorName.trim() : undefined;
    const shipped = computeShippedLessons(author);
    const primaryShip = shipped[0] ?? null;

    const filePath = `${placement.path}/lessons/${placement.filename}`;
    const details: CommunityPrDetails = {
      title: editTitle,
      sourceLanguage: placement.source,
      targetLanguage: placement.target,
      level: placement.level,
      filePath,
      exerciseCount,
      cardCount,
      lessonCount: lessons.length,
      author,
      description: entry.description,
      validationIssues:
        liveValidation && !liveValidation.ok
          ? liveValidation.issues.map(validationMessage)
          : undefined,
    };
    const prTitle = buildPrTitle(details);
    const body = buildPrBody(details);
    setPrBody(body);

    // A SINGLE lesson always goes through the create-file (`/new/`)
    // flow: it creates the new nested path (the "you're the first"
    // case — the set's lessons/ directory doesn't exist yet) and
    // auto-forks for non-collaborators. Content is pre-filled when it
    // fits in the URL; otherwise only the path + commit metadata are
    // pre-filled and we download the JSON for the user to paste. A
    // MULTI-lesson set drag-drops several files via the upload page.
    let method: ShareMethod;
    let url: string;
    let contentPrefilled: boolean;
    if (singleLesson && primaryShip) {
      method = "pr";
      const pr = communityPrUrl({
        repo,
        branch,
        filePath,
        lesson: primaryShip,
        prTitle,
        prBody: body,
      });
      url = pr.url;
      contentPrefilled = pr.prefilled;
    } else {
      method = "upload";
      url = communityUploadUrl(repo, branch, `${placement.path}/lessons`);
      contentPrefilled = false;
    }

    setShareMethod(method);
    setPrefilled(contentPrefilled);
    setSharedUrl(url);

    // Open the GitHub page FIRST, while the click's user-activation is
    // still fresh. Doing the download first (an anchor click) can
    // consume the activation and get the subsequent window.open
    // popup-blocked — which is exactly the "file downloaded, no PR"
    // symptom. window.open is gesture-sensitive; the download is not,
    // so the download runs reliably afterwards.
    const opened = (openUrl ?? defaultOpen)(url);
    setPopupBlocked(opened === false);

    // Download the lesson file(s) whenever the content is NOT pre-filled
    // into the editor — the contributor needs the exact, correctly-named
    // JSON to paste into the create-file editor (large single lesson) or
    // drag into the upload page (multi-lesson set). Small pre-filled
    // single lessons need no download (the editor already has the JSON).
    if (!contentPrefilled) {
      const download = downloadLesson ?? downloadLessonJson;
      shipped.forEach((lesson, i) => {
        const filename =
          singleLesson && i === 0
            ? placement.filename
            : suggestFilename(placement.number + i, lesson.title);
        download(lesson, filename);
      });
    }

    onShared(url, editTitle);
    emitCelebration({ type: "confetti" });
  }

  async function copyPrBody(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prBody);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context / permissions): leave the
      // body visible in the textarea so the user can select + copy.
      setCopied(false);
    }
  }

  const stepLabel = t("content.wizard.step_label", "Step {n} of {total}")
    .replace("{n}", String(step))
    .replace("{total}", String(TOTAL_STEPS));

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="content-share-wizard"
        aria-describedby={undefined}
        className="max-h-[90vh] overflow-y-auto"
      >
        <header className="share-wizard-header">
          <DialogTitle id="share-wizard-title" className="modal-title">
            {t("content.wizard.title", "Share with the community")}
          </DialogTitle>
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
            {/* BUG B — an empty lesson is never shareable; offer to
                rebuild it from the source analysis. */}
            {isEmptyLesson && (
              <div
                className="share-wizard-empty content-share-failed"
                data-testid="share-wizard-empty"
                role="alert"
              >
                <p>
                  {t(
                    "content.wizard.err_empty",
                    "This lesson has no exercises. Please recreate the lesson.",
                  )}
                </p>
                {onRegenerate && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onRegenerate}
                    data-testid="share-wizard-regenerate"
                  >
                    {t("content.wizard.regenerate", "Regenerate")}
                  </button>
                )}
              </div>
            )}

            {/* BUG A/C — editable metadata: old lessons carry bad
                source/target/level the user must be able to fix. */}
            <p className="share-wizard-metadata-intro">
              {t(
                "content.wizard.metadata_intro",
                "Check and correct the lesson details before sharing.",
              )}
            </p>
            <div
              className="share-wizard-metadata"
              data-testid="share-wizard-metadata"
            >
              <label className="form-row">
                <span className="form-label">
                  {t("content.wizard.edit_title", "Title")}
                </span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  data-testid="share-wizard-edit-title"
                />
              </label>
              <label className="form-row">
                <span className="form-label">
                  {t("content.wizard.edit_source", "Source language (you speak)")}
                </span>
                <select
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  data-testid="share-wizard-edit-source"
                >
                  <option value="">
                    {t("content.wizard.select_language", "Select a language…")}
                  </option>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.name} ({opt.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="form-label">
                  {t("content.wizard.edit_target", "Target language (you learn)")}
                </span>
                <select
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  data-testid="share-wizard-edit-target"
                >
                  <option value="">
                    {t("content.wizard.select_language", "Select a language…")}
                  </option>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.name} ({opt.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="form-label">
                  {t("content.wizard.edit_level", "Level (CEFR)")}
                </span>
                <select
                  value={isCefr(editLevel) ? editLevel.toUpperCase() : ""}
                  onChange={(e) => setEditLevel(e.target.value)}
                  data-testid="share-wizard-edit-level"
                >
                  <option value="">
                    {t("content.wizard.select_level", "Select a level…")}
                  </option>
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </label>
              <p className="share-wizard-counts">
                <span data-testid="share-wizard-exercise-count">
                  {t("content.wizard.exercises_label", "Exercises")}:{" "}
                  {exerciseCount}
                </span>
                {" · "}
                <span data-testid="share-wizard-card-count">
                  {t("content.wizard.cards_label", "Cards")}: {cardCount}
                </span>
                {" · "}
                <span>
                  {lessons.length} {t("content.lessons", "lessons")}
                </span>
                {" · "}
                <span>~{minutes} min</span>
              </p>
              {sameLanguage && (
                <p
                  className="share-wizard-domain-hint"
                  data-testid="share-wizard-domain-hint"
                >
                  {t(
                    "content.wizard.same_language_domain_hint",
                    "Same source and target language - this will be shared as knowledge (non-language) content.",
                  )}
                </p>
              )}
            </div>

            {step1Blocked && (
              <ul
                className="content-share-issues share-wizard-step1-errors"
                data-testid="share-wizard-step1-errors"
              >
                {step1Errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}

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
                    "Your name will be shown in the lesson and the pull request.",
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
            {checking || !liveValidation ? (
              <p>{t("content.validation.checking", "Checking your lesson…")}</p>
            ) : liveValidation.ok ? (
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
                  {t("content.validation.failed_share_anyway", "Quality check found issues. You can share anyway — reviewers will see the findings noted in the pull request.")}
                </p>
                <ul className="content-share-issues">
                  {liveValidation.issues.map((issue, i) => (
                    <li key={`${issue.code}-${i}`}>{validationMessage(issue)}</li>
                  ))}
                </ul>
              </>
            )}
            {liveValidation && liveValidation.warnings.length > 0 && (
              <ul className="content-share-warnings">
                {liveValidation.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{validationMessage(w)}</li>
                ))}
              </ul>
            )}
            {aiSection}
          </section>
        )}

        {/* Step 4 — Share as a pull request + celebration */}
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
                {shareMethod === "pr" && prefilled ? (
                  <p data-testid="share-wizard-pr-instructions">
                    {t("content.wizard.submitted", "A pull request was opened on GitHub with your lesson pre-filled. Review it and click \"Create pull request\" — the content-repo CI validates it automatically.")}
                  </p>
                ) : (
                  <>
                    {shareMethod === "pr" ? (
                      // Large single lesson: the create-file editor opened
                      // at the right path with the title/description filled
                      // in, but the JSON was too big to pre-fill — the user
                      // pastes the downloaded file's contents.
                      <p data-testid="share-wizard-paste-instructions">
                        {t("content.wizard.paste_instructions", "Your lesson file was downloaded and GitHub's new-file editor opened at the right path. Open the downloaded file, paste its contents into the editor, then click \"Propose new file\" — the title and description are already filled in.")}
                      </p>
                    ) : (
                      <p data-testid="share-wizard-upload-instructions">
                        {t("content.wizard.upload_instructions", "Your lesson file was downloaded. On the GitHub page that just opened, drag the file into the upload area and click \"Propose changes\" — GitHub creates the pull request for you.")}
                      </p>
                    )}
                    <div className="share-wizard-copy-body">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={copyPrBody}
                        data-testid="share-wizard-copy-pr-body"
                      >
                        {copied
                          ? t("content.wizard.copy_pr_body_done", "Copied!")
                          : t("content.wizard.copy_pr_body", "Copy pull-request description")}
                      </button>
                      <textarea
                        className="share-wizard-pr-body"
                        data-testid="share-wizard-pr-body"
                        readOnly
                        rows={6}
                        value={prBody}
                      />
                    </div>
                  </>
                )}
                {popupBlocked && (
                  <p
                    className="form-hint form-hint-warning"
                    data-testid="share-wizard-popup-blocked"
                    role="alert"
                  >
                    {t(
                      "content.wizard.popup_blocked",
                      "Your browser blocked the GitHub tab. Click the link below to open it manually.",
                    )}
                  </p>
                )}
                <a
                  href={sharedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={popupBlocked ? "btn btn-primary" : undefined}
                  data-testid="share-wizard-pr-link"
                >
                  {shareMethod === "upload"
                    ? t(
                        "content.wizard.view_upload",
                        "Open the GitHub upload page",
                      )
                    : t(
                        "content.wizard.view_submission",
                        "Open the pull request on GitHub",
                      )}
                </a>
              </div>
            ) : (
              <div data-testid="share-wizard-confirm">
                <p>
                  {t("content.wizard.ready_to_share", "Everything's ready. Share your lesson as a pull request?")}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doShare}
                  disabled={!online}
                  title={
                    !online
                      ? t("pwa.action_unavailable", "Not available offline")
                      : undefined
                  }
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
              disabled={step === 1 && step1Blocked}
              data-testid="share-wizard-next"
            >
              {t("content.wizard.next", "Continue")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
