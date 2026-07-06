/**
 * BottomTabBar — the mobile primary navigation (EXP-037 / #850).
 *
 * A fixed bottom tab bar with 5 items — Lernen, Inhalte, Lernpfad,
 * Fortschritt, and a "Mehr" button that opens a bottom sheet with the
 * secondary destinations (Einstellungen, Hilfe). This is the
 * expectation-matching mobile pattern (Duolingo / Quizlet / Anki) that
 * replaces a 12-entry hamburger list. (#856 merged the separate "Entdecken"
 * tab into "Inhalte" and promoted Lernpfad from the "Mehr" sheet.)
 *
 * Mobile only (``md:hidden``); the desktop grouped top bar
 * ({@link Navigation}) takes over from ``md`` up. Hidden on the
 * pre-onboarding funnel and during an active lesson (where the lesson footer
 * owns the bottom edge). 44px touch targets, token-backed Tailwind, all themes.
 *
 * While mounted it adds a ``has-bottom-nav`` class to ``<body>`` so the app
 * scroll container reserves space and content is never hidden behind the bar.
 */

import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";

import NavGroup from "./NavGroup";
import { HELP_TARGET, navTarget } from "./nav-targets";
import { useHelp } from "../../contexts/HelpContext";
import { helpKeyForPath } from "../../lib/help/help-routes";
import { useI18n } from "../../hooks/ui/useI18n";
import { useIsLessonActive } from "../../hooks/lesson/session/useIsLessonActive";

const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];

interface TabDef {
  to: string;
  icon: LucideIcon;
  label: string;
  testId: string;
}

export default function BottomTabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const lessonActive = useIsLessonActive();
  const { openHelp } = useHelp();
  const [moreOpen, setMoreOpen] = useState(false);

  // Reserve scroll space for the fixed bar while it is mounted.
  useEffect(() => {
    document.body.classList.add("has-bottom-nav");
    return () => document.body.classList.remove("has-bottom-nav");
  }, []);

  // Close the sheet on route change.
  useEffect(() => setMoreOpen(false), [pathname]);

  // Close the sheet on Escape while open.
  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  if (HIDE_ON.includes(pathname) || lessonActive) return null;

  // #856 — "Inhalte" + "Entdecken" merged into one Content tab (the
  // ContentHub at /content opens on its Entdecken tab). The freed slot
  // promotes Lernpfad into the primary bar (it leaves the "Mehr" sheet).
  // Routes + icons come from the shared target model (#1390); only the tab
  // LABELS are bar-specific (shorter, tab-idiomatic wording).
  const tabs: TabDef[] = [
    { to: navTarget("/dashboard").to, icon: navTarget("/dashboard").icon, label: t("nav.tab.learn", "Learn"), testId: "tab-learn" },
    { to: navTarget("/content").to, icon: navTarget("/content").icon, label: t("nav.tab.content", "Content"), testId: "tab-content" },
    { to: navTarget("/learning-path").to, icon: navTarget("/learning-path").icon, label: t("nav.learning_path", "Learning Path"), testId: "tab-learning-path" },
    { to: navTarget("/progress").to, icon: navTarget("/progress").icon, label: t("nav.tab.progress", "Progress"), testId: "tab-progress" },
  ];
  const settingsTarget = navTarget("/settings");
  const SettingsIcon = settingsTarget.icon;
  const HelpIcon = HELP_TARGET.icon;

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-app px-1 py-1 text-[0.7rem] font-medium ${
      isActive ? "text-accent" : "text-fg-muted"
    }`;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-border bg-bg-surface px-1 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden"
        data-testid="bottom-tab-bar"
        aria-label={t("nav.primary", "Primary navigation")}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={tabClass}
              data-testid={tab.testId}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-app px-1 py-1 text-[0.7rem] font-medium text-fg-muted"
          data-testid="tab-more"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span className="truncate">{t("nav.tab.more", "More")}</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:hidden"
          data-testid="more-sheet-overlay"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-2xl border-t border-border bg-bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-md"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.tab.more", "More")}
            data-testid="more-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-primary">
                {t("nav.tab.more", "More")}
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t("common.close", "Close")}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-app text-fg-secondary hover:bg-bg-elevated"
                data-testid="more-sheet-close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <NavGroup label={t("nav.group.more", "MORE")} testId="more-group-utility">
              <NavLink
                to={settingsTarget.to}
                className="more-sheet-link flex min-h-[44px] items-center gap-3 rounded-app px-2 text-fg-primary hover:bg-bg-elevated"
                data-testid="more-settings"
              >
                <SettingsIcon size={18} aria-hidden="true" />
                {t(settingsTarget.labelKey, settingsTarget.labelFallback)}
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  openHelp(helpKeyForPath(pathname));
                  setMoreOpen(false);
                }}
                className="more-sheet-link flex min-h-[44px] w-full items-center gap-3 rounded-app px-2 text-left text-fg-primary hover:bg-bg-elevated"
                data-testid="more-help"
              >
                <HelpIcon size={18} aria-hidden="true" />
                {t(HELP_TARGET.labelKey, HELP_TARGET.labelFallback)}
              </button>
            </NavGroup>
          </div>
        </div>
      )}
    </>
  );
}
