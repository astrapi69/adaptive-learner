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
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  FolderGit2,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Shield,
  ShieldQuestion,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DownloadProgress from "../../../shared/feedback/DownloadProgress";
import { SecretInput } from "../../../shared/forms/SecretInput";
import { buildAddRepoLink } from "../../../lib/content/placement/share-link";
import InviteCodesPanel from "../../content/invites/InviteCodesPanel";
import { useI18n } from "../../../hooks/ui/useI18n";
import { getStorage } from "../../../storage";
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RepoProgress | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
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

  const handleSync = useCallback(
    async (source: string) => {
      setBusy(true);
      try {
        const { setCount, lessonCount, trust } = await syncUserRepo(
          source,
          reportProgress,
        );
        await refresh();
        if (trust === 0) {
          notify.error(
            t(
              "content_repo.trust.dropped",
              "Synced, but validation failed — this repository is now marked Unverified.",
            ),
          );
        } else {
          notify.success(
            t("content_repo.synced", "Synced: {sets} sets, {lessons} lessons.")
              .replace("{sets}", String(setCount))
              .replace("{lessons}", String(lessonCount)),
          );
        }
      } catch {
        notify.error(
          t("content_repo.error.sync_failed", "Sync failed. Try again."),
        );
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [refresh, reportProgress, t],
  );

  const handleRemove = useCallback(
    async (source: string) => {
      if (confirmRemove !== source) {
        setConfirmRemove(source);
        return;
      }
      setBusy(true);
      try {
        await removeUserRepo(source);
        clearRepoToken(source);
        clearRepoRating(source);
        setConfirmRemove(null);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [confirmRemove, refresh],
  );

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
      <h3 className="mb-2 text-base font-semibold">
        {t("content_repo.user.list_title", "Your content repositories")}
      </h3>
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
              <li
                key={source}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
                data-testid={`content-repo-item-${repo.owner}-${repo.repo}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <FolderGit2
                    className="h-5 w-5 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{source}</span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    @{repo.branch}
                  </span>
                  {repo.trust === 1 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-[var(--success-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--success)]"
                      data-testid={`content-repo-trust-${repo.owner}-${repo.repo}`}
                    >
                      <Shield className="h-3 w-3" aria-hidden="true" />
                      {t("content_repo.trust.validated", "Validated")}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-[var(--warning-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--warning)]"
                      data-testid={`content-repo-trust-${repo.owner}-${repo.repo}`}
                    >
                      <ShieldQuestion className="h-3 w-3" aria-hidden="true" />
                      {t("content_repo.trust.unknown", "Unverified")}
                    </span>
                  )}
                  {repo.coach && (
                    <span className="rounded-sm bg-[var(--info-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--info)]">
                      {t("content_repo.badge.coach", "Coach")}
                    </span>
                  )}
                  {isRecommendedSource(source, recommended) && (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg-surface))] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]"
                      data-testid={`content-repo-recommended-badge-${repo.owner}-${repo.repo}`}
                    >
                      <Star className="h-3 w-3" aria-hidden="true" />
                      {t("content_repo.trust.recommended", "Officially recommended")}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 text-sm text-[var(--fg-muted)]">
                  {repo.last_synced
                    ? t("content_repo.last_sync", "Last sync: {when}").replace(
                        "{when}",
                        new Date(repo.last_synced).toLocaleString(),
                      )
                    : t("content_repo.status.never_synced", "Not synced yet")}
                  {" · "}
                  {t("content_repo.user.counts", "{sets} sets · {lessons} lessons")
                    .replace("{sets}", String(repo.set_count))
                    .replace("{lessons}", String(repo.lesson_count))}
                </p>
                <div
                  className="mt-2 flex items-center gap-1"
                  role="radiogroup"
                  aria-label={t("content_repo.rating.aria", "Your rating")}
                  data-testid={`content-repo-rating-${repo.owner}-${repo.repo}`}
                >
                  <span className="mr-1 text-xs text-[var(--fg-muted)]">
                    {t("content_repo.rating.label", "Your rating")}
                  </span>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const rated = (ratings[source] ?? 0) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className="inline-flex h-11 w-7 items-center justify-center text-[var(--star)]"
                        onClick={() => handleRate(source, n)}
                        role="radio"
                        aria-checked={(ratings[source] ?? 0) === n}
                        aria-label={t(
                          "content_repo.rating.star",
                          "Rate {n} of 5",
                        ).replace("{n}", String(n))}
                        data-testid={`content-repo-rating-${repo.owner}-${repo.repo}-star-${n}`}
                      >
                        <Star
                          className="h-4 w-4"
                          aria-hidden="true"
                          fill={rated ? "currentColor" : "none"}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11 gap-2"
                    onClick={() => handleSync(source)}
                    disabled={busy}
                    data-testid={`content-repo-sync-${repo.owner}-${repo.repo}`}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {t("content_repo.action.sync", "Sync now")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => handleMove(source, -1)}
                    disabled={busy || index === 0}
                    aria-label={t("content_repo.action.move_up", "Move up")}
                    title={t("content_repo.action.move_up", "Move up")}
                    data-testid={`content-repo-up-${repo.owner}-${repo.repo}`}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => handleMove(source, 1)}
                    disabled={busy || index === repos.length - 1}
                    aria-label={t("content_repo.action.move_down", "Move down")}
                    title={t("content_repo.action.move_down", "Move down")}
                    data-testid={`content-repo-down-${repo.owner}-${repo.repo}`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {/* #1093 — owner-only Teilen: a repo added by redeeming an
                      invitation code is a guest copy, so it offers no re-share. */}
                  {!repo.shared_via_invite && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 gap-2"
                      onClick={() => handleShare(repo)}
                      disabled={busy}
                      data-testid={`content-repo-share-${repo.owner}-${repo.repo}`}
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      {t("content_repo.action.share", "Share")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={confirmRemove === source ? "destructive" : "outline"}
                    size="sm"
                    className="min-h-11 gap-2"
                    onClick={() => handleRemove(source)}
                    disabled={busy}
                    data-testid={`content-repo-remove-${repo.owner}-${repo.repo}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {confirmRemove === source
                      ? t("content_repo.action.confirm_remove", "Confirm remove")
                      : t("content_repo.action.remove", "Remove")}
                  </Button>
                </div>
                {share?.source === source && (
                  <div
                    className="mt-3 rounded-sm border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                    data-testid={`content-repo-share-panel-${repo.owner}-${repo.repo}`}
                  >
                    {/* #1093 — Teilen splits into Link sharing + Invitation codes. */}
                    <div
                      className="mb-3 flex gap-1"
                      role="tablist"
                      aria-label={t("content_repo.action.share", "Share")}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant={shareTab === "link" ? "default" : "outline"}
                        className="min-h-9"
                        role="tab"
                        aria-selected={shareTab === "link"}
                        onClick={() => setShareTab("link")}
                        data-testid="content-repo-share-tab-link"
                      >
                        {t("content_repo.share.tab_link", "Link")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={shareTab === "codes" ? "default" : "outline"}
                        className="min-h-9"
                        role="tab"
                        aria-selected={shareTab === "codes"}
                        onClick={() => setShareTab("codes")}
                        data-testid="content-repo-share-tab-codes"
                      >
                        {t("invitation_code.title", "Invitation codes")}
                      </Button>
                    </div>

                    {shareTab === "link" ? (
                      <>
                        <p className="m-0 text-sm text-[var(--fg-muted)]">
                          {t(
                            "content_repo.share.hint",
                            "Share this link so others can add this PUBLIC repo. For a private repo, send the URL + a read-only token separately.",
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input
                            type="text"
                            readOnly
                            value={share.link}
                            className="min-w-[16rem] flex-1"
                            data-testid="content-repo-share-link"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11 gap-2"
                            onClick={() => handleCopyLink(share.link)}
                            data-testid="content-repo-share-copy"
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            {t("content_repo.share.copy", "Copy")}
                          </Button>
                        </div>
                        {share.qr && (
                          <img
                            src={share.qr}
                            alt={t("content_repo.share.qr_alt", "QR code for the share link")}
                            className="mt-3 rounded-sm"
                            width={180}
                            height={180}
                            data-testid="content-repo-share-qr"
                          />
                        )}
                      </>
                    ) : (
                      <InviteCodesPanel
                        source={source}
                        branch={repo.branch}
                        token={resolveRepoToken(source)}
                      />
                    )}
                  </div>
                )}
              </li>
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
    </section>
  );
}
