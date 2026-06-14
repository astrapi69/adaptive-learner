/**
 * State, derived values, effects, and share-action logic for the
 * community {@link ShareWizard}.
 *
 * Lifted out of the wizard component so the four step components share
 * one view-model: the editable lesson metadata, the duplicate-scan +
 * GitHub-token effects, and the two share paths (programmatic PR via a
 * configured token, or the pre-filled-URL fallback). The component tree
 * stays presentation-only and reads everything from the returned object.
 */

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../api/client";
import { useI18n } from "./useI18n";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  readContributorName,
  writeContributorName,
} from "../lib/content/contribution-history";
import {
  validateSetForSharing,
  type ValidationIssue,
  type ValidationMeta,
  type ValidationResult,
} from "../lib/content/content-validator";
import {
  detectDuplicate,
  extractSupplement,
  markAsVariation,
  type DuplicateResult,
} from "../lib/content/duplicate-detection";
import {
  buildPrBody,
  buildPrTitle,
  communityPrUrl,
  communityUploadUrl,
  downloadLessonJson,
  lessonJson,
  type CommunityPrDetails,
} from "../lib/content/lesson-export";
import { lessonBranchName } from "../lib/github/github-api";
import {
  autoDetectTargetLanguage,
  computePlacement,
  estimateLevel,
  suggestFilename,
} from "../lib/content/placement-engine";
import { emitCelebration } from "../lib/praise/celebration-bus";
import { getStorage } from "../storage";
import type { ContentLesson, ContentSetEntry } from "../storage/types";
import {
  baseLang,
  defaultOpen,
  isCefr,
  isIsoLang,
  KNOWN_CONTENT_DOMAINS,
  TOTAL_STEPS,
  type ShareMethod,
  type ShareMode,
  type Step,
} from "../components/content/shareWizardHelpers";

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

/** Step-1 metadata gate: collect the localized blocking reasons (no
 *  title, missing source/target language, no CEFR level, empty lesson).
 *  source == target is intentionally allowed (knowledge content). */
function computeStep1Errors(
  fields: {
    editTitle: string;
    editSource: string;
    editTarget: string;
    editLevel: string;
    isEmptyLesson: boolean;
  },
  t: (key: string, fallback?: string) => string,
): string[] {
  const errors: string[] = [];
  if (!fields.editTitle.trim())
    errors.push(t("content.wizard.err_title", "Add a title."));
  if (!isIsoLang(fields.editSource))
    errors.push(t("content.wizard.err_source", "Choose the source language."));
  if (!isIsoLang(fields.editTarget))
    errors.push(t("content.wizard.err_target", "Choose the target language."));
  if (!isCefr(fields.editLevel))
    errors.push(t("content.wizard.err_level", "Choose a CEFR level (A1-C2)."));
  if (fields.isEmptyLesson)
    errors.push(
      t(
        "content.wizard.err_empty",
        "This lesson has no exercises. Please recreate the lesson.",
      ),
    );
  return errors;
}

/**
 * Build the Share Wizard view-model from its props. The returned object
 * carries the editable metadata, the per-step UI state, the derived
 * placement/validation, and the share-action handlers.
 */
