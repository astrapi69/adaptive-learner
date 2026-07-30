/**
 * ProgressHub — the consolidated "Fortschritt" page (EXP-037 / #850).
 *
 * Merges three formerly-separate nav destinations into one tabbed page:
 *   - Übersicht  → the existing {@link Progress} page (XP, charts, history)
 *   - Statistik  → the existing {@link LearningStatistics} page (heatmap, …)
 *   - Meine Pfade → the existing {@link Curriculum} builder
 *
 * The page-level components are NOT rewritten — they are embedded as tab
 * content. Only the ACTIVE tab is mounted (lazy), so there is never a
 * duplicate ``<main id="main">``: the active child owns the page's ``<main>``,
 * this hub only renders the tab bar above it.
 *
 * The active tab is reflected in the URL (``?tab=overview|stats|paths``), so the
 * old routes redirect cleanly (``/statistics → /progress?tab=stats``,
 * ``/curriculum → /progress?tab=paths``) and tabs are deep-linkable — the same
 * ``?tab=`` convention the Settings page uses.
 */

import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router";

import { useI18n } from "../../hooks/ui/useI18n";

const Progress = lazy(() => import("./Progress"));
const LearningStatistics = lazy(() => import("./LearningStatistics"));
const Curriculum = lazy(() => import("../content/Curriculum"));

type TabId = "overview" | "stats" | "paths";

const TAB_ORDER: TabId[] = ["overview", "stats", "paths"];

function normalizeTab(raw: string | null): TabId {
  return TAB_ORDER.includes(raw as TabId) ? (raw as TabId) : "overview";
}

export default function ProgressHub() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const active = normalizeTab(params.get("tab"));

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: t("progress.tab.overview", "Overview") },
    { id: "stats", label: t("progress.tab.stats", "Statistics") },
    { id: "paths", label: t("progress.tab.paths", "My paths") },
  ];

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <div data-testid="progress-hub">
      <div
        role="tablist"
        aria-label={t("progress.title", "Progress")}
        data-testid="progress-hub-tabs"
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
              data-testid={`progress-tab-${tab.id}`}
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
        {active === "overview" && <Progress />}
        {active === "stats" && <LearningStatistics />}
        {active === "paths" && <Curriculum />}
      </Suspense>
    </div>
  );
}
