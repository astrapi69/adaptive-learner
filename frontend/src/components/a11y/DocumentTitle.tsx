import { useDocumentTitle } from "../../hooks/ui/useDocumentTitle";

/**
 * Renders nothing; keeps ``document.title`` on the current page name in the
 * UI language (#3431). Must sit inside the router and the ``I18nProvider``,
 * which is why it is a component in the shell and not a call in ``App``
 * itself (``App`` renders the provider).
 *
 * @example
 * <I18nProvider>
 *   <DocumentTitle />
 * </I18nProvider>
 */
export function DocumentTitle(): null {
  useDocumentTitle();
  return null;
}
