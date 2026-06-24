/**
 * MigrationWelcomeDialog (#1085) — first-launch prompt on a fresh LOCAL (API
 * mode) install offering to bring over data the learner accumulated on the
 * online (GitHub Pages / Dexie) version, via the existing ``.alb`` backup.
 *
 * Presentational + props-driven: the host owns the open state and the three
 * actions (import a backup, open the online version, or start without data) and
 * persists the "already offered" flag. The actual import reuses the onboarding
 * first-run restore flow — this dialog never touches the backup engine.
 */

import { Download, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import ModalShell from "../../shared/feedback/ModalShell";

export interface MigrationWelcomeLabels {
  title: string;
  body: string;
  hint: string;
  importLabel: string;
  importing: string;
  openOnline: string;
  startFresh: string;
  close: string;
}

export interface MigrationWelcomeDialogProps {
  open: boolean;
  labels: MigrationWelcomeLabels;
  /** A restore is in flight (disables the actions). */
  importing?: boolean;
  /** Pick a backup file to import (reuses the first-run restore flow). */
  onImport: () => void;
  /** Open the online version in a new tab so the learner can export there. */
  onOpenOnline: () => void;
  /** Dismiss and continue with a fresh install. */
  onStartFresh: () => void;
}

export default function MigrationWelcomeDialog({
  open,
  labels,
  importing = false,
  onImport,
  onOpenOnline,
  onStartFresh,
}: MigrationWelcomeDialogProps) {
  return (
    <ModalShell
      open={open}
      title={labels.title}
      onClose={onStartFresh}
      closeLabel={labels.close}
      widthClassName="max-w-lg"
      testId="migration-welcome"
    >
      <p className="m-0 text-[var(--fg-primary)]">{labels.body}</p>
      <p className="mt-3 text-sm text-[var(--fg-muted)]">{labels.hint}</p>

      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          className="min-h-11 gap-2"
          onClick={onImport}
          disabled={importing}
          data-testid="migration-import"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {importing ? labels.importing : labels.importLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2"
          onClick={onOpenOnline}
          disabled={importing}
          data-testid="migration-open-online"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {labels.openOnline}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={onStartFresh}
          disabled={importing}
          data-testid="migration-start-fresh"
        >
          {labels.startFresh}
        </Button>
      </div>
    </ModalShell>
  );
}
