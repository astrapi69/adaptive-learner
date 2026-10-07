import { useEffect } from "react";
import { useLocation } from "react-router";

import { useI18n } from "../../hooks/ui/useI18n";
import { formatDocumentTitle, pageTitleFor } from "../../lib/i18n/page-title";

/**
 * Renders nothing; keeps ``document.title`` on the current page name in the
 * UI language (#3431): ``"<page> - Adaptive Learner"``, from the page's own
 * heading or nav label key (see ``lib/i18n/page-title``). ``index.html``
 * keeps its static title as the default a crawler and the first paint see.
 *
 * Must sit inside the router and the ``I18nProvider``, which is why it is a
 * component in the shell and not a call in ``App`` itself (``App`` renders
 * the provider).
 *
 * @example
 * <I18nProvider>
 *   <DocumentTitle />
 * </I18nProvider>
 */
export function DocumentTitle(): null {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const page = pageTitleFor(pathname);
  const name = page ? t(page.key, page.fallback) : null;

  useEffect(() => {
    document.title = formatDocumentTitle(name);
  }, [name]);

  return null;
}
