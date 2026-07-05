/**
 * ContentHub — the single "Inhalte" destination at ``/content`` (#856).
 *
 * Merges the former "Meine Inhalte" (``/content``) and "Inhalte entdecken"
 * (``/discover``) pages plus chat import into one tabbed hub:
 *   - Entdecken     → the {@link Discover} page (find + download sets) — DEFAULT
 *   - Meine Inhalte → the {@link Content} page (downloaded sets + repos)
 *   - Importieren   → the {@link Import} page (chat import list)
 *
 * As with {@link ProgressHub} / the former DiscoverHub, the page components are
 * embedded unchanged and only the active tab is mounted (lazy), so the active
 * child owns the page's ``<main id="main">``. The active tab lives in the URL
 * (``?tab=discover|my|import``), so ``/discover`` redirects to
 * ``/content?tab=discover`` and ``/import`` to ``/content?tab=import`` while the
 * deep-link route ``/content/import/:conversationId`` (ImportDetail) stays
 * separate. The default tab is **Entdecken** so a first-time user is guided to
 * find content instead of landing on an empty "My content" page.
 *
 * Reuses existing, fully-translated i18n keys (no new keys): the tab labels are
 * ``discover.tab.discover`` / ``nav.content`` / ``discover.tab.import``.
 *
 * The tab ORDER is user-configurable (#1378, Settings → General). The FIRST
 * configured tab is the initial active tab when ``/content`` is opened with no
 * ``?tab`` param; an explicit ``?tab=<id>`` deep link always wins over that.
 */

import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "../../hooks/ui/useI18n";
import { useContentTabOrder } from "../../hooks/content/useContentTabOrder";
import type { ContentTabId } from "../../lib/content/contentTabOrderPref";

const Discover = lazy(() => import("./Discover"));
const Content = lazy(() => import("./Content"));
const Import = lazy(() => import("./Import"));

type TabId = ContentTabId;

const KNOWN_TABS: readonly TabId[] = ["discover", "my", "import"];

/** The explicit ``?tab`` value when it names a known tab; else null. */
function tabFromParam(raw: string | null): TabId | null {
  return KNOWN_TABS.includes(raw as TabId) ? (raw as TabId) : null;
}

export default function ContentHub() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const order = useContentTabOrder();

  // Deep link wins; otherwise the first configured tab is the start tab.
  const active = tabFromParam(params.get("tab")) ?? order[0];

  const labels: Record<TabId, string> = {
    discover: t("discover.tab.discover", "Discover"),
    my: t("nav.content", "My content"),
    import: t("discover.tab.import", "Import"),
  };
  const tabs = order.map((id) => ({ id, label: labels[id] }));

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params);
    // The first configured tab is the canonical ``/content`` URL, so it
    // carries no ``?tab`` param.
    if (id === order[0]) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <div data-testid="content-hub">
      <div
        role="tablist"
        aria-label={t("nav.tab.content", "Content")}
        data-testid="content-hub-tabs"
        className="flex flex-wrap gap-1 border-b border-border px-4 pt-3"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.id)}
              data-testid={`content-tab-${tab.id}`}
              className={`min-h-[44px] rounded-t-app px-4 text-sm font-medium ${
                isActive
                  ? "border-b-2 border-accent text-accent"
                  : "text-fg-muted hover:text-fg-primary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <Suspense fallback={null}>
        {active === "discover" && <Discover />}
        {active === "my" && <Content />}
        {active === "import" && <Import />}
      </Suspense>
    </div>
  );
}
