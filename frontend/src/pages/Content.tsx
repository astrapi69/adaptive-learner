/**
 * /content — Set Browser page (Phase 43 / EXP-002 / F-100 + F-101).
 *
 * Lists every content set the configured sources publish, plus
 * every cached set the user has downloaded. Each row renders:
 * title / language / level / lesson count / download status
 * (not downloaded | downloading | ready | update available) +
 * a single primary action button per row.
 *
 * Storage-mode-agnostic: routes every call through
 * ``getStorage().contentLoader.*`` so the same page works in
 * API mode (backend orchestrator) and Dexie mode (in-browser
 * fetch + IndexedDB cache). The Phase 44 viewer (next phase)
 * will pick up from here — for v1.27.0 the page only manages
 * downloads.
 *
 * Mobile-first responsive: rows stack tightly on viewports
 * narrower than 600px; the action button stays full-width so
 * touch targets stay above 44px.
 */

import {
  BookOpen,
  Brain,
  Calculator,
  ChevronDown,
  ChevronRight,
  Code,
  Download,
  FolderOpen,
  GraduationCap,
  Map as MapIcon,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import ContinueLearning from "../components/ContinueLearning";
import ImportLessonModal from "../components/content/ImportLessonModal";
import {
  buildLessonHaystack,
  buildSetHaystack,
  searchContentIndex,
  splitHighlight,
  type IndexedLesson,
  type IndexedSet,
} from "../lib/content/content-search";
import { useI18n } from "../hooks/useI18n";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSourceLanguages } from "../hooks/useSourceLanguages";
import {
  buildContentTree,
  type SourceGroup,
  type TargetGroup,
} from "../lib/content/content-tree";
import { languageDisplayName } from "../lib/content/language-names";
import {
  validateSetForSharing,
  type ValidationIssue,
  type ValidationResult,
} from "../lib/content/content-validator";
import type { AiValidationResult } from "../lib/content/ai-content-validator";
import ShareWizard from "../components/content/ShareWizard";
import {
  CONTRIBUTOR_THRESHOLD,
  listContributions,
  recordContribution,
  type SharedContribution,
} from "../lib/content/contribution-history";
import { detectGaps } from "../lib/content/gap-detector";
import { useApiKeyStatus } from "../hooks/useApiKeyStatus";
import { readLearnerState } from "../lib/learnerState";
import {
  buildContentSetZip,
  contentSetFileName,
  downloadLessonJson,
  triggerDownload,
  type ExportSetMeta,
} from "../lib/content/lesson-export";
import { getStorage } from "../storage";
import { USER_GENERATED_SOURCE } from "../storage/types";
import type {
  ContentLesson,
  ContentSetEntry,
  ContentSetSource,
} from "../storage/types";
import { notify } from "../utils/notify";

/** Community contribution target repo (manual maintainer review). */
const COMMUNITY_REPO = "astrapi69/adaptive-learner-content";
const COMMUNITY_BRANCH = "main";

/** "Share with Community" opens a GitHub pull request against
 *  COMMUNITY_REPO (the lesson JSON lands at the correct tree path and
 *  the repo CI validates it automatically). Enabled now that the
 *  content repo exists; set false to gate the button off again (e.g.
 *  if the repo is unavailable). Export (JSON / ZIP) is independent of
 *  this — it's a local download. */
const COMMUNITY_SHARING_ENABLED = true;

type DownloadState = "idle" | "downloading" | "done" | "error";

