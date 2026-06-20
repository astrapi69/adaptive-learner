/**
 * DiscoverHub — the "Entdecken" page with an Import tab (EXP-037 / #850).
 *
 * Merges the standalone Import destination into Discover as a second tab:
 *   - Entdecken   → the existing {@link Discover} page (find + download sets)
 *   - Importieren → the existing {@link Import} page (chat import list)
 *
 * As with {@link ProgressHub}, the page components are embedded unchanged and
 * only the active tab is mounted (lazy), so the active child owns the page's
 * ``<main id="main">``. The active tab is in the URL (``?tab=discover|import``),
 * so ``/import`` redirects cleanly to ``/discover?tab=import`` while the
 * deep-link route ``/import/:conversationId`` (ImportDetail) stays separate.
 */

import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "../../hooks/ui/useI18n";

const Discover = lazy(() => import("./Discover"));
const Import = lazy(() => import("./Import"));

type TabId = "discover" | "import";

const TAB_ORDER: TabId[] = ["discover", "import"];

function normalizeTab(raw: string | null): TabId {
  return TAB_ORDER.includes(raw as TabId) ? (raw as TabId) : "discover";
}

export default function DiscoverHub() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const active = normalizeTab(params.get("tab"));

  const tabs: { id: TabId; label: string }[] = [
    { id: "discover", label: t("discover.tab.discover", "Discover") },
    { id: "import", label: t("discover.tab.import", "Import") },
  ];

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params);
    if (id === "discover") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <div data-testid="discover-hub">
      <div
        role="tablist"
        aria-label={t("discover.title", "Discover content")}
        data-testid="discover-hub-tabs"
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
              data-testid={`discover-tab-${tab.id}`}
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
        {active === "import" && <Import />}
      </Suspense>
    </div>
  );
}
