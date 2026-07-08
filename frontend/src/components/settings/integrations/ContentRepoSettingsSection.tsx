/**
 * Content-repository settings (EXP-023 Phase A/B).
 *
 * - "Official content" — the read-only official repository, with its
 *   cached set + lesson counts. Always first, not editable/removable.
 * - "Your content repositories" — a LIST of connected user repos. Each row
 *   shows status / last sync / counts and offers Sync, Remove (two-step
 *   confirm), and up/down reorder (order = collision precedence; later
 *   wins). An "Add repository" form connects a new repo by URL + branch +
 *   optional token (private/coach repos); the token is kept in the
 *   per-repo token store, not the exportable settings.
 *
 * Read-only consumption (no pushing — Share-Wizard direct-push is Phase B+
 * deferred). Both storage modes via ``getStorage()`` + the content-repos
 * config helpers.
 */

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { BookOpen, Link2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DownloadProgress from "../../../shared/feedback/DownloadProgress";
import { SecretInput } from "../../../shared/forms/SecretInput";
import { buildAddRepoLink, parseAddRepoQr } from "../../../lib/content/placement/share-link";
import { QrImageUpload } from "../../../shared/qr";
import ContentRepoRow from "./ContentRepoRow";
import { useI18n } from "../../../hooks/ui/useI18n";
import { getStorage, resolveStorageMode } from "../../../storage";
import { readLearnerState } from "../../../lib/learning/learnerState";
import {
  planRepoDataDeletion,
  type DeletionPlan,
} from "../../../lib/content/browse/orphan-cleanup";
import RemoveRepoDialog from "./RemoveRepoDialog";
import {
  OFFICIAL_SOURCE,
  addUserRepo,
  isOfficialSource,
  moveUserRepo,
  parseGitHubRepoUrl,
  readUserRepos,
  removeUserRepo,
  syncUserRepo,
  syncPhaseI18n,
  userRepoSource,
  type SyncProgress,
  type UserContentRepo,
} from "../../../lib/content/repos/content-repos";
import { validateUserRepo } from "../../../lib/content/repos/content-repo-validate";
import { clearRepoToken, resolveRepoToken, writeRepoToken } from "../../../lib/content/repos/repo-token";
import {
  clearRepoRating,
  readRepoRating,
  writeRepoRating,
} from "../../../lib/content/repos/repo-rating";
import {
  fetchRecommendedRepos,
  isRecommendedSource,
  recommendedSource,
  type RecommendedRepo,
} from "../../../lib/content/repos/recommended-repos";
import { notify } from "../../../utils/notify";

interface OfficialSummary {
  setCount: number;
  lessonCount: number;
}

/** Progress shown in the UI while a repo loads (#645). */
interface RepoProgress {
  label: string;
  current: number;
  total: number;
}

export default function ContentRepoSettingsSection() {
  const { t } = useI18n();
  const [official, setOfficial] = useState<OfficialSummary | null>(null);
  const [repos, setRepos] = useState<UserContentRepo[]>([]);
  const [recommended, setRecommended] = useState<RecommendedRepo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  /** Feedback for the QR-image-upload prefill (#1317). */
  const [qrNotice, setQrNotice] = useState<
    { kind: "filled" | "invalid" } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RepoProgress | null>(null);
  // #1388 — per-row sync state: the source currently syncing (also the
  // double-start guard) and per-row error messages, reported at the row.
  const [syncing, setSyncing] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // #1445 Part B — the remove flow is a dialog with an opt-in
  // "also delete my progress" choice. ``removeTarget`` is the repo being
  // removed; ``removePlan`` carries the real counts (null while loading).
  const [removeTarget, setRemoveTarget] = useState<UserContentRepo | null>(
    null,
  );
  const [removePlan, setRemovePlan] = useState<DeletionPlan | null>(null);
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [share, setShare] = useState<
    { source: string; link: string; qr: string } | null
  >(null);
  const [shareTab, setShareTab] = useState<"link" | "codes">("link");
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const storage = getStorage();
    const [stored, tokenStatus, recommendedList] = await Promise.all([
      readUserRepos(),
      storage.github.getStatus().catch(() => ({
        configured: false,
        source: "none" as const,
      })),
      fetchRecommendedRepos(),
    ]);
    setRepos(stored);
    setRecommended(recommendedList);
    setTokenConfigured(Boolean(tokenStatus.configured));
    const ratingMap: Record<string, number> = {};
    for (const r of stored) {
      ratingMap[userRepoSource(r.owner, r.repo)] = readRepoRating(
        userRepoSource(r.owner, r.repo),
      );
    }
    setRatings(ratingMap);
    try {
      const { sets } = await storage.contentLoader.listSets();
      const officialSets = sets.filter((s) => isOfficialSource(s.source));
      setOfficial({
        setCount: officialSets.length,
        lessonCount: officialSets.reduce(
          (sum, s) => sum + (s.lesson_count ?? 0),
          0,
        ),
      });
    } catch {
      setOfficial({ setCount: 0, lessonCount: 0 });
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reportProgress = useCallback(
    (p: SyncProgress) => {
      const { key, fallback } = syncPhaseI18n(p.phase);
      setProgress({ label: t(key, fallback), current: p.current, total: p.total });
    },
    [t],
  );

  const handleAdd = useCallback(async () => {
    const parsed = parseGitHubRepoUrl(url);
    if (!parsed) {
      notify.error(
        t(
          "content_repo.error.invalid_url",
          "Enter a valid GitHub repository URL (e.g. owner/repo).",
        ),
      );
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress({
      label: t("content_repo.progress.validating", "Validating repository…"),
      current: 0,
      total: 0,
    });
    try {
      const branchName = branch.trim() || "main";
      const source = userRepoSource(parsed.owner, parsed.repo);
      const validation = await validateUserRepo(
        { owner: parsed.owner, repo: parsed.repo, branch: branchName },
        token.trim() || resolveRepoToken(source),
      );
      if (!validation.ok) {
        setResult({
          ok: false,
          message: t(
            "content_repo.validation.failed",
            "Validation failed: {reason}",
          ).replace("{reason}", validation.reason ?? ""),
        });
        return;
      }
      if (token.trim()) writeRepoToken(source, token.trim());
      await addUserRepo({
        url: url.trim(),
        owner: parsed.owner,
        repo: parsed.repo,
        branch: branchName,
        connected: true,
        last_synced: null,
        set_count: validation.setCount,
        lesson_count: validation.lessonCount,
        trust: 1,
        coach: token.trim().length > 0,
      });
      await syncUserRepo(source, reportProgress);
      await refresh();
      setUrl("");
      setBranch("main");
      setToken("");
      setResult({
        ok: true,
        message: t(
          "content_repo.validation.passed",
          "Validation passed: {sets} sets, {lessons} lessons.",
        )
          .replace("{sets}", String(validation.setCount))
          .replace("{lessons}", String(validation.lessonCount)),
      });
    } catch {
      notify.error(
        t("content_repo.error.save_failed", "Could not add the repository."),
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [url, branch, token, refresh, reportProgress, t]);

  const handleAddRecommended = useCallback(
    async (rec: RecommendedRepo) => {
      const parsed = parseGitHubRepoUrl(rec.url);
      if (!parsed) return;
      setBusy(true);
      setProgress({
        label: t("content_repo.progress.validating", "Validating repository…"),
        current: 0,
        total: 0,
      });
      try {
        const source = userRepoSource(parsed.owner, parsed.repo);
        const validation = await validateUserRepo({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: rec.branch,
        });
        if (!validation.ok) {
          notify.error(
            t("content_repo.validation.failed", "Validation failed: {reason}").replace(
              "{reason}",
              validation.reason ?? "",
            ),
          );
          return;
        }
        await addUserRepo({
          url: rec.url,
          owner: parsed.owner,
          repo: parsed.repo,
          branch: rec.branch,
          connected: true,
          last_synced: null,
          set_count: validation.setCount,
          lesson_count: validation.lessonCount,
          trust: 1,
        });
        await syncUserRepo(source, reportProgress);
        await refresh();
        notify.success(t("content_repo.added", "Repository added."));
      } catch {
        notify.error(
          t("content_repo.error.save_failed", "Could not add the repository."),
        );
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [refresh, reportProgress, t],
  );

  const handleRate = useCallback((source: string, rating: number) => {
    // Toggle off when the same star is clicked again.
    setRatings((prev) => {
      const next = prev[source] === rating ? 0 : rating;
      writeRepoRating(source, next);
      return { ...prev, [source]: next };
    });
  }, []);

  /**
   * Sync ONE source with row-scoped state (#1388): marks the row as
   * running, reports success/failure AT the row, and returns whether it
   * succeeded so the sync-all loop can aggregate without aborting.
   */
  const syncOne = useCallback(
    async (source: string, options: { quiet?: boolean } = {}): Promise<boolean> => {
      setSyncing(source);
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[source];
        return next;
      });
      try {
        const { setCount, lessonCount, trust } = await syncUserRepo(
          source,
          reportProgress,
        );
        if (trust === 0) {
          notify.error(
            t(
              "content_repo.trust.dropped",
              "Synced, but validation failed — this repository is now marked Unverified.",
            ),
          );
        } else if (!options.quiet) {
          notify.success(
            t("content_repo.synced", "Synced: {sets} sets, {lessons} lessons.")
              .replace("{sets}", String(setCount))
              .replace("{lessons}", String(lessonCount)),
          );
        }
        return true;
      } catch {
        setRowErrors((prev) => ({
          ...prev,
          [source]: t(
            "content_repo.error.sync_failed",
            "Sync failed. Try again.",
          ),
        }));
        return false;
      } finally {
        setSyncing(null);
        setProgress(null);
      }
    },
    [reportProgress, t],
  );

  const handleSync = useCallback(
    async (source: string) => {
      if (syncing !== null) return; // double-start guard
      await syncOne(source);
      await refresh();
    },
    [syncing, syncOne, refresh],
  );

  /**
   * Sync EVERY connected repo sequentially with per-repo error isolation
   * (#1388): a failing repo is recorded at its row and the loop continues;
   * the summary reports "X of Y" and names the failures.
   */
  const handleSyncAll = useCallback(async () => {
    if (syncing !== null) return; // double-start guard
    const failed: string[] = [];
    let ok = 0;
    for (const repo of repos) {
      const source = userRepoSource(repo.owner, repo.repo);
      if (await syncOne(source, { quiet: true })) ok += 1;
      else failed.push(source);
    }
    await refresh();
    if (failed.length > 0) {
      notify.error(
        t("content_repo.sync_all.failed", "Synced {ok} of {total}. Failed: {repos}")
          .replace("{ok}", String(ok))
          .replace("{total}", String(repos.length))
          .replace("{repos}", failed.join(", ")),
      );
    } else {
      notify.success(
        t("content_repo.sync_all.done", "Synced {ok} of {total} repositories.")
          .replace("{ok}", String(ok))
          .replace("{total}", String(repos.length)),
      );
    }
  }, [syncing, repos, syncOne, refresh, t]);

  // Open the remove dialog and compute the real "would delete" counts for the
  // opt-in progress-delete choice (#1445 Part B). Counts come from live Dexie
  // queries, never estimates; the dialog shows "Counting…" until they land.
  const handleRemove = useCallback(async (repo: UserContentRepo) => {
    const source = userRepoSource(repo.owner, repo.repo);
    setRemoveTarget(repo);
    setRemovePlan(null);
    if (resolveStorageMode() !== "dexie") return; // no local delete in API mode
    const userId = readLearnerState().userId;
    if (!userId) return;
    try {
      const storage = getStorage();
      const [progress, cards, setsRes] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
        storage.contentLoader.listSets(),
      ]);
      setRemovePlan(
        planRepoDataDeletion(source, progress, cards, setsRes.sets),
      );
    } catch {
      // Counts unavailable → the dialog keeps the checkbox but shows no
      // number (Numeric-Claims discipline: never invent a count).
      setRemovePlan(null);
    }
  }, []);

  const confirmRemove = useCallback(
    async (deleteProgress: boolean) => {
      const repo = removeTarget;
      if (!repo) return;
      const source = userRepoSource(repo.owner, repo.repo);
      setBusy(true);
      try {
        await removeUserRepo(source);
        clearRepoToken(source);
        clearRepoRating(source);
        if (deleteProgress && removePlan) {
          const userId = readLearnerState().userId;
          if (userId) {
            const { lessonsDeleted, cardsDeleted } =
              await getStorage().learningData.deleteLearningData(userId, {
                lessonProgressIds: removePlan.lessonProgressIds,
                setIds: removePlan.orphanedSetIds,
              });
            notify.success(
              t(
                "content_repo.remove.deleted",
                "Removed. Deleted {lessons} lessons and {cards} review cards.",
              )
                .replace("{lessons}", String(lessonsDeleted))
                .replace("{cards}", String(cardsDeleted)),
            );
          }
        }
        setRemoveTarget(null);
        setRemovePlan(null);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [removeTarget, removePlan, refresh, t],
  );

  const cancelRemove = useCallback(() => {
    setRemoveTarget(null);
    setRemovePlan(null);
  }, []);

  const handleShare = useCallback(
    async (repo: UserContentRepo) => {
      const source = userRepoSource(repo.owner, repo.repo);
      if (share?.source === source) {
        setShare(null);
        return;
      }
      const link = buildAddRepoLink({ url: source, branch: repo.branch });
      let qr = "";
      try {
        qr = await QRCode.toDataURL(link, { margin: 1, width: 180 });
      } catch {
        /* QR is a nice-to-have; the copyable link still works */
      }
      setShareTab("link");
      setShare({ source, link, qr });
    },
    [share],
  );

  const handleCopyLink = useCallback(
    async (link: string) => {
      try {
        await navigator.clipboard.writeText(link);
        notify.success(t("content_repo.share.copied", "Link copied."));
      } catch {
        notify.error(t("content_repo.share.copy_failed", "Could not copy."));
      }
    },
    [t],
  );

  const handleMove = useCallback(
    async (source: string, direction: -1 | 1) => {
      setBusy(true);
      try {
        await moveUserRepo(source, direction);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  if (!loaded) {
    return (
      <section
        className="settings-section"
        data-testid="content-repo-section"
        aria-busy="true"
      >
        <h2>{t("content_repo.title", "Content repositories")}</h2>
      </section>
    );
  }

  return (
    <section className="settings-section" data-testid="content-repo-section">
      <h2>{t("content_repo.title", "Content repositories")}</h2>

      {/* Official, read-only. */}
      <div
        className="mb-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
        data-testid="content-repo-official"
      >
        <div className="flex items-center gap-2">
          <BookOpen
            className="h-5 w-5 text-[var(--accent-text)]"
            aria-hidden="true"
          />
          <h3 className="m-0 text-base font-semibold">
            {t("content_repo.official.title", "Official content")}
          </h3>
          <span
            className="ml-auto rounded-sm bg-[var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]"
            data-testid="content-repo-official-badge"
          >
            {t("content_repo.badge.official", "Official")}
          </span>
        </div>
        <p className="m-0 mt-2 text-sm text-[var(--fg-muted)]">
          <code>{OFFICIAL_SOURCE}</code>
        </p>
        <p
          className="m-0 mt-1 text-sm text-[var(--fg-muted)]"
          data-testid="content-repo-official-counts"
        >
          {t("content_repo.official.counts", "{sets} sets · {lessons} lessons")
            .replace("{sets}", String(official?.setCount ?? 0))
            .replace("{lessons}", String(official?.lessonCount ?? 0))}
        </p>
      </div>

      {/* Connected user repos. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-base font-semibold">
          {t("content_repo.user.list_title", "Your content repositories")}
        </h3>
        {/* #1388 — the explicit, honestly-labelled all-repos sync. The
            per-row button syncs ONLY its own source. */}
        {repos.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto min-h-11 gap-2"
            onClick={() => void handleSyncAll()}
            disabled={busy || syncing !== null}
            data-testid="content-repo-sync-all"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("content_repo.action.sync_all", "Sync all")}
          </Button>
        )}
      </div>
      {repos.length === 0 ? (
        <p
          className="m-0 mb-3 text-sm text-[var(--fg-muted)]"
          data-testid="content-repo-empty"
        >
          {t(
            "content_repo.user.empty",
            "No repositories connected. Add one below.",
          )}
        </p>
      ) : (
        <ul
          className="m-0 mb-4 flex list-none flex-col gap-2 p-0"
          data-testid="content-repo-list"
        >
          {repos.map((repo, index) => {
            const source = userRepoSource(repo.owner, repo.repo);
            return (
              <ContentRepoRow
                key={source}
                repo={repo}
                recommended={isRecommendedSource(source, recommended)}
                rating={ratings[source] ?? 0}
                onRate={(n) => handleRate(source, n)}
                isSyncing={syncing === source}
                rowError={rowErrors[source]}
                progressLabel={progress?.label}
                actionsDisabled={busy || syncing !== null}
                confirmRemove={false}
                isFirst={index === 0}
                isLast={index === repos.length - 1}
                share={share?.source === source ? share : null}
                shareTab={shareTab}
                setShareTab={setShareTab}
                token={resolveRepoToken(source)}
                onSync={() => handleSync(source)}
                onMove={(direction) => handleMove(source, direction)}
                onToggleShare={() => handleShare(repo)}
                onRemove={() => handleRemove(repo)}
                onCopyLink={handleCopyLink}
              />
            );
          })}
        </ul>
      )}

      {/* Recommended repositories (curated discovery, EXP-023 Phase C). */}
      {(() => {
        const connected = new Set(
          repos.map((r) => userRepoSource(r.owner, r.repo)),
        );
        const available = recommended.filter((rec) => {
          const s = recommendedSource(rec);
          return s !== null && !connected.has(s);
        });
        if (available.length === 0) return null;
        return (
          <div
            className="mb-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
            data-testid="content-repo-recommended"
          >
            <h3 className="m-0 text-base font-semibold">
              {t("content_repo.recommended.title", "Recommended repositories")}
            </h3>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {available.map((rec) => {
                const source = recommendedSource(rec) as string;
                return (
                  <li
                    key={source}
                    className="flex flex-wrap items-center gap-2"
                    data-testid={`content-repo-recommended-${source}`}
                  >
                    <span className="font-medium">{rec.title ?? source}</span>
                    {rec.description && (
                      <span className="text-sm text-[var(--fg-muted)]">
                        {rec.description}
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto min-h-11"
                      onClick={() => handleAddRecommended(rec)}
                      disabled={busy}
                      data-testid={`content-repo-recommended-add-${source}`}
                    >
                      {t("content_repo.action.add", "Add repository")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* Add a repository. */}
      <div
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
        data-testid="content-repo-add"
      >
        <h3 className="m-0 text-base font-semibold">
          {t("content_repo.add.title", "Add a repository")}
        </h3>
        {!tokenConfigured && (
          <p
            className="m-0 mt-2 text-sm text-[var(--warning)]"
            data-testid="content-repo-token-hint"
          >
            {t(
              "content_repo.token_hint",
              "Private repositories need a token — paste one below, or set a shared token in Settings → Integrations.",
            )}
          </p>
        )}
        {/* #767 — the token field is a SecretInput (type="text", autofill
            suppressed), so no <form> wrapper is needed: connect is a button
            below, and there is no real submit. A form would only add to
            password-manager detection. */}
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {t("content_repo.field.url", "GitHub repository URL")}
            </span>
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              data-testid="content-repo-url"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex max-w-[12rem] flex-col gap-1 text-sm">
              <span className="font-medium">
                {t("content_repo.field.branch", "Branch")}
              </span>
              <Input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                data-testid="content-repo-branch"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">
                {t("content_repo.field.token", "Token (private repos, optional)")}
              </span>
              <SecretInput
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_…"
                data-testid="content-repo-token"
                aria-label={t(
                  "content_repo.field.token",
                  "Token (private repos, optional)",
                )}
              />
            </label>
          </div>
        </div>
        {/* #1317 — upload a QR image of a shared /add-repo link to prefill the
            form, so a coach's QR can be added without a second camera device. */}
        <div className="mt-3 flex flex-col gap-1">
          <QrImageUpload
            testId="content-repo-qr-upload"
            onResult={(raw) => {
              const parsed = parseAddRepoQr(raw);
              if (!parsed) {
                setQrNotice({ kind: "invalid" });
                return;
              }
              setUrl(parsed.url);
              setBranch(parsed.branch);
              setQrNotice({ kind: "filled" });
            }}
            labels={{
              upload: t("content_repo.qr.upload", "Upload QR image"),
              decoding: t("content_repo.qr.decoding", "Reading QR…"),
              decodeError: t(
                "content_repo.qr.no_qr",
                "No QR code found in the image.",
              ),
            }}
          />
          {qrNotice?.kind === "filled" && (
            <p
              className="text-sm text-fg-secondary"
              role="status"
              aria-live="polite"
              data-testid="content-repo-qr-filled"
            >
              {t(
                "content_repo.qr.filled",
                "Repository details filled from the QR code.",
              )}
            </p>
          )}
          {qrNotice?.kind === "invalid" && (
            <p
              className="text-sm text-[var(--danger)]"
              role="status"
              aria-live="polite"
              data-testid="content-repo-qr-invalid"
            >
              {t(
                "content_repo.qr.invalid",
                "The QR code is not a valid 'add repository' link.",
              )}
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 gap-2"
            onClick={handleAdd}
            disabled={busy || !url.trim()}
            data-testid="content-repo-connect"
          >
            <Link2 className="h-5 w-5" aria-hidden="true" />
            {t("content_repo.action.add", "Add repository")}
          </Button>
        </div>
        {progress && (
          <div
            className="mt-3 flex flex-col gap-2"
            role="status"
            aria-live="polite"
            data-testid="content-repo-progress"
          >
            <span className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {progress.total > 0
                ? `${progress.label} (${progress.current}/${progress.total})`
                : progress.label}
            </span>
            {progress.total > 0 && (
              <DownloadProgress
                current={progress.current}
                total={progress.total}
                ariaLabel={progress.label}
                testId="content-repo-progress-bar"
              />
            )}
          </div>
        )}
        {result && (
          <p
            className={
              result.ok
                ? "m-0 mt-3 text-sm font-medium text-[var(--success)]"
                : "m-0 mt-3 text-sm font-medium text-[var(--error)]"
            }
            role="status"
            data-testid="content-repo-result"
          >
            {result.message}
          </p>
        )}
      </div>

      {/* #1445 Part B — remove confirmation with the opt-in progress delete.
          The dialog derives the source + counts from repo/plan, keeping this
          component's JSX free of extra branches. */}
      <RemoveRepoDialog
        repo={removeTarget}
        plan={removePlan}
        canDeleteProgress={resolveStorageMode() === "dexie"}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
      />
    </section>
  );
}
