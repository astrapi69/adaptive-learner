/**
 * Shared action set for a user-generated set (EXP-026 / UGC-04).
 *
 * The same Play / Edit / Export / Export-as-set / Share / Delete row is
 * used both in the standalone "My Lessons" section and next to a lesson
 * folded into the content tree, so the two surfaces can never drift
 * (cf. the backup-button parity, #331). Fully props-driven: every label
 * comes from i18n, every action is a caller-supplied callback, and the
 * `testIdPrefix` namespaces the buttons for the surface that renders it.
 */

import { Download, FolderOpen, Pencil, Play, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import ShareAsRepoButton from "../share/ShareAsRepoButton";
import type { ContentSetEntry } from "../../../storage/types";

export interface UserSetActionsProps {
  entry: ContentSetEntry;
  communitySharingEnabled: boolean;
  /** Namespaces the button testids, e.g. ``my-lesson-{id}`` or
   *  ``folded-lesson-{lessonId}``. */
  testIdPrefix: string;
  /** Play this set / lesson. The caller decides what "play" opens
   *  (the set's first lesson, or one specific folded lesson). */
  onPlay: (entry: ContentSetEntry) => void;
  onEdit: (entry: ContentSetEntry) => void;
  onExportJson: (entry: ContentSetEntry) => void;
  onExportSet: (entry: ContentSetEntry) => void;
  onShare: (entry: ContentSetEntry) => void;
  onDelete: (entry: ContentSetEntry) => void;
  /** #2210 — render the set-level Edit button. Off for a multi-lesson set,
   *  where it would guess which lesson; the per-lesson Edit in SetLessonList
   *  is the entry there. Defaults on (single-lesson + folded surfaces). */
  showEdit?: boolean;
}

export default function UserSetActions({
  entry,
  communitySharingEnabled,
  testIdPrefix,
  onPlay,
  onEdit,
  onExportJson,
  onExportSet,
  onShare,
  onDelete,
  showEdit = true,
}: UserSetActionsProps) {
  const { t } = useI18n();
  return (
    <div className="content-set-action w-full">
      <Button type="button" onClick={() => onPlay(entry)} data-testid={`${testIdPrefix}-play`}>
        <Play size={14} aria-hidden="true" />
        {t("content.my_lessons.play", "Play")}
      </Button>
      {/* #1740 / #2210 — every own lesson is editable (analysis routes back
          to its import page; created/imported/adaptive open the pre-filled
          Lesson Creator). Hidden for a multi-lesson set (``showEdit=false``),
          where a set-level Edit would guess which lesson; the per-lesson Edit
          in SetLessonList is the entry there. */}
      {showEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onEdit(entry)}
          data-testid={`${testIdPrefix}-edit`}
        >
          <Pencil size={14} aria-hidden="true" />
          {t("content.my_lessons.edit", "Edit")}
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onExportJson(entry)}
        data-testid={`${testIdPrefix}-export`}
      >
        <Download size={14} aria-hidden="true" />
        {t("content.my_lessons.export", "Export")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onExportSet(entry)}
        data-testid={`${testIdPrefix}-export-set`}
      >
        <FolderOpen size={14} aria-hidden="true" />
        {t("content.my_lessons.export_set", "Export as set")}
      </Button>
      {communitySharingEnabled && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onShare(entry)}
          data-testid={`${testIdPrefix}-share`}
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          {t("content.my_lessons.share", "Share with Community")}
        </Button>
      )}
      {/* #1017 — export the set to a GitHub repository for class/team sharing. */}
      <ShareAsRepoButton entry={entry} testIdPrefix={testIdPrefix} />
      <Button
        type="button"
        variant="secondary"
        onClick={() => onDelete(entry)}
        data-testid={`${testIdPrefix}-delete`}
      >
        <Trash2 size={14} aria-hidden="true" />
        {t("content.my_lessons.delete", "Delete")}
      </Button>
    </div>
  );
}