export default function ContentPage() {
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [sets, setSets] = useState<ContentSetEntry[]>([]);
  const [sources, setSources] = useState<ContentSetSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perSetState, setPerSetState] = useState<Record<string, DownloadState>>(
    {},
  );
  // Phase 59C — My Lessons delete-confirm modal target.
  const [deleteTarget, setDeleteTarget] = useState<ContentSetEntry | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  // Phase 59E — import-lesson modal.
  const [showImport, setShowImport] = useState(false);
  // Phase 60 — source-language tree: the learner's active source
  // languages (app language + opted-in extras) rank the tree.
  const { active: activeSources } = useSourceLanguages();
  // Collapsed/expanded state per tree node (keyed by node id).
  // Primary target groups default open; the "other source
  // languages" section defaults collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleNode = (nodeId: string) =>
    setCollapsed((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  // "Other source languages" section is collapsed by default.
  const [otherExpanded, setOtherExpanded] = useState(false);
  // Phase 60 — community-share validation gate.
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
  const [shareExistingFilenames, setShareExistingFilenames] = useState<
    string[]
  >([]);
  // Phase 64D — local contribution history (localStorage; no server).
  const [contributions, setContributions] = useState<SharedContribution[]>([]);
  useEffect(() => {
    setContributions(listContributions());
  }, []);
  // Keys of AI suggestions the user has auto-applied (so the button
  // flips to "applied" and isn't re-run).
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());
  const { hasKey, activeProvider } = useApiKeyStatus();
  const userId = readLearnerState().userId;

  // --- Content Browser search -----------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<IndexedSet[]>([]);
  // The index loads every cached lesson, so build it LAZILY — only once
  // the learner actually engages the search (focus or first keystroke).
  // This keeps the /content mount cheap for the (common) browse case.
  const [searchActivated, setSearchActivated] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce the query (300ms) so the index isn't re-scanned on every
  // keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Cmd/Ctrl+K focuses the search input from anywhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Build the search index once the downloaded sets are known. Loads
  // every CACHED lesson (title + cards) so card-content search works;
  // not-yet-downloaded sets are indexed at set level only. Keyed on a
  // signature of the downloaded sets so it rebuilds after a download.
  const downloadedSig = sets
    .filter((entry) => entry.source !== USER_GENERATED_SOURCE)
    .map((entry) => `${entry.source}#${entry.id}@${entry.cached_version ?? ""}`)
    .join(",");
  useEffect(() => {
    let cancelled = false;
    if (!searchActivated) return;
    const downloaded = sets.filter(
      (entry) => entry.source !== USER_GENERATED_SOURCE,
    );
    if (downloaded.length === 0) {
      setSearchIndex([]);
      return;
    }
    void (async () => {
      const built: IndexedSet[] = [];
      for (const entry of downloaded) {
        const domainLbl = t(
          `content.tree.domain_${entry.domain ?? "language"}`,
          entry.domain ?? "",
        );
        const indexed: IndexedSet = {
          setId: entry.id,
          source: entry.source,
          setHaystack: buildSetHaystack(
            entry.title,
            entry.description,
            domainLbl,
            entry.tags ?? [],
          ),
          lessons: [],
        };
        // Only cached sets have readable lessons; skip the rest so we
        // don't fire doomed listLessons calls.
        if (entry.cached_version) {
          try {
            const listing = await getStorage().contentLoader.listLessons(
              entry.source,
              entry.id,
            );
            const lessons = await Promise.all(
              listing.lessons.map(async (filename) => {
                try {
                  const lesson = await getStorage().contentLoader.getLesson(
                    entry.source,
                    entry.id,
                    filename,
                  );
                  return {
                    filename,
                    title: lesson.title,
                    haystack: buildLessonHaystack(
                      lesson.title,
                      lesson.cards ?? [],
                    ),
                  } satisfies IndexedLesson;
                } catch {
                  return null;
                }
              }),
            );
            indexed.lessons = lessons.filter(
              (lesson): lesson is IndexedLesson => lesson !== null,
            );
          } catch {
            /* set not cached / unreadable -> set-level index only */
          }
        }
        built.push(indexed);
      }
      if (!cancelled) setSearchIndex(built);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadedSig, searchActivated]);

  const searchResult = useMemo(
    () => searchContentIndex(searchIndex, debouncedQuery),
    [searchIndex, debouncedQuery],
  );

  /** Highlight raw query occurrences inside a label. */
  const highlightNodes = (text: string, query: string) =>
    splitHighlight(text, query).map((seg, i) =>
      seg.match ? (
        <mark key={i} className="bg-transparent font-semibold text-accent">
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    );

  const loadSets = useCallback(async () => {
    try {
      const data = await getStorage().contentLoader.listSets();
      setSets(data.sets);
      setSources(data.sources);
    } catch (err) {
      notify.error(
        t("content.error.list_failed", "Could not load content sets."),
        { apiError: err instanceof Error ? undefined : undefined },
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSets();
  };

  const setKey = (entry: ContentSetEntry): string =>
    `${entry.source}#${entry.id}`;

  /** Navigate to a specific lesson file (used by search results). */
  const openLessonFile = (source: string, id: string, filename: string) => {
    const slug = source.replace(/\//g, "--");
    navigate(
      `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`,
    );
  };

  const handleOpenLesson = async (entry: ContentSetEntry) => {
    // Phase 44 / EXP-002 / 3B: jump to the set's first
    // cached lesson. Future enhancements can swap this for
    // a dedicated per-set lesson list page.
    try {
      const listing = await getStorage().contentLoader.listLessons(
        entry.source,
        entry.id,
      );
      const first = listing.lessons[0];
      if (!first) {
        notify.warning(
          t(
            "content.warning.no_lessons_in_set",
            "This set has no lessons yet.",
          ),
        );
        return;
      }
      const slug = entry.source.replace(/\//g, "--");
      navigate(
        `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(entry.id)}/${encodeURIComponent(first)}`,
      );
    } catch (err) {
      notify.error(
        t("content.error.open_failed", "Could not open the lesson."),
        {
          apiError: err instanceof Error ? undefined : undefined,
        },
      );
    }
  };

  // Phase 59C — edit a user-generated lesson: jump back to its
  // source conversation's import page, where re-saving overwrites
  // the set in place. Only analysis-sourced sets carry a
  // recoverable conversation id (set id is ``analysis-{convId}``).
  const handleEditUserSet = (entry: ContentSetEntry) => {
    const convId = entry.id.replace(/^analysis-/, "");
    navigate(`/import/${encodeURIComponent(convId)}`);
  };

  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(
        deleteTarget.source,
        deleteTarget.id,
      );
      setSets((prev) =>
        prev.filter(
          (row) =>
            !(row.source === deleteTarget.source && row.id === deleteTarget.id),
        ),
      );
      notify.success(t("content.my_lessons.deleted", "Lesson deleted."));
      setDeleteTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.my_lessons.delete_failed", "Could not delete the lesson.")} ${detail}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  // Phase 59D — export + community sharing.
  const exportMeta = (entry: ContentSetEntry): ExportSetMeta => ({
    set_id: entry.id,
    title: entry.title,
    language: entry.language,
    level: entry.level,
    description: entry.description,
  });

  const fetchSetLessons = async (
    entry: ContentSetEntry,
  ): Promise<ContentLesson[]> => {
    const listing = await getStorage().contentLoader.listLessons(
      entry.source,
      entry.id,
    );
    return Promise.all(
      listing.lessons.map((f) =>
        getStorage().contentLoader.getLesson(entry.source, entry.id, f),
      ),
    );
  };

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
  const loadSimilarLessonsFor = async (
    entry: ContentSetEntry,
  ): Promise<ContentLesson[]> => {
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

  const handleExportJson = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      if (lessons.length === 1) {
        downloadLessonJson(lessons[0]);
      } else {
        const blob = await buildContentSetZip(exportMeta(entry), lessons);
        triggerDownload(blob, contentSetFileName(entry.title));
      }
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`,
      );
    }
  };

  const handleExportSet = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      const blob = await buildContentSetZip(exportMeta(entry), lessons);
      triggerDownload(blob, contentSetFileName(entry.title));
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`,
      );
    }
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
          ? lesson.cards.map((c) =>
              c.id === targetId ? { ...c, back: text } : c,
            )
          : lesson.cards,
      steps:
        kind === "step"
          ? lesson.steps.map((s) =>
              s.id === targetId ? { ...s, body: text } : s,
            )
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
      notify.error(
        `${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`,
      );
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

  // Phase 60 C5b — render the AI review's issue groups. Translation
  // + grammar issues carry a concrete correction, so they get an
  // "Apply" auto-fix button; distractor + level + cultural items are
  // advisory only.
  const renderAiIssues = () => {
    if (!aiResult) return null;
    const fixBtn = (
      fixKey: string,
      kind: "card" | "step",
      targetId: string,
      text: string,
    ) =>
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

  const handleDownload = async (entry: ContentSetEntry) => {
    const key = setKey(entry);
    setPerSetState((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      const updated = await getStorage().contentLoader.downloadSet(
        entry.source,
        entry.id,
      );
      setSets((prev) =>
        prev.map((row) =>
          row.source === entry.source && row.id === entry.id ? updated : row,
        ),
      );
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      notify.success(
        t("content.toast.downloaded", "Set downloaded and ready to use."),
      );
    } catch (err) {
      setPerSetState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(
        t("content.error.download_failed", "Could not download the set."),
        {
          apiError: err instanceof Error ? undefined : undefined,
        },
      );
    }
  };

  if (loading) {
    return (
      <main
        id="main"
        className="page content-page"
        data-testid="content-loading"
      >
        <p>{t("content.loading", "Loading content sets…")}</p>
      </main>
    );
  }

  // Phase 59C — user-generated lessons ("My Lessons") render in
  // their own section, separate from downloaded content sets.
  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);
  const originLabel = (entry: ContentSetEntry): string => {
    if (entry.domain === "adaptive")
      return t("content.my_lessons.from_adaptive", "from adaptive lesson");
    if (entry.domain === "imported")
      return t("content.my_lessons.from_imported", "imported");
    return t("content.my_lessons.from_analysis", "from analysis");
  };

  // Phase 60 — group downloaded sets into the source -> target ->
  // level tree, ranked by the learner's active source languages.
  const tree = buildContentTree(downloadedSets, activeSources);

  const renderSetRow = (entry: ContentSetEntry) => {
    const key = setKey(entry);
    const downloadState = perSetState[key] ?? "idle";
    const isCached = entry.cached_version !== null;
    return (
      <li
        key={key}
        className="content-set-row"
        data-testid={`content-set-${entry.id}`}
      >
        <div className="content-set-meta">
          <h4>
            {entry.title}
            {entry.title_native && entry.title_native !== entry.title && (
              <span className="content-set-native"> · {entry.title_native}</span>
            )}
            <span
              className="content-set-source"
              data-testid={`content-set-${entry.id}-source`}
            >
              {entry.source.startsWith("bundled:")
                ? t("content.source.bundled", "Bundled")
                : t("content.source.github", "GitHub")}
            </span>
          </h4>
          <p className="content-set-tags">
            <span>
              {entry.source_language.toUpperCase()}
              {"→"}
              {entry.target_language.toUpperCase()}
              {" · "}
              {entry.level}
              {" · "}
              {entry.lesson_count} {t("content.lessons", "lessons")}
            </span>
            {isCached && (
              <span
                className="content-set-cached"
                data-testid={`content-set-${entry.id}-cached`}
              >
                {t("content.status.ready", "Ready")} ({entry.cached_version})
              </span>
            )}
            {entry.update_available && (
              <span
                className="content-set-update"
                data-testid={`content-set-${entry.id}-update`}
              >
                {t("content.status.update_available", "Update available")}
              </span>
            )}
          </p>
          {entry.description && (
            <p className="content-set-desc">{entry.description}</p>
          )}
        </div>
        <div className="content-set-action">
          <span
            className="sr-only"
            role="status"
            aria-live="polite"
            data-testid={`content-set-${entry.id}-status`}
          >
            {downloadState === "downloading"
              ? t("content.status.downloading", "Downloading…")
              : isCached && !entry.update_available
                ? t("content.status.ready", "Ready")
                : entry.update_available
                  ? t("content.status.update_available", "Update available")
                  : ""}
          </span>
          {isCached && (
            <Button
              type="button"
              className="content-set-open-btn"
              onClick={() => handleOpenLesson(entry)}
              data-testid={`content-set-${entry.id}-open`}
            >
              <BookOpen size={14} aria-hidden="true" />
              {t("content.action.open", "Open")}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="content-set-download-btn"
            onClick={() => handleDownload(entry)}
            disabled={
              downloadState === "downloading" ||
              (isCached && !entry.update_available) ||
              !online
            }
            title={
              !online
                ? t("pwa.action_unavailable", "Not available offline")
                : undefined
            }
            data-testid={`content-set-${entry.id}-action`}
          >
            {downloadState === "downloading" ? (
              <>
                <Download size={14} aria-hidden="true" />
                {t("content.status.downloading", "Downloading…")}
              </>
            ) : isCached && !entry.update_available ? (
              <>
                <FolderOpen size={14} aria-hidden="true" />
                {t("content.action.installed", "Installed")}
              </>
            ) : entry.update_available ? (
              <>
                <Download size={14} aria-hidden="true" />
                {t("content.action.update", "Update")}
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                {t("content.action.download", "Download")}
              </>
            )}
          </Button>
        </div>
      </li>
    );
  };

  const renderTargetGroup = (sourceLang: string, group: TargetGroup) => {
    const nodeId = `${sourceLang}/${group.targetLanguage}`;
    // Primary target groups default open; collapse only when the
    // user explicitly toggled this node closed.
    const isCollapsed = collapsed[nodeId] === true;
    const targetName = languageDisplayName(group.targetLanguage, lang);
    return (
      <div
        key={nodeId}
        className="content-target-group"
        data-testid={`content-target-${nodeId}`}
      >
        <button
          type="button"
          className="content-tree-toggle"
          onClick={() => toggleNode(nodeId)}
          aria-expanded={!isCollapsed}
          data-testid={`content-target-${nodeId}-toggle`}
        >
          {isCollapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
          <span className="content-tree-label">
            {t("content.tree.learn", "Learn {lang}").replace(
              "{lang}",
              targetName,
            )}{" "}
            ({group.targetLanguage.toUpperCase()})
          </span>
          <span className="content-tree-count">
            {group.setCount} {t("content.tree.sets", "sets")}
          </span>
        </button>
        {!isCollapsed && (
          <div className="content-target-body">
            {group.levels.map((levelGroup) => (
              <div
                key={levelGroup.level}
                className="content-level-group"
                data-testid={`content-level-${nodeId}-${levelGroup.level}`}
              >
                <h3 className="content-level-title">
                  {levelGroup.level} · {levelGroup.sets.length}{" "}
                  {t("content.lessons", "lessons")}
                </h3>
                <ul className="content-set-list">
                  {levelGroup.sets.map((entry) => renderSetRow(entry))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSourceTargets = (group: SourceGroup) =>
    group.targets.map((target) => renderTargetGroup(group.sourceLanguage, target));

  // Domain icon for the knowledge ("Wissen") section. Unknown domains
  // fall back to a graduation-cap glyph.
  const domainIcon = (domain: string) => {
    if (domain === "programming") return <Code size={16} aria-hidden="true" />;
    if (domain === "psychology") return <Brain size={16} aria-hidden="true" />;
    if (domain === "math")
      return <Calculator size={16} aria-hidden="true" />;
    return <GraduationCap size={16} aria-hidden="true" />;
  };

  const domainLabel = (domain: string) =>
    t(
      `content.tree.domain_${domain}`,
      domain.charAt(0).toUpperCase() + domain.slice(1),
    );

  return (
    <main id="main" className="page content-page" data-testid="content-page">
      <header className="content-header">
        <h1>{t("content.page_title", "Content sets")}</h1>
        <button
          type="button"
          className="content-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="content-refresh"
          aria-label={t("content.action.refresh", "Refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing
            ? t("content.action.refreshing", "Refreshing…")
            : t("content.action.refresh", "Refresh")}
        </button>
      </header>
      <p className="content-intro">
        {t(
          "content.intro",
          "Pre-built lesson sets you can use without an API key. Downloads are cached locally and work offline after the first fetch.",
        )}
      </p>

      {sources.length > 0 && (
        <p className="content-sources" data-testid="content-sources">
          {t("content.sources", "Sources")}:{" "}
          {sources.map((src) => `${src.source} @ ${src.branch}`).join(", ")}
        </p>
      )}

      {/* UX overhaul C1 — compact toolbar: search FIRST (full width),
          then icon-only action buttons (icon + label from md up). */}
      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        data-testid="content-toolbar"
      >
        <div
          className="relative flex min-w-[200px] flex-1 items-center"
          data-testid="content-search-bar"
        >
          <Search
            size={18}
            className="pointer-events-none absolute left-3 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onFocus={() => setSearchActivated(true)}
            onChange={(e) => {
              setSearchActivated(true);
              setSearchQuery(e.target.value);
            }}
            placeholder={t("content.search.placeholder", "Search lessons...")}
            aria-label={t("content.search.placeholder", "Search lessons...")}
            className="pl-10 pr-10"
            data-testid="content-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              aria-label={t("content.search.clear", "Clear search")}
              data-testid="content-search-clear"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] gap-2"
            onClick={() => setShowImport(true)}
            title={t("content.import_lesson.button", "Import Lesson")}
            aria-label={t("content.import_lesson.button", "Import Lesson")}
            data-testid="content-import-lesson"
          >
            <Upload className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.import_lesson.button", "Import Lesson")}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/import")}
            title={t("content.import_chat.button", "Import Chat")}
            aria-label={t("content.import_chat.button", "Import Chat")}
            data-testid="content-import-chat"
          >
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.import_chat.button", "Import Chat")}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/learning-path")}
            title={t("nav.learning_path", "Learning Path")}
            aria-label={t("nav.learning_path", "Learning Path")}
            data-testid="content-learning-path"
          >
            <MapIcon className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("nav.learning_path", "Learning Path")}
            </span>
          </Button>
          <Button
            type="button"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/create-lesson")}
            title={t("content.create_lesson.button", "Create New Lesson")}
            aria-label={t("content.create_lesson.button", "Create New Lesson")}
            data-testid="content-create-lesson"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.create_lesson.button", "Create New Lesson")}
            </span>
          </Button>
        </div>
      </div>

      {/* UX overhaul C3 — Continue Learning: the learner's recent
          activity, directly below the search, above the tree. Hidden
          while a search is active (results replace the browse view)
          and when there is no recent activity (the tree covers
          discovery). */}
      {!searchResult.active && userId && (
        <div className="mb-4">
          <ContinueLearning
            userId={userId}
            maxItems={5}
            showWhenEmpty={false}
          />
        </div>
      )}

      {/* Phase 59C — My Lessons (user-generated sets). Hidden while a
          search is active (results replace the browse view). */}
      {!searchResult.active && (
      <section
        className="content-section content-my-lessons"
        data-testid="content-my-lessons"
      >
        <div className="content-section-head">
          <h2>{t("content.my_lessons.title", "My Lessons")}</h2>
        </div>
        {userSets.length === 0 ? (
          <p className="content-empty" data-testid="content-my-lessons-empty">
            {t(
              "content.my_lessons.empty",
              "Import a chat and analyze it to create your first lesson.",
            )}
          </p>
        ) : (
          <ul
            className="content-set-list"
            data-testid="content-my-lessons-list"
          >
            {userSets.map((entry) => (
              <li
                key={setKey(entry)}
                className="content-set-row"
                data-testid={`my-lesson-${entry.id}`}
              >
                <div className="content-set-meta">
                  <h3>{entry.title}</h3>
                  <p className="content-set-tags">
                    <span>
                      {entry.language.toUpperCase()}
                      {" · "}
                      {entry.lesson_count} {t("content.lessons", "lessons")}
                      {" · "}
                      {originLabel(entry)}
                    </span>
                  </p>
                </div>
                <div className="content-set-action">
                  <Button
                    type="button"
                    onClick={() => handleOpenLesson(entry)}
                    data-testid={`my-lesson-${entry.id}-play`}
                  >
                    <Play size={14} aria-hidden="true" />
                    {t("content.my_lessons.play", "Play")}
                  </Button>
                  {entry.domain === "analysis" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleEditUserSet(entry)}
                      data-testid={`my-lesson-${entry.id}-edit`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      {t("content.my_lessons.edit", "Edit")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleExportJson(entry)}
                    data-testid={`my-lesson-${entry.id}-export`}
                  >
                    <Download size={14} aria-hidden="true" />
                    {t("content.my_lessons.export", "Export")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleExportSet(entry)}
                    data-testid={`my-lesson-${entry.id}-export-set`}
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    {t("content.my_lessons.export_set", "Export as set")}
                  </Button>
                  {COMMUNITY_SHARING_ENABLED && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleShare(entry)}
                      data-testid={`my-lesson-${entry.id}-share`}
                    >
                      <Share2 className="h-5 w-5" aria-hidden="true" />
                      {t("content.my_lessons.share", "Share with Community")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDeleteTarget(entry)}
                    data-testid={`my-lesson-${entry.id}-delete`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("content.my_lessons.delete", "Delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Phase 64D — My Contributions (local sharing history). */}
      {!searchResult.active && contributions.length > 0 && (
        <section
          className="content-section content-my-contributions"
          data-testid="content-my-contributions"
        >
          <h2>{t("content.contributions.title", "My Contributions")}</h2>
          <p data-testid="content-contributions-count">
            {t(
              "content.contributions.count",
              "You've contributed {n} lesson(s) to the community.",
            ).replace("{n}", String(contributions.length))}
          </p>
          {contributions.length >= CONTRIBUTOR_THRESHOLD && (
            <p
              className="content-contributor-badge"
              data-testid="content-contributor-badge"
            >
              {t(
                "content.contributions.contributor",
                "Community Contributor — {n} lessons shared!",
              ).replace("{n}", String(contributions.length))}
            </p>
          )}
          <ul
            className="content-contributions-list"
            data-testid="content-contributions-list"
          >
            {contributions.map((c) => (
              <li key={c.github_url} className="content-contribution-row">
                <span className="content-contribution-title">{c.title}</span>
                <span className="content-contribution-date">
                  {c.shared_at.slice(0, 10)}
                </span>
                <span className="content-contribution-status">
                  {t(`content.contributions.status_${c.status}`, c.status)}
                </span>
                <a
                  href={c.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("content.contributions.view", "View")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {searchResult.active ? (
        <section
          className="content-search-results space-y-4"
          data-testid="content-search-results"
        >
          {searchResult.matches.length === 0 ? (
            <div
              className="content-empty"
              data-testid="content-search-empty"
            >
              <p>
                {t(
                  "content.search.no_results",
                  "No results for '{query}'",
                ).replace("{query}", searchResult.query.trim())}
              </p>
              <p className="muted">
                {t("content.search.hint", "Try a different search term")}
              </p>
            </div>
          ) : (
            <>
              <p
                className="text-sm text-muted-foreground"
                data-testid="content-search-count"
              >
                {t("content.search.results", "{count} results").replace(
                  "{count}",
                  String(searchResult.lessonCount),
                )}
              </p>
              {searchResult.matches.map((match) => {
                const entry = downloadedSets.find(
                  (s) => s.source === match.source && s.id === match.setId,
                );
                if (!entry) return null;
                return (
                  <div
                    key={`${match.source}#${match.setId}`}
                    data-testid={`content-search-set-${match.setId}`}
                  >
                    <h3 className="font-semibold">
                      {highlightNodes(entry.title, searchResult.query)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        ·{" "}
                        {(entry.source_language || "").toUpperCase()}
                        {entry.target_language
                          ? ` → ${entry.target_language.toUpperCase()}`
                          : ""}{" "}
                        {entry.level}
                      </span>
                    </h3>
                    <ul className="mt-1 space-y-1 pl-4">
                      {match.matchedLessons.map((lessonRef) => (
                        <li key={lessonRef.filename}>
                          <button
                            type="button"
                            className="text-left text-accent hover:underline"
                            onClick={() =>
                              openLessonFile(
                                match.source,
                                match.setId,
                                lessonRef.filename,
                              )
                            }
                            data-testid={`content-search-lesson-${match.setId}-${lessonRef.filename}`}
                          >
                            {highlightNodes(
                              lessonRef.title,
                              searchResult.query,
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </section>
      ) : (
        <>
      {/* Phase 64E — encouraging gap suggestions ("Can you help?"). */}
      {(() => {
        const gaps = detectGaps(downloadedSets).slice(0, 5);
        if (gaps.length === 0) return null;
        return (
          <section
            className="content-section content-gaps"
            data-testid="content-gaps"
          >
            <h2>{t("content.gaps.title", "Missing Lessons")}</h2>
            <p className="content-gaps-intro">
              {t(
                "content.gaps.intro",
                "The community library has a few gaps. Can you help fill one?",
              )}
            </p>
            <ul className="content-gaps-list" data-testid="content-gaps-list">
              {gaps.map((gap, i) => (
                <li
                  key={`${gap.kind}-${gap.source}-${gap.target}-${gap.level}-${i}`}
                  className="content-gap-row"
                >
                  <span>
                    {(gap.kind === "next_level"
                      ? t(
                          "content.gaps.next_level",
                          "{target} for {source} speakers has lessons, but {level} doesn't exist yet.",
                        )
                      : t(
                          "content.gaps.missing_pair",
                          "{target} {level} for {source} speakers doesn't exist yet.",
                        )
                    )
                      .replace("{target}", languageDisplayName(gap.target, lang))
                      .replace("{source}", languageDisplayName(gap.source, lang))
                      .replace("{level}", gap.level)}
                  </span>{" "}
                  <a
                    href={`https://github.com/${COMMUNITY_REPO}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="content-gap-help"
                  >
                    {t("content.gaps.help", "Can you help?")}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <h2 className="content-section-title">
        {t("content.my_lessons.downloaded_title", "Downloaded sets")}
      </h2>
      {downloadedSets.length === 0 ? (
        <p className="content-empty" data-testid="content-empty">
          {t(
            "content.empty",
            "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
          )}
        </p>
      ) : (
        <div className="content-tree" data-testid="content-tree">
          {/* Primary: the source language(s) the learner speaks. */}
          {tree.primary.length > 0 && (
            <section
              className="content-source-primary"
              data-testid="content-source-primary"
            >
              <h2 className="content-source-heading">
                {t("content.tree.i_speak", "I speak")}:{" "}
                {tree.primary
                  .map((g) => languageDisplayName(g.sourceLanguage, lang))
                  .join(", ")}
              </h2>
              {tree.primary.map((group) => (
                <div
                  key={group.sourceLanguage}
                  data-testid={`content-source-${group.sourceLanguage}`}
                >
                  {tree.primary.length > 1 && (
                    <h3 className="content-source-sub">
                      {languageDisplayName(group.sourceLanguage, lang)}
                    </h3>
                  )}
                  {renderSourceTargets(group)}
                </div>
              ))}
            </section>
          )}

          {tree.primary.length === 0 && (
            <p className="content-empty" data-testid="content-no-primary">
              {t(
                "content.tree.no_primary",
                "No sets for your language yet. Browse other source languages below.",
              )}
            </p>
          )}

          {/* Other source languages — collapsed by default. */}
          {tree.other.length > 0 && (
            <section
              className="content-source-other"
              data-testid="content-source-other"
            >
              <button
                type="button"
                className="content-tree-toggle content-other-toggle"
                onClick={() => setOtherExpanded((v) => !v)}
                aria-expanded={otherExpanded}
                data-testid="content-other-toggle"
              >
                {otherExpanded ? (
                  <ChevronDown size={16} aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} aria-hidden="true" />
                )}
                <span className="content-tree-label">
                  {t("content.tree.other_sources", "Other source languages")}
                </span>
                <span className="content-tree-count">{tree.other.length}</span>
              </button>
              {otherExpanded && (
                <div className="content-other-body">
                  {tree.other.map((group) => (
                    <div
                      key={group.sourceLanguage}
                      data-testid={`content-source-${group.sourceLanguage}`}
                    >
                      <h3 className="content-source-sub">
                        {t("content.tree.for_speakers", "For {lang} speakers").replace(
                          "{lang}",
                          languageDisplayName(group.sourceLanguage, lang),
                        )}
                      </h3>
                      {renderSourceTargets(group)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* v1.3 — Knowledge ("Wissen"): non-language domain sets,
              grouped by domain with a domain-specific icon. */}
          {tree.knowledge.length > 0 && (
            <section
              className="content-source-knowledge"
              data-testid="content-knowledge"
            >
              <h2 className="content-source-heading">
                {t("content.tree.knowledge", "Knowledge")}
              </h2>
              {tree.knowledge.map((group) => (
                <div
                  key={group.domain}
                  data-testid={`content-domain-${group.domain}`}
                >
                  <h3 className="content-source-sub content-domain-sub">
                    {domainIcon(group.domain)} {domainLabel(group.domain)}
                  </h3>
                  {group.sets.map((entry) => renderSetRow(entry))}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
        </>
      )}

      <ImportLessonModal
        open={showImport}
        onCancel={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          void loadSets();
        }}
      />

      {shareTarget && (
        <ShareWizard
          entry={shareTarget}
          lessons={shareLessons}
          validation={shareResult}
          checking={shareChecking}
          knownSets={downloadedSets}
          existingFilenames={shareExistingFilenames}
          loadSimilarLessons={() => loadSimilarLessonsFor(shareTarget)}
          validationMessage={validationMessage}
          repo={COMMUNITY_REPO}
          branch={COMMUNITY_BRANCH}
          onShared={(url, title) => {
            recordContribution({
              lesson_id: shareTarget.id,
              title,
              shared_at: new Date().toISOString(),
              github_url: url,
              status: "submitted",
            });
            setContributions(listContributions());
          }}
          onRegenerate={() => {
            // BUG B — rebuild an empty lesson from its source. Analysis
            // sets jump back to their import page (re-saving overwrites
            // the set); other origins go to the Lesson Creator.
            const target = shareTarget;
            closeShareModal();
            if (target.domain === "analysis") handleEditUserSet(target);
            else navigate("/create-lesson");
          }}
          onClose={closeShareModal}
          aiSection={
            shareResult && hasKey ? (
              <section
                className="content-ai-validation"
                data-testid="content-ai-validation"
              >
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
                        aiResult.overall === "pass"
                          ? "content-share-passed"
                          : "content-share-failed"
                      }
                    >
                      {aiResult.overall === "pass"
                        ? t("content.ai_validation.ai_passed", "AI review: looks good.")
                        : t("content.ai_validation.ai_review", "AI review: suggestions below.")}
                      {" "}
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
      )}

      {deleteTarget && (
        <div className="modal-overlay" data-testid="my-lesson-delete-modal">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lesson-title"
          >
            <h2 id="delete-lesson-title" className="modal-title">
              {deleteTarget.title}
            </h2>
            <p>
              {t(
                "content.my_lessons.delete_confirm",
                "Delete this lesson? This cannot be undone.",
              )}
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                data-testid="my-lesson-delete-cancel"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteUserSet}
                disabled={deleting}
                data-testid="my-lesson-delete-confirm"
              >
                {deleting
                  ? t("common.loading", "Loading…")
                  : t("content.my_lessons.delete", "Delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
