/**
 * DesktopSidebar — the vertical desktop primary navigation (EXP-037 §7 Q1 / #891).
 *
 * A fixed left sidebar that takes over the primary navigation on desktop
 * widths (>= ``lg`` / 1024px). It reuses the EXP-037 grouped model
 * ({@link NavGroup}) and the SAME routes/labels as the horizontal top bar
 * ({@link Navigation}) and the mobile {@link BottomTabBar} — no new
 * destinations, only a vertical desktop presentation.
 *
 * Responsive contract (mobile-first, no break to the mobile UX):
 * - ``< lg`` — hidden (``hidden``). Mobile keeps the {@link BottomTabBar};
 *   the 768–1024px tablet range keeps the horizontal top bar.
 * - ``>= lg`` — visible (``lg:flex``). The top bar's brand + inline links are
 *   hidden via CSS (``body.has-desktop-sidebar``) so the two never duplicate;
 *   the top bar keeps the right-hand utility cluster (badges, avatar, theme).
 *
 * While visible it adds ``has-desktop-sidebar`` to ``<body>`` so the app
 * scroll container (``#root``) and the top bar reserve left space at ``lg+``
 * (the reservation itself is gated by the ``lg`` media query in global.css,
 * so it has no effect on mobile even though the class is present).
 *
 * Hidden on the pre-onboarding funnel and during an active lesson, matching
 * the top bar + bottom bar. 44px touch targets, token-backed Tailwind,
 * ``aria-current`` on the active item (set by ``NavLink``), all themes.
 */

import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  FilePlus,
  HelpCircle,
  Home,
  Map as MapIcon,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";

import MenuToggleButton from "../../shared/layout/MenuToggleButton";
import NavGroup from "./NavGroup";
import { useDesktopSidebar } from "../../contexts/DesktopSidebarContext";
import { useHelp } from "../../contexts/HelpContext";
import { helpKeyForPath } from "../../lib/help/help-routes";
import { useButtonTooltips } from "../../hooks/settings/useButtonTooltips";
import { useI18n } from "../../hooks/ui/useI18n";
import { useIsLessonActive } from "../../hooks/lesson/session/useIsLessonActive";
import { useTheme } from "../../hooks/ui/useTheme";
import { isDarkTheme } from "../../lib/theme/themes";

/** id of the sidebar nav — referenced by both toggles' ``aria-controls``. */
export const DESKTOP_SIDEBAR_ID = "desktop-sidebar";

const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];

/** Token-backed classes for one vertical sidebar entry (link or button). */
function entryClass(isActive: boolean): string {
  return `flex min-h-[44px] items-center gap-3 rounded-app px-3 text-sm font-medium ${
    isActive
      ? "bg-bg-elevated text-accent"
      : "text-fg-primary hover:bg-bg-elevated"
  }`;
}

