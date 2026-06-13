/**
 * Context-sensitive help wiring (#159).
 *
 * Two pure helpers shared by the navigation help button and the
 * help drawer:
 *
 * - ``helpKeyForPath`` maps the current route to the glossary
 *   entry that best describes the visible view, so the nav "?"
 *   opens "what does THIS page do" instead of a fixed entry.
 * - ``docsUrlForSlug`` builds the absolute URL of a deployed
 *   MkDocs help page for an entry's ``docs_slug``, used by the
 *   drawer's "Learn more" link.
 */

/** Base URL of the deployed MkDocs documentation site. */
export const DOCS_BASE_URL =
  "https://astrapi69.github.io/adaptive-learner/docs/";

/** Glossary key opened when no route-specific entry applies.
 *  ``learning_project`` is the broadest concept and links out to
 *  the rest of the glossary via related concepts. */
export const DEFAULT_HELP_KEY = "learning_project";

/** Documentation languages that have a built locale on the site.
 *  Anything else falls back to the default (German) tree at the
 *  docs root. */
const DOCS_LANGS = new Set(["de", "en", "es", "fr", "el", "pt", "tr", "ja"]);

/** Route-prefix -> glossary-key table, most specific first.
 *  Matched by ``startsWith`` against the pathname so parameterized
 *  routes (``/lesson/:a/:b/:c``) resolve to the same view help. */
const ROUTE_HELP_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["/dashboard", "view_dashboard"],
  ["/content", "view_content_browser"],
  ["/lesson", "view_lesson"],
  ["/review", "view_lesson"],
  ["/adaptive-lesson", "view_lesson"],
  ["/error-replay", "view_lesson"],
  ["/create-lesson", "view_content_browser"],
  ["/settings", "view_settings"],
  ["/assessment", "assessment"],
  ["/session", "learning_session"],
  ["/curriculum", "curriculum"],
  ["/progress", "view_dashboard"],
  ["/import", "feature_conversation_analysis"],
];

/**
 * Resolve the glossary key for a route. Returns the most specific
 * matching view entry, or ``DEFAULT_HELP_KEY`` when nothing matches.
 */
export function helpKeyForPath(pathname: string): string {
  for (const [prefix, key] of ROUTE_HELP_KEYS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return DEFAULT_HELP_KEY;
}

/**
 * Build the absolute URL of the MkDocs help page for a slug.
 *
 * The site is built with mkdocs-static-i18n in folder mode with
 * German as the default locale: the default language lives at the
 * docs root (``/docs/<slug>/``) and every other language under a
 * locale prefix (``/docs/<lang>/<slug>/``).
 *
 * @param slug - Help-page slug without extension, e.g.
 *   ``features/content-browser``.
 * @param lang - Active UI language (region codes like ``de-DE``
 *   are normalized to the base language).
 */
export function docsUrlForSlug(slug: string, lang: string): string {
  const base = lang.split("-")[0].toLowerCase();
  const prefix = base === "de" || !DOCS_LANGS.has(base) ? "" : `${base}/`;
  return `${DOCS_BASE_URL}${prefix}${slug}/`;
}
