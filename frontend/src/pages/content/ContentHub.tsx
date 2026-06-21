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
 */

import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "../../hooks/ui/useI18n";

const Discover = lazy(() => import("./Discover"));
const Content = lazy(() => import("./Content"));
const Import = lazy(() => import("./Import"));

type TabId = "discover" | "my" | "import";

const TAB_ORDER: TabId[] = ["discover", "my", "import"];

function normalizeTab(raw: string | null): TabId {
  return TAB_ORDER.includes(raw as TabId) ? (raw as TabId) : "discover";
}

export default function ContentHub() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const active = normalizeTab(params.get("tab"));

  const tabs: { id: TabId; label: string }[] = [
    { id: "discover", label: t("discover.tab.discover", "Discover") },
    { id: "my", label: t("nav.content", "My content") },
    { id: "import", label: t("discover.tab.import", "Import") },
  ];

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params);
    // Default tab carries no param so ``/content`` is the canonical
    // Entdecken URL.
    if (id === "discover") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <div data-testid="content-hub">
      <div
        role="tablist"
        aria-label={t("nav.tab.content", "Content")}
        data-testid="content-hub-tabs"
        className="flex gap-1 border-b border-border px-4 pt-3"
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
