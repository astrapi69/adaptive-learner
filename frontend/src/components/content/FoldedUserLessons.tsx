/**
 * Folded user lessons block (EXP-026 / UGC-04).
 *
 * Renders the learner's own lessons that {@link buildContentTree} folded
 * into a published node, as a visually-separated block BELOW the
 * official sets (decision E2). Each lesson shows its title, an origin
 * badge ("Your lesson" / "Your edit", decision UGC-03), and the shared
 * {@link UserSetActions} set so a folded lesson carries exactly the same
 * actions as it would in the standalone "My Lessons" section (§3.6).
 *
 * Pure presentational: the owning set entry comes from ``setsByKey`` and
 * every action is a caller-supplied callback.
 */

import { Pencil, User } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import type { FoldedUserLesson } from "../../lib/content/content-tree";
import type { ContentSetEntry } from "../../storage/types";
import IconBadge from "../../shared/layout/IconBadge";
import UserSetActions from "./UserSetActions";

export interface FoldedUserLessonsProps {
  lessons: FoldedUserLesson[];
  /** Owning user-generated sets, keyed ``${source}#${id}``. */
  setsByKey: Record<string, ContentSetEntry>;
  communitySharingEnabled: boolean;
  /** Open one specific folded lesson (by its cached filename). */
  onPlayLesson: (lesson: FoldedUserLesson) => void;
  onEdit: (entry: ContentSetEntry) => void;
  onExportJson: (entry: ContentSetEntry) => void;
  onExportSet: (entry: ContentSetEntry) => void;
  onShare: (entry: ContentSetEntry) => void;
  onDelete: (entry: ContentSetEntry) => void;
}

export default function FoldedUserLessons({
  lessons,
  setsByKey,
  communitySharingEnabled,
  onPlayLesson,
  onEdit,
  onExportJson,
  onExportSet,
  onShare,
  onDelete,
}: FoldedUserLessonsProps) {
  const { t } = useI18n();
  if (lessons.length === 0) return null;

  return (
    <div
      className="mt-2 border-t border-border pt-2"
      data-testid="content-folded-lessons"
    >
      <h4 className="mb-1 text-sm font-semibold text-muted-foreground">
        {t("content.tree.your_lessons", "Your lessons")}
      </h4>
      <ul className="content-set-list">
        {lessons.map((lesson) => {
          const entry = setsByKey[`${lesson.setSource}#${lesson.setId}`];
          if (!entry) return null;
          return (
            <li
              key={`${lesson.setId}/${lesson.lessonId}`}
              className="content-set-row"
              data-testid={`folded-lesson-${lesson.lessonId}`}
            >
              <div className="content-set-meta">
                <h3>
                  {lesson.title}{" "}
                  {lesson.origin === "edit" ? (
                    <IconBadge
                      variant="muted"
                      icon={<Pencil size={12} aria-hidden="true" />}
                      label={t("content.tree.own_edit", "Your edit")}
                      testId={`folded-lesson-${lesson.lessonId}-badge`}
                    />
                  ) : (
                    <IconBadge
                      variant="primary"
                      icon={<User size={12} aria-hidden="true" />}
                      label={t("content.tree.own_lesson", "Your lesson")}
                      testId={`folded-lesson-${lesson.lessonId}-badge`}
                    />
                  )}
                </h3>
              </div>
              <UserSetActions
                entry={entry}
                communitySharingEnabled={communitySharingEnabled}
                testIdPrefix={`folded-lesson-${lesson.lessonId}`}
                onPlay={() => onPlayLesson(lesson)}
                onEdit={onEdit}
                onExportJson={onExportJson}
                onExportSet={onExportSet}
                onShare={onShare}
                onDelete={onDelete}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
