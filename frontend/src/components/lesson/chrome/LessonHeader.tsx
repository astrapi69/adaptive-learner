/**
 * Lesson viewer header (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Renders the optional small set-context line, the (compact) lesson title,
 * and the optional contributor credit. #1633 — the title is kept as a
 * semantic <h1> but rendered small, and the description subtitle is no
 * longer shown inside the active lesson. #1642 — the pause control moved
 * to the footer, so the header is now purely presentational.
 */

import type { ContentLesson } from "../../../storage/types";
import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonHeaderProps {
  lesson: ContentLesson;
  setTitle: string | null;
}

/** Compact set / title / credit line. */
export default function LessonHeader({ lesson, setTitle }: LessonHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="lesson-header">
      {setTitle && (
        // #959 — keep the set context compact (smaller, single line with
        // ellipsis) so it never costs more than one row.
        <p
          className="lesson-header-set truncate text-sm"
          data-testid="lesson-header-set"
        >
          <span className="lesson-header-set-label">
            {t("lesson.set_label", "Set")}:
          </span>
          {setTitle}
        </p>
      )}
      {/* #1633 — the title stays a semantic <h1> (a11y + document structure
          + page heading), but is rendered small/unobtrusive like the set
          label so the big title + description block stops pushing the task
          below the fold on mobile. The set name (collection) and the lesson
          title carry different info, so both stay — just small. The full
          title is still on the set-detail page; the description subtitle is
          dropped from the in-lesson view (it lives on the set-detail
          surfaces). */}
      <h1
        className="truncate text-sm font-medium text-fg-secondary"
        title={lesson.title}
        data-testid="lesson-header-title"
      >
        {lesson.title}
      </h1>
      {lesson.contributed_by && (
        <p className="lesson-credit" data-testid="lesson-credit">
          {t("lesson.contributed_by", "Contributed by {name}").replace(
            "{name}",
            lesson.contributed_by,
          )}
        </p>
      )}
    </header>
  );
}