export default function DesktopSidebar() {
  const { t } = useI18n();
  const tooltipsOn = useButtonTooltips();
  const { pathname } = useLocation();
  const lessonActive = useIsLessonActive();
  const { openHelp } = useHelp();
  const { theme } = useTheme();
  const { open, toggle, collapse } = useDesktopSidebar();

  // ``hide`` folds the structural reasons (funnel / lesson) together with the
  // user's collapse state: the sidebar renders only when shown AND open.
  const hide = HIDE_ON.includes(pathname) || lessonActive || !open;

  const navRef = useRef<HTMLElement>(null);
  const wasShown = useRef(false);
  const initialized = useRef(false);

  // Reserve left space on #root + the top bar while the sidebar is shown.
  // The reservation is gated by the ``lg`` media query in global.css, so the
  // class is harmless on mobile (where the sidebar itself is ``hidden``).
  // Removed while collapsed so the content reclaims the full width.
  useEffect(() => {
    if (hide) return;
    document.body.classList.add("has-desktop-sidebar");
    return () => document.body.classList.remove("has-desktop-sidebar");
  }, [hide]);

  // Drawer-style dismissal while open: an outside pointerdown or Escape
  // collapses the sidebar (transient — does not persist). Mirrors the #666
  // top-bar drawer pattern (``pointerdown`` for iOS-reliable touch). A
  // pointerdown INSIDE the sidebar is ignored (the close button + links own
  // their own handlers).
  useEffect(() => {
    if (hide) return;
    function onPointerDown(e: Event) {
      if (!navRef.current?.contains(e.target as Node)) collapse();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") collapse();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [hide, collapse]);

  // Move focus into the sidebar when it is OPENED by the user (a false->true
  // transition of the shown state), not on the initial page load — autofocus
  // on every mount would steal focus from the page. The ``initialized`` guard
  // skips the very first render so an already-open sidebar never grabs focus.
  // Lands on the close toggle.
  useEffect(() => {
    const shown = !hide;
    if (initialized.current && shown && !wasShown.current) {
      navRef.current
        ?.querySelector<HTMLElement>('[data-testid="sidebar-toggle"]')
        ?.focus();
    }
    wasShown.current = shown;
    initialized.current = true;
  }, [hide]);

  if (hide) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    entryClass(isActive);

  // Collapse on a nav-link tap (the link still navigates — no preventDefault).
  // Delegated so every current + future anchor inherits it; the close button
  // and the Help button are ``<button>``s, so ``closest("a")`` skips them.
  function collapseOnLinkTap(e: React.MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest("a")) collapse();
  }

  return (
    <nav
      ref={navRef}
      id={DESKTOP_SIDEBAR_ID}
      className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col overflow-y-auto border-r border-border bg-bg-surface lg:flex"
      data-testid="desktop-sidebar"
      aria-label={t("nav.primary", "Primary navigation")}
      onClick={collapseOnLinkTap}
    >
      {/* Brand header — the sidebar owns the brand at ``lg+`` (the top bar's
          brand is hidden there to avoid duplication). The close toggle sits
          beside it; clicking it collapses the sidebar (full-width content). */}
      <div className="flex items-center justify-between gap-2 pr-2">
        <NavLink
          to="/dashboard"
          className="flex min-h-[44px] flex-1 items-center gap-2 px-4 py-3 font-semibold text-fg-primary"
          aria-label={t("app.name", "Adaptive Learner")}
          data-testid="sidebar-brand"
        >
          <img
            src={`${import.meta.env.BASE_URL}${
              isDarkTheme(theme) ? "icon-192-dark.png" : "icon-192.png"
            }`}
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="rounded-sm"
          />
          <span className="truncate">{t("app.name", "Adaptive Learner")}</span>
        </NavLink>
        <MenuToggleButton
          open
          onToggle={toggle}
          label={t("nav.sidebar_close", "Close sidebar")}
          tooltip={tooltipsOn}
          controlsId={DESKTOP_SIDEBAR_ID}
          testId="sidebar-toggle"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2 pb-4">
        <NavGroup label={t("nav.group.learn", "LEARN")} testId="sidebar-group-learn">
          <NavLink to="/dashboard" className={linkClass} data-testid="sidebar-dashboard">
            <Home size={18} aria-hidden="true" />
            {t("nav.dashboard", "Dashboard")}
          </NavLink>
          <NavLink to="/learning-path" className={linkClass} data-testid="sidebar-learning-path">
            <MapIcon size={18} aria-hidden="true" />
            {t("nav.learning_path", "Learning Path")}
          </NavLink>
          <NavLink to="/session" className={linkClass} data-testid="sidebar-session">
            <MessageSquare size={18} aria-hidden="true" />
            {t("nav.session", "Session")}
          </NavLink>
        </NavGroup>

        <NavGroup label={t("nav.group.content", "CONTENT")} testId="sidebar-group-content">
          <NavLink to="/content" className={linkClass} data-testid="sidebar-content">
            <BookOpen size={18} aria-hidden="true" />
            {t("nav.tab.content", "Content")}
          </NavLink>
          <NavLink to="/contribute" className={linkClass} data-testid="sidebar-contribute">
            <FilePlus size={18} aria-hidden="true" />
            {t("nav.contribute", "Contribute")}
          </NavLink>
        </NavGroup>

        <NavGroup label={t("nav.group.progress", "PROGRESS")} testId="sidebar-group-progress">
          <NavLink to="/progress" className={linkClass} data-testid="sidebar-progress">
            <BarChart3 size={18} aria-hidden="true" />
            {t("nav.progress", "Progress")}
          </NavLink>
        </NavGroup>

        <NavGroup label={t("nav.group.more", "MORE")} testId="sidebar-group-more">
          <NavLink to="/settings" className={linkClass} data-testid="sidebar-settings">
            <SettingsIcon size={18} aria-hidden="true" />
            {t("nav.settings", "Settings")}
          </NavLink>
          <button
            type="button"
            className={`${entryClass(false)} w-full text-left`}
            data-testid="sidebar-help"
            onClick={() => openHelp(helpKeyForPath(pathname))}
          >
            <HelpCircle size={18} aria-hidden="true" />
            {t("nav.help", "Help")}
          </button>
        </NavGroup>
      </div>
    </nav>
  );
}