export function useShareWizard({
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
  // GitHub PR automation. ``tokenConfigured`` is loaded async; only a
  // confirmed ``true`` triggers the programmatic flow — null/false fall
  // back to the pre-filled-URL flow. ``prStage`` drives the phased
  // progress + error UI on step 4 ("automated" path only).
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [automated, setAutomated] = useState(false);
  const [prStage, setPrStage] = useState<
    "idle" | "preparing" | "uploading" | "creating" | "done" | "error"
  >("idle");
  const [prError, setPrError] = useState<string | null>(null);
  // Phase 64C-2 — optional author credit, remembered across shares.
  const [authorName, setAuthorName] = useState(() => readContributorName());
  const [showName, setShowName] = useState(() => readContributorName() !== "");

  const primary = lessons[0] ?? null;
  const singleLesson = lessons.length === 1 && primary != null;

  // BUG A/C — editable lesson metadata, still correctable by the user.
  const appLang = baseLang(lang);
  // An explicit NON-language content domain marks a same-language pair as
  // intentional (German grammar for German speakers), not a legacy en/en
  // mistake. The lesson carries it (set at save time, schema v1.3); a
  // downloaded set carries it on the set itself. (User-generated sets
  // overload the SET's ``domain`` to store the origin, so the lesson's
  // domain is the authoritative content-domain signal there.)
  const knownDomain = (d: string | null | undefined): string | null => {
    const v = (d || "").toLowerCase();
    return KNOWN_CONTENT_DOMAINS.has(v) ? v : null;
  };
  const explicitDomain = knownDomain(primary?.domain) ?? knownDomain(entry.domain);
  const isDomainContent = explicitDomain !== null;
  const [editTitle, setEditTitle] = useState(() => entry.title || "");
  // SOURCE (the language the learner SPEAKS). v1.54.0: now that the
  // import pipeline sets languages correctly, INHERIT the lesson's saved
  // source when it's a valid ISO code DIFFERENT from the target. Fall
  // back to the app language only when it's missing, invalid, or
  // collides with the target (old pre-pipeline lessons saved with a bad
  // "en"/"en"). The collision repair is SKIPPED for explicit domain
  // content, where source == target is intentional and inherited as-is.
  // The dropdown stays editable for the remaining edge cases.
  // (Supersedes the v1.53.2 "always app language" stopgap.)
  const initialSource =
    isIsoLang(entry.source_language) &&
    (isDomainContent ||
      baseLang(entry.source_language) !== baseLang(entry.target_language))
      ? baseLang(entry.source_language)
      : appLang;
  const [editSource, setEditSource] = useState(initialSource);
  // TARGET (the language the learner LEARNS) keeps the saved value when
  // it's a valid, different language (or explicit domain content, where
  // source == target is allowed); otherwise content detection; otherwise
  // empty so the user picks it.
  const [editTarget, setEditTarget] = useState(() => {
    if (
      isIsoLang(entry.target_language) &&
      (isDomainContent || baseLang(entry.target_language) !== initialSource)
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

  // The pair useState initializers run ONCE at mount — but the share page
  // loads the lessons asynchronously (Content.handleShare mounts the
  // wizard with an empty lessons array, then fetches), so the explicit
  // content domain on the lesson is not visible yet and a same-language
  // pair gets repaired to empty. Re-apply the inherited pair the first
  // time the lessons reveal a known content domain (it lands within a
  // tick, before any user interaction, so it never clobbers a manual edit).
  const domainPairAppliedRef = useRef(false);
  useEffect(() => {
    if (!isDomainContent || domainPairAppliedRef.current) return;
    domainPairAppliedRef.current = true;
    if (isIsoLang(entry.source_language))
      setEditSource(baseLang(entry.source_language));
    if (isIsoLang(entry.target_language))
      setEditTarget(baseLang(entry.target_language));
  }, [isDomainContent, entry.source_language, entry.target_language]);

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
  // content domain (lesson or set); otherwise infer from the language
  // pair (equal pair -> knowledge, differing pair -> language).
  const sameLanguage =
    isIsoLang(editSource) &&
    isIsoLang(editTarget) &&
    baseLang(editSource) === baseLang(editTarget);
  const resolvedDomain =
    explicitDomain ?? (sameLanguage ? "knowledge" : "language");

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
  // (source == target is allowed — it ships as non-language / knowledge
  // domain content; see resolvedDomain — so there is no same-language
  // block.)
  const step1Errors = computeStep1Errors(
    { editTitle, editSource, editTarget, editLevel, isEmptyLesson },
    t,
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

  // Load the GitHub token status once so step 4 can pick the automated
  // (programmatic PR) path vs the URL fallback. Failure -> not
  // configured (the URL flow is the graceful degradation).
  useEffect(() => {
    let cancelled = false;
    getStorage()
      .github.getStatus()
      .then((s) => {
        if (!cancelled) setTokenConfigured(s.configured);
      })
      .catch(() => {
        if (!cancelled) setTokenConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  interface ShareContext {
    shipped: ContentLesson[];
    primaryShip: ContentLesson | null;
    filePath: string;
    prTitle: string;
    body: string;
  }

  /** Compute the shipped lesson(s), file path, and PR title/body from
   *  the current (corrected) form state. Shared by the automated +
   *  URL-fallback paths. */
  function buildShareContext(): ShareContext {
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
    return { shipped, primaryShip, filePath, prTitle, body };
  }

  function doShare(): void {
    const ctx = buildShareContext();
    // Automated programmatic PR: a single lesson + a configured GitHub
    // token (the token commits the file + opens the PR directly). Only a
    // confirmed ``true`` qualifies — null (still loading) / false fall
    // back to the pre-filled-URL flow, as do multi-lesson sets.
    if (singleLesson && ctx.primaryShip && tokenConfigured === true) {
      void runAutomatedShare(ctx);
      return;
    }
    runUrlShare(ctx);
  }

  /** Programmatic PR: fork -> commit -> open PR via the GitHub token.
   *  On failure, surfaces a friendly error + a manual fallback. */
  async function runAutomatedShare(ctx: ShareContext): Promise<void> {
    const lesson = ctx.primaryShip;
    if (!lesson) return;
    setAutomated(true);
    setShareMethod("pr");
    setPrError(null);
    setPrStage("preparing");
    try {
      // ``new Date()`` is also used by computeShippedLessons + onShared
      // below; the date keeps re-shares of the same lesson off the same
      // branch.
      const date = new Date().toISOString().slice(0, 10);
      const branchName = lessonBranchName(editTitle || lesson.title, date);
      setPrStage("uploading");
      const result = await getStorage().github.createLessonPr({
        upstream: repo,
        baseBranch: branch,
        branchName,
        filePath: ctx.filePath,
        fileContent: lessonJson(lesson),
        commitMessage: ctx.prTitle,
        prTitle: ctx.prTitle,
        prBody: ctx.body,
        // Best-effort manifest listing (skipped server-/client-side when
        // the set has no manifest yet — the "you're the first" case).
        manifestUpdate: {
          setPath: placement.path,
          lessonFilename: placement.filename,
        },
      });
      setPrStage("done");
      // The file is committed on the PR branch — no download / paste.
      setPrefilled(true);
      setPopupBlocked(false);
      setSharedUrl(result.url);
      onShared(result.url, editTitle);
      emitCelebration({ type: "confetti" });
    } catch (error) {
      setPrStage("error");
      setPrError(shareErrorMessage(error));
    }
  }

  /** Map a programmatic-share failure to a friendly, actionable message. */
  function shareErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return t(
          "share.pr.err_auth",
          "Your GitHub token was rejected. Check it in Settings > Integrations.",
        );
      }
      if (error.status === 429) {
        return t(
          "share.pr.err_rate",
          "GitHub rate limit reached. Please try again later.",
        );
      }
      return t("share.pr.err_github", "GitHub rejected the request: {detail}").replace(
        "{detail}",
        error.detail,
      );
    }
    return t(
      "share.pr.err_network",
      "Could not reach GitHub. Check your connection and try again.",
    );
  }

  /** Pre-filled-URL share (the fallback / no-token / multi-lesson path,
   *  unchanged behaviour). */
  function runUrlShare(ctx: ShareContext): void {
    const { shipped, primaryShip, filePath, prTitle, body } = ctx;
    setAutomated(false);
    setPrStage("idle");

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

  return {
    // pass-through props the steps render
    lessons,
    checking,
    validationMessage,
    aiSection,
    onRegenerate,
    // step + nav state
    step,
    setStep,
    stepLabel,
    online,
    // step 1 — metadata
    editTitle,
    setEditTitle,
    editSource,
    setEditSource,
    editTarget,
    setEditTarget,
    editLevel,
    setEditLevel,
    singleLesson,
    exerciseCount,
    cardCount,
    minutes,
    sameLanguage,
    placement,
    isEmptyLesson,
    step1Errors,
    step1Blocked,
    authorName,
    setAuthorName,
    showName,
    setShowName,
    // step 2 — duplicate scan
    scanning,
    dup,
    mode,
    setMode,
    note,
    setNote,
    showDiff,
    setShowDiff,
    // step 3 — quality
    liveValidation,
    // step 4 — share + celebration
    sharedUrl,
    automated,
    shareMethod,
    prefilled,
    prBody,
    copied,
    popupBlocked,
    tokenConfigured,
    prStage,
    prError,
    doShare,
    runUrlShare,
    buildShareContext,
    copyPrBody,
  };
}

/** Return shape of {@link useShareWizard}. */
export type UseShareWizardResult = ReturnType<typeof useShareWizard>;
