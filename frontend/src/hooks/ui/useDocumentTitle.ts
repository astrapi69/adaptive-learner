/**
 * Keeps ``document.title`` in step with the route and the UI language
 * (#3431): ``"<page> - Adaptive Learner"``, from the page's own heading or
 * nav label key (see ``lib/i18n/page-title``). ``index.html`` keeps its
 * static title as the default a crawler and the first paint see.
 *
 * Mounted once in the app shell, through ``components/a11y/DocumentTitle``.
 *
 * @example
 * function Shell() {
 *   useDocumentTitle();
 *   return null;
 * }
 */

import { useEffect } from "react";
import { useLocation } from "react-router";

import { formatDocumentTitle, pageTitleFor } from "../../lib/i18n/page-title";
import { useI18n } from "./useI18n";

export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const page = pageTitleFor(pathname);
  const name = page ? t(page.key, page.fallback) : null;

  useEffect(() => {
    document.title = formatDocumentTitle(name);
  }, [name]);
}
