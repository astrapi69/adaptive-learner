/**
 * "My Lessons" section on /content — the user-generated sets, separate
 * from downloaded content (extracted from Content.tsx, #401).
 *
 * Each row carries up to six actions (Play / Edit / Export / Export as
 * set / Share / Delete); all are delivered as callbacks from the page.
 */

import { Download, FolderOpen, Pencil, Play, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../hooks/useI18n";
import type { ContentSetEntry } from "../../storage/types";

interface MyLessonsSectionProps {
  userSets: ContentSetEntry[];
  communitySharingEnabled: boolean;
  onOpen: (entry: ContentSetEntry) => void;
  onEdit: (entry: ContentSetEntry) => void;
  onExportJson: (entry: ContentSetEntry) => void;
  onExportSet: (entry: ContentSetEntry) => void;
  onShare: (entry: ContentSetEntry) => void;
  onDelete: (entry: ContentSetEntry) => void;
}

export default function MyLessonsSection({
  userSets,
  communitySharingEnabled,
  onOpen,
  onEdit,
  onExportJson,
  onExportSet,
  onShare,
  onDelete,
}: MyLessonsSectionProps) {
  const { t } = useI18n();

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;
  const originLabel = (entry: ContentSetEntry): string => {
    if (entry.domain === "adaptive")
      return t("content.my_lessons.from_adaptive", "from adaptive lesson");
    if (entry.domain === "imported") return t("content.my_lessons.from_imported", "imported");
    return t("content.my_lessons.from_analysis", "from analysis");
  };

  return (
    <section className="content-section content-my-lessons" data-testid="content-my-lessons">
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
        <ul className="content-set-list" data-testid="content-my-lessons-list">
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
              {/* #226 — My Lessons rows carry up to 6 actions. The
                  shared .content-set-action is flex-shrink:0, so its
                  flex-wrap never activates beside the meta and the row
                  overflowed the card. w-full drops it onto its own
                  full-width line so the buttons wrap to the next row. */}
              <div className="content-set-action w-full">
                <Button
                  type="button"
                  onClick={() => onOpen(entry)}
                  data-testid={`my-lesson-${entry.id}-play`}
                >
                  <Play size={14} aria-hidden="true" />
                  {t("content.my_lessons.play", "Play")}
                </Button>
                {entry.domain === "analysis" && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onEdit(entry)}
                    data-testid={`my-lesson-${entry.id}-edit`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t("content.my_lessons.edit", "Edit")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onExportJson(entry)}
                  data-testid={`my-lesson-${entry.id}-export`}
                >
                  <Download size={14} aria-hidden="true" />
                  {t("content.my_lessons.export", "Export")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onExportSet(entry)}
                  data-testid={`my-lesson-${entry.id}-export-set`}
                >
                  <FolderOpen size={14} aria-hidden="true" />
                  {t("content.my_lessons.export_set", "Export as set")}
                </Button>
                {communitySharingEnabled && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onShare(entry)}
                    data-testid={`my-lesson-${entry.id}-share`}
                  >
                    <Share2 className="h-5 w-5" aria-hidden="true" />
                    {t("content.my_lessons.share", "Share with Community")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onDelete(entry)}
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
  );
}
