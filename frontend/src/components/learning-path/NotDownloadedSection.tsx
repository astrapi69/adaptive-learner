/**
 * NotDownloadedSection — the collapsible "Nicht heruntergeladen"
 * block at the bottom of the personal Learning Path
 * (feature/learning-path-redesign).
 *
 * Lists content sets the learner hasn't downloaded yet, each with a
 * domain icon, lesson count and a download button. Intentionally
 * less prominent (muted, smaller) than the active sets above. Starts
 * collapsed in "Nur meine" mode, expanded in "Alle Sets" mode; the
 * header also toggles it manually. Downloading routes through
 * getStorage().contentLoader.downloadSet (both storage modes), then
 * asks the parent to reload so the set moves up into the active list.
 */

import {useEffect, useState} from "react";
import {
    Brain,
    Calculator,
    ChevronDown,
    Code,
    Download,
    Flag,
    GraduationCap,
    Loader2,
} from "lucide-react";

import {useI18n} from "../../hooks/ui/useI18n";
import {Button} from "@/components/ui/button";
import {cn} from "../../lib/utils";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {NotDownloadedSet} from "../../lib/learning-path/personal-path";

function DomainIcon({domain}: {domain: string}) {
    const props = {size: 16, "aria-hidden": true as const};
    if (domain === "programming") return <Code {...props} />;
    if (domain === "psychology") return <Brain {...props} />;
    if (domain === "math") return <Calculator {...props} />;
    if (domain === "language") return <Flag {...props} />;
    return <GraduationCap {...props} />;
}

export interface NotDownloadedSectionProps {
    sets: NotDownloadedSet[];
    /** Initial expanded state (driven by the Nur-meine/Alle-Sets filter). */
    expanded: boolean;
    /** Called after a successful download so the parent can reload. */
    onDownloaded: () => void;
}

export default function NotDownloadedSection({
    sets,
    expanded,
    onDownloaded,
}: NotDownloadedSectionProps) {
    const {t} = useI18n();
    const [open, setOpen] = useState(expanded);
    const [busy, setBusy] = useState<string | null>(null);

    // Follow the filter toggle when it changes.
    useEffect(() => setOpen(expanded), [expanded]);

    if (sets.length === 0) return null;

    const download = async (entry: NotDownloadedSet) => {
        setBusy(entry.setId);
        try {
            await getStorage().contentLoader.downloadSet(
                entry.source,
                entry.setId,
            );
            notify.success(
                t("content.toast.downloaded", "Set downloaded and ready to use."),
            );
            onDownloaded();
        } catch {
            notify.error(
                t("content.error.download_failed", "Could not download the set."),
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <section
            className="mt-6"
            data-testid="learning-path-not-downloaded"
        >
            <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-start gap-2 text-sm font-medium text-fg-muted"
                data-testid="not-downloaded-toggle"
            >
                <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={cn(
                        "transition-transform motion-reduce:transition-none",
                        open && "rotate-180",
                    )}
                />
                {t("learning_path.not_downloaded", "Not downloaded")} (
                {sets.length})
            </Button>

            {open && (
                <ul
                    className="mt-2 flex flex-col gap-1"
                    data-testid="not-downloaded-list"
                >
                    {sets.map((entry) => (
                        <li
                            key={`${entry.source}#${entry.setId}`}
                            className="flex items-center gap-3 rounded-app border border-border/60 bg-card/60 px-3 py-2"
                            data-testid={`not-downloaded-${entry.setId}`}
                        >
                            <span className="shrink-0 text-fg-muted">
                                <DomainIcon domain={entry.domain} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                                {entry.title}
                            </span>
                            <span className="shrink-0 text-xs text-fg-muted">
                                {t(
                                    "learning_path.personal.lesson_count",
                                    "{n} lessons",
                                ).replace("{n}", String(entry.lessonCount))}
                            </span>
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => download(entry)}
                                disabled={busy === entry.setId}
                                aria-label={t("learning_path.download", "Download")}
                                className="shrink-0 gap-1.5 rounded-app px-3 py-1.5 text-sm font-medium text-foreground"
                                data-testid={`not-downloaded-download-${entry.setId}`}
                            >
                                {busy === entry.setId ? (
                                    <Loader2
                                        size={15}
                                        className="animate-spin motion-reduce:animate-none"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Download size={15} aria-hidden="true" />
                                )}
                                <span className="hidden sm:inline">
                                    {t("learning_path.download", "Download")}
                                </span>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
