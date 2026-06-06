/**
 * Content-repository settings (EXP-023 Phase A).
 *
 * Two cards:
 *  - "Offizielle Inhalte" — the read-only official repository, with its
 *    cached set + lesson counts. Not editable, not removable.
 *  - "Eigenes Content-Repository" — connect ONE own GitHub repo by URL +
 *    branch, reusing the GitHub token from Settings → Integrations. Shows
 *    connection status + last sync, and lets the user disconnect.
 *
 * Phase A is read-only consumption: connecting validates + saves the
 * config and (from the sync commit) caches the repo's lessons locally.
 * Pushing lessons to a user repo (Share Wizard) is Phase B.
 *
 * Works in both storage modes via ``getStorage()`` — the config lives in
 * the ``content-loader`` plugin settings (Dexie ``pluginSettings`` /
 * API ``plugin-settings``); the official counts come from
 * ``contentLoader.listSets``.
 */

import { useCallback, useEffect, useState } from "react";
import { BookOpen, FolderGit2, Link2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "../hooks/useI18n";
import { getStorage } from "../storage";
import {
  OFFICIAL_SOURCE,
  isOfficialSource,
  parseGitHubRepoUrl,
  userRepoSource,
  readUserRepo,
  writeUserRepo,
  type UserContentRepo,
} from "../lib/content/content-repos";
import { notify } from "../utils/notify";

interface OfficialSummary {
  setCount: number;
  lessonCount: number;
}

export default function ContentRepoSettingsSection() {
  const { t } = useI18n();
  const [official, setOfficial] = useState<OfficialSummary | null>(null);
  const [repo, setRepo] = useState<UserContentRepo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const storage = getStorage();
    const [stored, tokenStatus] = await Promise.all([
      readUserRepo(),
      storage.github.getStatus().catch(() => ({
        configured: false,
        source: "none" as const,
      })),
    ]);
    setRepo(stored);
    setTokenConfigured(Boolean(tokenStatus.configured));
    if (stored) {
      setUrl(stored.url);
      setBranch(stored.branch);
    }
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

  const handleConnect = useCallback(async () => {
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
    try {
      const branchName = branch.trim() || "main";
      const next: UserContentRepo = {
        url: url.trim(),
        owner: parsed.owner,
        repo: parsed.repo,
        branch: branchName,
        connected: false,
        last_synced: null,
        set_count: 0,
        lesson_count: 0,
      };
      await writeUserRepo(next);
      setRepo(next);
      notify.success(
        t("content_repo.saved", "Repository saved. Sync to load its lessons."),
      );
    } catch {
      notify.error(
        t("content_repo.error.save_failed", "Could not save the repository."),
      );
    } finally {
      setBusy(false);
    }
  }, [url, branch, t]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await writeUserRepo(null);
      setRepo(null);
      setUrl("");
      setBranch("main");
      notify.success(
        t("content_repo.removed", "Repository disconnected."),
      );
    } catch {
      notify.error(
        t("content_repo.error.remove_failed", "Could not remove the repository."),
      );
    } finally {
      setBusy(false);
    }
  }, [t]);

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

      {/* User repo. */}
      <div
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
        data-testid="content-repo-user"
      >
        <div className="flex items-center gap-2">
          <FolderGit2
            className="h-5 w-5 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
          <h3 className="m-0 text-base font-semibold">
            {t("content_repo.user.title", "Your content repository")}
          </h3>
          {repo && (
            <span
              className="ml-auto rounded-sm bg-[var(--info-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--info)]"
              data-testid="content-repo-user-status"
            >
              {repo.connected
                ? t("content_repo.status.connected", "Connected")
                : t("content_repo.status.configured", "Not synced")}
            </span>
          )}
        </div>

        {!tokenConfigured && (
          <p
            className="m-0 mt-2 text-sm text-[var(--warning)]"
            data-testid="content-repo-token-hint"
          >
            {t(
              "content_repo.token_hint",
              "Private repositories need a GitHub token — set one in Settings → Integrations.",
            )}
          </p>
        )}

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
          <label className="flex max-w-[16rem] flex-col gap-1 text-sm">
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
        </div>

        {repo?.last_synced && (
          <p
            className="m-0 mt-3 text-sm text-[var(--fg-muted)]"
            data-testid="content-repo-last-sync"
          >
            {t("content_repo.last_sync", "Last sync: {when}").replace(
              "{when}",
              new Date(repo.last_synced).toLocaleString(),
            )}
            {" · "}
            {t("content_repo.user.counts", "{sets} sets · {lessons} lessons")
              .replace("{sets}", String(repo.set_count))
              .replace("{lessons}", String(repo.lesson_count))}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 gap-2"
            onClick={handleConnect}
            disabled={busy || !url.trim()}
            data-testid="content-repo-connect"
          >
            <Link2 className="h-5 w-5" aria-hidden="true" />
            {t("content_repo.action.connect", "Connect repository")}
          </Button>
          {repo && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={handleDisconnect}
              disabled={busy}
              data-testid="content-repo-remove"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              {t("content_repo.action.remove", "Disconnect")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
