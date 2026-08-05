/**
 * ShareAsRepoButton + dialog (#1017).
 *
 * "Share as repository" on a downloaded set: serialises the set + its
 * lessons into the official content-repo format and pushes them to a GitHub
 * repository (created if missing) in a single commit. The exported repo is
 * immediately usable as a content source via Settings → Integrations.
 *
 * Self-contained (owns its open/loading state) so it drops into the set
 * action row without threading callbacks through the content page. The
 * action is gated on a configured GitHub token (feature-state policy:
 * disabled + tooltip when absent, never hidden).
 */

import {useEffect, useState} from "react";
import {Upload} from "lucide-react";

import {Button} from "@/components/ui/button";
import ModalShell from "../../../shared/feedback/ModalShell";
import {useI18n} from "../../../hooks/ui/useI18n";
import {
    buildRepoExportFiles,
    exportDomain,
    planLessonFilenames,
    type RepoExportLesson,
} from "../../../lib/content/repo-export";
import {
    validateSetForSharing,
    type ValidationIssue,
    type ValidationResult,
} from "../../../lib/content/validation/content-validator";
import {getStorage} from "../../../storage";
import {ApiError} from "../../../api/client";
import {notify} from "../../../utils/notify";
import type {ContentSetEntry} from "../../../storage/types";

export interface ShareAsRepoButtonProps {
    entry: ContentSetEntry;
    testIdPrefix?: string;
}

type Phase = "form" | "working" | "done";

