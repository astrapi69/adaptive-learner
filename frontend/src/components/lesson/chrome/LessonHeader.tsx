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

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";

import type { ContentLesson } from "../../../storage/types";
import type { SetPosition } from "../../../lib/lesson/set-position";
import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonHeaderProps {
  lesson: ContentLesson;
  setTitle: string | null;
  /** Position of this lesson in its set (#2793); omitted when unknown. */
  position?: SetPosition | null;
  /** Route of the preceding lesson, when there is one (#2793). */
  prevHref?: string | null;
  /** Route of the following lesson, when there is one (#2793). */
  nextHref?: string | null;
}

/** Compact set / title / credit line, plus the in-set position row. */
export default function LessonHeader({
  lesson,
  setTitle,
  position = null,
  prevHref = null,
  nextHref = null,
}: LessonHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="lesson-header">
      {position && (
        // #2793 — "how far am I" plus the backward step the app never had.
        // Both arrows are plain router links, so the browser's own history
        // and long-press "open in new tab" keep working; the disabled edge
        // renders as inert text, never a dead-looking button.
        <div
          className="flex items-center gap-1 text-sm text-fg-muted"
          data-testid="lesson-position-row"
        >
          {prevHref ? (
            <Link
              to={prevHref}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-app text-fg-secondary hover:bg-bg-elevated"
              aria-label={t("lesson.nav_previous", "Previous lesson")}
              title={t("lesson.nav_previous", "Previous lesson")}
              data-testid="lesson-nav-previous"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span className="min-h-9 min-w-9" aria-hidden="true" />
          )}
          <span data-testid="lesson-position">
            {t("lesson.position", "Lesson {current} of {total}")
              .replace("{current}", String(position.index))
              .replace("{total}", String(position.total))}
          </span>
          {nextHref ? (
            <Link
              to={nextHref}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-app text-fg-secondary hover:bg-bg-elevated"
              aria-label={t("lesson.nav_next", "Next lesson")}
              title={t("lesson.nav_next", "Next lesson")}
              data-testid="lesson-nav-next"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span className="min-h-9 min-w-9" aria-hidden="true" />
          )}
        </div>
      )}
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
