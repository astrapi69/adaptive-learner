/**
 * SetDiscoveryCard — a reusable, props-driven card for one discoverable
 * content set (EXP-034 / DIS-05).
 *
 * App-agnostic: the set metadata, the download handler, the already-downloaded
 * flag, and every label come in through props (no i18n import, no app state).
 * Renders the set name + description, a language badge, a level badge, lesson +
 * card counts, an optional trust badge + AI-checked badge, and a download
 * button (or an "already present" badge when downloaded). Token-backed Tailwind
 * only; the download button keeps a >=44px touch target.
 *
 * @example
 * <SetDiscoveryCard
 *   set={set}
 *   isDownloaded={false}
 *   onDownload={(s) => download(s)}
 *   languageLabel="DE → ES"
 *   labels={{ download: "Download", downloaded: "Already present", … }}
 * />
 */

import { Check, Download, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SearchableSet } from "../lib/content/search-index-loader";

export type SetDiscoveryDownloadState = "idle" | "downloading" | "done" | "error";

export interface SetDiscoveryCardLabels {
  /** Download button. */
  download: string;
  /** In-flight download button. */
  downloading: string;
  /** Retry label after a failed download. */
  retry: string;
  /** "Already present" badge for a downloaded set. */
  downloaded: string;
  /** Pre-formatted lesson count, e.g. "15 lessons". */
  lessons: string;
  /** Pre-formatted card count, e.g. "450 cards". */
  cards: string;
  /** AI-checked badge label (rendered only when the set is AI-validated). */
  aiChecked: string;
  /** Trust badge label (Official / Verified / Validated); empty = no badge. */
  trust: string;
}

export interface SetDiscoveryCardProps {
  set: SearchableSet;
  isDownloaded: boolean;
  /** Download progress state for this card (defaults to "idle"). */
  state?: SetDiscoveryDownloadState;
  onDownload: (set: SearchableSet) => void;
  /** Pre-formatted language badge text, e.g. "DE → ES". */
  languageLabel: string;
  labels: SetDiscoveryCardLabels;
  testId?: string;
}

export default function SetDiscoveryCard({
  set,
  isDownloaded,
  state = "idle",
  onDownload,
  languageLabel,
  labels,
  testId = "set-discovery-card",
}: SetDiscoveryCardProps) {
  const downloading = state === "downloading";
  const buttonLabel =
    state === "error" ? labels.retry : downloading ? labels.downloading : labels.download;

  return (
    <Card className="flex flex-col gap-2 p-3" data-testid={testId} data-set-id={set.id}>
      <div className="flex items-start gap-2">
        <p className="grow font-medium leading-snug">{set.name}</p>
        {set.trust_level > 0 && labels.trust ? (
          <Badge variant="secondary" className="shrink-0" data-testid={`${testId}-trust`}>
            <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
            {labels.trust}
          </Badge>
        ) : null}
      </div>

      {set.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{set.description}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {languageLabel ? (
          <Badge variant="secondary" data-testid={`${testId}-language`}>
            {languageLabel}
          </Badge>
        ) : null}
        {set.level ? (
          <Badge variant="outline" data-testid={`${testId}-level`}>
            {set.level.toUpperCase()}
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground" data-testid={`${testId}-lessons`}>
          {labels.lessons}
        </span>
        <span className="text-xs text-muted-foreground" data-testid={`${testId}-cards`}>
          {labels.cards}
        </span>
        {set.ai_validated && labels.aiChecked ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-success"
            data-testid={`${testId}-ai`}
            title={labels.aiChecked}
          >
            <Sparkles className="size-3" aria-hidden="true" />
            {labels.aiChecked}
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-end">
        {isDownloaded ? (
          <Badge
            variant="outline"
            className="gap-1 text-success"
            data-testid={`${testId}-downloaded`}
          >
            <Check className="size-3" aria-hidden="true" />
            {labels.downloaded}
          </Badge>
        ) : (
          <Button
            type="button"
            variant="default"
            className="min-h-11"
            disabled={downloading}
            onClick={() => onDownload(set)}
            data-testid={`${testId}-download`}
          >
            {downloading ? (
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-1 size-4" aria-hidden="true" />
            )}
            {buttonLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