export default function ShareAsRepoButton({
    entry,
    testIdPrefix = "user-set",
}: ShareAsRepoButtonProps) {
    const {t} = useI18n();
    const [open, setOpen] = useState(false);
    const [hasToken, setHasToken] = useState<boolean | null>(null);
    const [repo, setRepo] = useState("");
    const [isPrivate, setIsPrivate] = useState(true);
    const [branch, setBranch] = useState("main");
    const [phase, setPhase] = useState<Phase>("form");
    const [error, setError] = useState<string | null>(null);
    const [repoUrl, setRepoUrl] = useState<string | null>(null);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [renamed, setRenamed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void getStorage()
            .github.getStatus()
            .then((s) => {
                if (!cancelled) setHasToken(s.configured);
            })
            .catch(() => {
                if (!cancelled) setHasToken(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Seed a sensible default repo name from the set id once we know the user.
    const openDialog = async () => {
        setError(null);
        setPhase("form");
        setRepoUrl(null);
        setValidation(null);
        setRenamed(false);
        if (!repo) {
            try {
                const status = await getStorage().github.getStatus();
                if (status.configured) setRepo(entry.id);
            } catch {
                /* leave the field empty */
            }
        }
        setOpen(true);
    };

    // Localise a validation issue via ``content.validation.{code}``.
    const validationMessage = (issue: ValidationIssue): string => {
        let msg = t(`content.validation.${issue.code}`, issue.code);
        for (const [k, v] of Object.entries(issue.params ?? {})) {
            msg = msg.replace(`{${k}}`, String(v));
        }
        return msg;
    };

    const fetchLessons = async (): Promise<RepoExportLesson[]> => {
        const storage = getStorage();
        const list = await storage.contentLoader.listLessons(
            entry.source,
            entry.id,
        );
        return Promise.all(
            list.lessons.map(async (filename) => ({
                filename,
                lesson: await storage.contentLoader.getLesson(
                    entry.source,
                    entry.id,
                    filename,
                ),
            })),
        );
    };

    const onExport = async () => {
        const ownerRepo = repo.trim();
        if (!/^[^/\s]+\/[^/\s]+$/.test(ownerRepo)) {
            setError(
                t(
                    "content.repo_export.invalid_repo",
                    "Enter the repository as owner/name.",
                ),
            );
            return;
        }
        setPhase("working");
        setError(null);
        try {
            const lessons = await fetchLessons();
            // #2376 - run the SAME quality checks a gated content repo runs,
            // BEFORE building the archive. First finding stops the export and
            // shows the list; a second click exports anyway (author's call -
            // their own repo, no reviewer in the loop).
            if (!validation) {
                const result = validateSetForSharing(
                    {
                        title: entry.title,
                        title_native: entry.title_native,
                        target_language: entry.target_language,
                        source_language: entry.source_language,
                        level: entry.level,
                        domain: exportDomain(entry),
                    },
                    lessons.map((l) => l.lesson),
                );
                if (result.issues.length > 0) {
                    setValidation(result);
                    setPhase("form");
                    return;
                }
            }
            setRenamed(planLessonFilenames(lessons).reordered);
            const files = buildRepoExportFiles({set: entry, lessons, ownerRepo});
            const result = await getStorage().github.exportSetToRepo({
                ownerRepo,
                private: isPrivate,
                branch: branch.trim() || "main",
                description: entry.description ?? entry.title,
                files,
                message: `content: export ${entry.title}`,
            });
            setRepoUrl(result.repoUrl);
            setPhase("done");
        } catch (err) {
            setPhase("form");
            const message =
                err instanceof ApiError
                    ? err.detail
                    : t("content.repo_export.failed", "Export failed.");
            setError(message);
            notify.error(message);
        }
    };

    const disabled = hasToken === false;
    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void openDialog()}
                disabled={disabled}
                title={
                    disabled
                        ? t(
                              "content.repo_export.needs_token",
                              "Add a GitHub token in Settings → Integrations to share as a repository.",
                          )
                        : undefined
                }
                data-testid={`${testIdPrefix}-share-repo`}
            >
                <Upload size={16} aria-hidden="true" />
                {t("content.repo_export.button", "Share as repository")}
            </Button>

            <ModalShell
                open={open}
                title={t("content.repo_export.title", "Share as repository")}
                onClose={() => setOpen(false)}
            >
                {phase === "done" ? (
                    <div className="flex flex-col gap-3" data-testid="repo-export-done">
                        <p className="m-0">
                            {t(
                                "content.repo_export.done",
                                "Your set was pushed to the repository.",
                            )}
                        </p>
                        {renamed && (
                            <p
                                className="m-0 text-sm text-[var(--fg-muted)]"
                                data-testid="repo-export-renamed-note"
                            >
                                {t(
                                    "content.repo_export.renamed_note",
                                    "Lesson files were renamed with ordering prefixes (NN-) so the display order matches the lesson order.",
                                )}
                            </p>
                        )}
                        {repoUrl && (
                            <a
                                className="text-[var(--accent-text)] underline"
                                href={repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="repo-export-open"
                            >
                                {repoUrl}
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                                {t("content.repo_export.repo_label", "Repository (owner/name)")}
                            </span>
                            <input
                                className="min-h-11 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)]"
                                value={repo}
                                onChange={(e) => setRepo(e.target.value)}
                                placeholder="owner/repo-name"
                                disabled={phase === "working"}
                                data-testid="repo-export-name"
                            />
                        </label>
                        <fieldset className="m-0 flex gap-4 border-0 p-0">
                            <label className="flex items-center gap-1.5">
                                <input
                                    type="radio"
                                    checked={isPrivate}
                                    onChange={() => setIsPrivate(true)}
                                    data-testid="repo-export-private"
                                />
                                {t("content.repo_export.private", "Private")}
                            </label>
                            <label className="flex items-center gap-1.5">
                                <input
                                    type="radio"
                                    checked={!isPrivate}
                                    onChange={() => setIsPrivate(false)}
                                    data-testid="repo-export-public"
                                />
                                {t("content.repo_export.public", "Public")}
                            </label>
                        </fieldset>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                                {t("content.repo_export.branch", "Branch")}
                            </span>
                            <input
                                className="min-h-11 w-40 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)]"
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                disabled={phase === "working"}
                                data-testid="repo-export-branch"
                            />
                        </label>
                        <p className="m-0 text-sm text-[var(--fg-muted)]">
                            {t(
                                "content.repo_export.lessons_note",
                                "All {n} lessons of this set will be included.",
                            ).replace("{n}", String(entry.lesson_count))}
                        </p>
                        {validation && validation.issues.length > 0 && (
                            <div
                                className="m-0 flex flex-col gap-1 text-sm"
                                data-testid="repo-export-quality-issues"
                            >
                                <p className="m-0 text-[var(--exercise-wrong)]">
                                    {t(
                                        "content.repo_export.quality_issues",
                                        "The quality check found issues. Content-repo gates would reject these:",
                                    )}
                                </p>
                                <ul className="m-0 list-disc pl-5 text-[var(--fg-muted)]">
                                    {validation.issues.map((issue, i) => (
                                        <li key={i}>{validationMessage(issue)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {error && (
                            <p
                                className="m-0 text-sm text-[var(--exercise-wrong)]"
                                role="alert"
                                data-testid="repo-export-error"
                            >
                                {error}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => void onExport()}
                                disabled={phase === "working"}
                                data-testid="repo-export-submit"
                            >
                                {phase === "working"
                                    ? t("content.repo_export.working", "Exporting…")
                                    : validation && validation.issues.length > 0
                                      ? t(
                                            "content.repo_export.export_anyway",
                                            "Export anyway",
                                        )
                                      : t("content.repo_export.submit", "Export")}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={phase === "working"}
                            >
                                {t("common.cancel", "Cancel")}
                            </Button>
                        </div>
                    </div>
                )}
            </ModalShell>
        </>
    );
}
