/**
 * Route-to-title table for ``document.title`` (#3431).
 *
 * Every route resolves to the i18n key of its page heading or nav label,
 * so tabs, history entries and screen-reader page announcements name the
 * page in the UI language (WCAG 2.4.2). The keys are existing catalog
 * entries; ``page-title.test.ts`` pins that every one of them exists in all
 * catalogs, because the table hands them to ``t`` as variables, which the
 * static key-coverage scan cannot see.
 */

/** The product name every title ends with. Not translated. */
export const APP_TITLE = "Adaptive Learner";

/** An i18n key plus the English fallback ``t`` shows while catalogs load. */
export interface PageTitleKey {
  key: string;
  fallback: string;
}

interface PageTitleRule extends PageTitleKey {
  /** First path segment (``"settings"`` for ``/settings``). */
  segment: string;
}

const RULES: PageTitleRule[] = [
  { segment: "onboarding", key: "onboarding.title", fallback: "Create a learning project" },
  { segment: "assessment", key: "assessment.title", fallback: "Learning-type assessment" },
  { segment: "dashboard", key: "dashboard.title", fallback: "Dashboard" },
  { segment: "session", key: "nav.session", fallback: "Session" },
  { segment: "curriculum", key: "nav.curriculum", fallback: "Curriculum" },
  { segment: "progress", key: "nav.progress", fallback: "Progress" },
  { segment: "statistics", key: "nav.statistics", fallback: "Statistics" },
  { segment: "set-summary", key: "nav.statistics", fallback: "Statistics" },
  { segment: "import", key: "nav.import", fallback: "Import" },
  { segment: "discover", key: "nav.tab.discover", fallback: "Discover" },
  { segment: "content", key: "nav.tab.content", fallback: "Content" },
  { segment: "contribute", key: "nav.tab.content", fallback: "Content" },
  { segment: "anki", key: "anki.title", fallback: "Anki Export" },
  { segment: "arcade", key: "arcade.title", fallback: "Arcade" },
  { segment: "add-repo", key: "content_repo.add.title", fallback: "Add a repository" },
  { segment: "invite", key: "invitation_code.redeem.title", fallback: "Redeem an invitation code" },
  { segment: "learning-path", key: "nav.learning_path", fallback: "Learning Path" },
  { segment: "create-lesson", key: "create_lesson.title", fallback: "Create a lesson" },
  { segment: "lesson", key: "lesson.page_title", fallback: "Lesson" },
  { segment: "review", key: "review.page_title", fallback: "Review" },
  { segment: "adaptive-lesson", key: "adaptive.session_title", fallback: "Adaptive lesson" },
  { segment: "shuffle-lesson", key: "shuffle.session_title", fallback: "Shuffle session" },
  { segment: "endless-lesson", key: "endless.page_title", fallback: "Endless practice" },
  { segment: "error-replay", key: "learning_path.error_replay", fallback: "Retry errors" },
  { segment: "projects", key: "repo.page.title", fallback: "Learning Repository" },
  { segment: "pronunciation", key: "pronunciation.title", fallback: "Pronunciation Practice" },
  { segment: "settings", key: "settings.title", fallback: "Settings" },
];

const BY_SEGMENT = new Map(RULES.map((rule) => [rule.segment, rule]));

/** Every key the table can hand to ``t``, for the catalog pin. */
export const PAGE_TITLE_KEYS: readonly string[] = [...new Set(RULES.map((r) => r.key))];

/**
 * The title key for a router pathname, or ``null`` for the landing page and
 * unknown paths (they keep the bare product name).
 *
 * @example
 * pageTitleFor("/settings"); // { key: "settings.title", fallback: "Settings" }
 * pageTitleFor("/"); // null
 */
export function pageTitleFor(pathname: string): PageTitleKey | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  const rule = segment ? BY_SEGMENT.get(segment) : undefined;
  return rule ? { key: rule.key, fallback: rule.fallback } : null;
}

/**
 * The ``document.title`` for a localized page name: ``"<page> - Adaptive
 * Learner"``, or the bare product name when there is no page name.
 *
 * @example
 * formatDocumentTitle("Einstellungen"); // "Einstellungen - Adaptive Learner"
 */
export function formatDocumentTitle(page: string | null): string {
  const name = page?.trim();
  return name ? `${name} - ${APP_TITLE}` : APP_TITLE;
}
